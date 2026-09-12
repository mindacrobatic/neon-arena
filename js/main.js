import * as THREE from 'three';
import { createWorld } from './world.js?v=3';
import { Effects } from './effects.js?v=3';
import { Player } from './player.js?v=3';
import { EnemyManager, ENEMY_TYPES } from './enemies.js?v=3';
import { PickupManager } from './pickups.js?v=3';
import { WeaponSystem } from './weapons.js?v=3';
import { GrenadeSystem } from './grenades.js?v=3';
import { HUD } from './hud.js?v=3';
import { AudioSys } from './audio.js?v=3';
import { SCENARIOS, getScenario, getDifficulty, fmtClock } from './scenarios.js?v=3';

// ---------- renderer / scenes / cameras ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false; // we render two scenes per frame (world, then viewmodels)
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 700);
scene.add(camera);

const vmScene = new THREE.Scene();  // first-person weapon models (rendered on top)
const vmCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 12);

// ---------- game state container ----------
const game = {
  state: 'menu', // menu | playing | dying | paused | gameover | victory
  score: 0,
  kills: 0,
  time: 0,       // mission clock (seconds spent in the playing state)
  locked: false,
  deathT: 0,
  scenario: null,
  difficulty: null,
  rules: {},
  timeLimit: null,
  audio: AudioSys,
  hooks: {},
};

const world = createWorld(scene);
world.activate(SCENARIOS[0].id);   // menu backdrop: the first scenario's arena
game.world = world;

const effects = new Effects(scene);
game.effects = effects;
const player = new Player(camera, world);
game.player = player;
const hud = new HUD(world.stats);

function scoreMul() { return game.difficulty ? game.difficulty.score : 1; }

function angleToSourceDeg(pos) {
  const dx = pos.x - player.position.x;
  const dz = pos.z - player.position.z;
  const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
  const rgtX = Math.cos(player.yaw), rgtZ = -Math.sin(player.yaw);
  return Math.atan2(dx * rgtX + dz * rgtZ, dx * fwdX + dz * fwdZ) * 180 / Math.PI;
}

game.hooks.onFire = (def) => {
  player.addAimKick(def.recoil.aim * (0.85 + Math.random() * 0.3), (Math.random() - 0.5) * def.recoil.aim * 0.75);
  player.addShake(def.recoil.shake);
  // gunfire is audible: unaware enemies within the weapon's noise radius wake up
  enemies.alertNoise(player.position, def.noise ?? 22);
};
game.hooks.onPlayerHurt = (pos) => {
  hud.damageFlash();
  if (pos) hud.damageIndicator(angleToSourceDeg(pos));
  AudioSys.hurt();
};

// Alarm feedback throttles: one beep per alert burst, one "CONTACT!" toast
// per engagement (chain alerts fire many onAlert hooks in the same frame).
let lastAlertSndT = -99, lastContactMsgT = -99;

const enemies = new EnemyManager(scene, world, effects, {
  onPlayerDamage(amount, pos) {
    if (game.state !== 'playing' || !player.alive) return;
    const dmg = amount * (game.difficulty ? game.difficulty.playerDamage : 1);
    player.takeDamage(dmg);
    player.addShake(0.12 + amount * 0.004);
    game.hooks.onPlayerHurt(pos);
    // death is detected centrally in the game loop (covers every damage source)
  },
  onHitEnemy(enemy, killed) {
    hud.hitmarker(killed);
    if (killed) AudioSys.kill(); else AudioSys.hit();
  },
  onKill(enemy) {
    game.kills++;
    game.score += Math.round(ENEMY_TYPES[enemy.type].points * (enemy.tier || 1) * scoreMul());
    const pos = enemy.group.position;
    const r = Math.random();
    if (enemy.type === 'heavy' || r < 0.16) pickups.spawn(pos, 'health');
    else if (r < 0.52) pickups.spawn(pos, 'ammo');
  },
  onAlert() {
    const t = performance.now() / 1000;
    if (t - lastAlertSndT > 0.45) { AudioSys.alert(); lastAlertSndT = t; }
    if (t - lastContactMsgT > 4.5) { hud.message('CONTACT!', 1.3); lastContactMsgT = t; }
  },
  onAllCleared() { toVictory(); },
});
game.enemies = enemies;

const pickups = new PickupManager(scene, {
  onHealth(v) {
    player.heal(v);
    AudioSys.pickup();
    hud.message(`+${v} INTEGRITY`, 1.4);
  },
  onAmmo() {
    weapons.addAmmo();
    grenades.addAmmo(1);
    AudioSys.pickup();
    hud.message('AMMO RESUPPLY', 1.4);
  },
});
game.pickups = pickups;

const weapons = new WeaponSystem(camera, scene, vmScene, vmCamera, game);
game.weapons = weapons;

const grenades = new GrenadeSystem(scene, game);
game.grenades = grenades;

// ---------- state transitions ----------
function fmtTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function startGame(sel) {
  const scenario = getScenario(sel && sel.scenarioId);
  const difficulty = getDifficulty(sel && sel.difficultyId);
  game.scenario = scenario;
  game.difficulty = difficulty;
  game.rules = scenario.rules || {};
  game.timeLimit = game.rules.timeLimit ?? null;

  // swap in this scenario's arena before anything is placed on it
  world.activate(scenario.id);

  game.score = 0;
  game.kills = 0;
  game.time = 0;
  game.deathT = 0;
  lastAlertSndT = -99;
  lastContactMsgT = -99;

  enemies.setConfig(difficulty, game.rules);
  player.reset();
  player.yaw = world.current ? world.current.spawnYaw : 0;
  player.syncCamera(0, 0, 0, true);
  enemies.reset(world.enemyPlacements);   // every hostile is placed up front
  if (game.rules.alertOnStart) enemies.alertAll();
  pickups.reset();
  for (const pl of world.pickupPlacements) pickups.spawn(pl.pos, pl.kind, true);
  weapons.reset(difficulty, game.rules);
  grenades.reset(difficulty, game.rules);
  effects.clear();
  game.state = 'playing';
  hud.showScreen(null);
  hud.banner(scenario.name, 2.4);
  hud.message(`${scenario.mode} \u2014 ${scenario.objective}`, 3.2);
}

function beginDeath() {
  if (game.state !== 'playing') return; // idempotent: only from the playing state
  game.state = 'dying';
  game.deathT = 0;
  weapons.release();
  weapons.setZoom(false);
  AudioSys.gameover();
}

function missionResult(reason) {
  return {
    reason,
    mission: game.scenario ? game.scenario.mode : '',
    difficulty: game.difficulty ? game.difficulty.name : '',
  };
}

function toGameOver() {
  game.state = 'gameover';
  hud.showScreen('gameover', {
    ...missionResult('YOU DIED'),
    score: game.score,
    kills: game.kills,
    time: fmtTime(game.time),
  });
  if (document.pointerLockElement) document.exitPointerLock();
}

/** Scenario rule `timeLimit` ran out — different heading, same result screen. */
function toTimeExpired() {
  if (game.state !== 'playing') return;
  game.state = 'gameover';
  weapons.release();
  weapons.setZoom(false);
  enemies.clearProjectiles();
  grenades.clearLive();
  AudioSys.gameover();
  hud.showScreen('gameover', {
    ...missionResult('TIME EXPIRED'),
    score: game.score,
    kills: game.kills,
    time: fmtTime(game.time),
  });
  if (document.pointerLockElement) document.exitPointerLock();
}

function toVictory() {
  if (game.state !== 'playing') return; // death takes precedence if it raced us
  game.state = 'victory';
  weapons.release();
  weapons.setZoom(false);
  // freeze the battlefield: nothing in flight survives the win
  enemies.clearProjectiles();
  weapons.clearRockets();
  grenades.clearLive();
  const clearBonus = 1000;
  const timeBonus = Math.max(0, Math.round(1500 - game.time * 6));
  const bonus = Math.round((clearBonus + timeBonus) * scoreMul());
  game.score += bonus;
  AudioSys.victory();
  hud.showScreen('victory', {
    ...missionResult('SECTOR CLEARED'),
    score: game.score,
    kills: game.kills,
    time: fmtTime(game.time),
    bonus,
  });
  if (document.pointerLockElement) document.exitPointerLock();
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  weapons.release();
  weapons.setZoom(false);
  hud.showScreen('pause');
}

/** Back to the deploy screen: clear the arena so the backdrop is clean. */
function toMenu() {
  game.state = 'menu';
  weapons.release();
  weapons.setZoom(false);
  enemies.reset([]);
  enemies.clearProjectiles();
  weapons.clearRockets();
  grenades.clearLive();
  pickups.reset();
  effects.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  hud.showScreen('menu');
}

/** Live preview: picking a scenario in the menu swaps the arena behind it. */
function previewScenario(scenarioId) {
  if (game.state !== 'menu') return;
  world.activate(getScenario(scenarioId).id);
  player.reset();
  player.yaw = world.current ? world.current.spawnYaw : 0;
  player.syncCamera(0, 0, 0, true);
}

function requestLock() {
  const el = renderer.domElement;
  // Try the low-latency variant first; fall back to the plain call.
  // Both sync throws and promise rejections are swallowed (a denied lock
  // just means the player has to click again — never an uncaught error).
  const attempt = (opts) => {
    try {
      const p = opts ? el.requestPointerLock(opts) : el.requestPointerLock();
      if (p && typeof p.catch === 'function') return p.then(() => 'ok', () => 'rejected');
      return Promise.resolve('ok');
    } catch (e) {
      return Promise.resolve('threw');
    }
  };
  attempt({ unadjustedMovement: true }).then(r => {
    if (r !== 'ok') return attempt(null).then(() => {});
  });
}

function resumeGame() {
  // State flips back to 'playing' only once the pointer lock is actually
  // re-acquired (browsers can reject an immediate re-lock right after ESC).
  requestLock();
}

hud.bind({
  onPlay(sel) { AudioSys.init(); startGame(sel); requestLock(); },
  onResume() { AudioSys.init(); resumeGame(); },
  onRestart() { AudioSys.init(); startGame(hud.getSelection()); requestLock(); },
  onRedeploy() { AudioSys.init(); startGame(hud.getSelection()); requestLock(); },
  onMenu() { toMenu(); },
  onScenarioPreview(scenarioId) { previewScenario(scenarioId); },
});

// ---------- input ----------
const keys = {};

window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (game.state === 'playing') {
    if (e.code === 'KeyR') weapons.reload();
    if (e.code === 'KeyG') grenades.throwGrenade();
    const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
    if (m) weapons.switchTo(+m[1] - 1);
    if (e.code === 'KeyP') { pauseGame(); if (document.pointerLockElement) document.exitPointerLock(); }
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  weapons.release();
});

document.addEventListener('mousemove', e => {
  if (game.locked && game.state === 'playing') player.addLook(e.movementX || 0, e.movementY || 0);
});
document.addEventListener('mousedown', e => {
  if (game.state === 'playing' && game.locked) {
    if (e.button === 0) weapons.press();
    if (e.button === 2) weapons.setZoom(true);
  }
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) weapons.release();
  if (e.button === 2) weapons.setZoom(false);
});
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('wheel', e => {
  if (game.state === 'playing' && game.locked) weapons.cycle(e.deltaY > 0 ? 1 : -1);
}, { passive: true });

document.addEventListener('pointerlockchange', () => {
  game.locked = document.pointerLockElement === renderer.domElement;
  if (game.locked) {
    // re-lock succeeded while paused → resume
    if (game.state === 'paused') {
      game.state = 'playing';
      hud.showScreen(null);
    }
  } else if (game.state === 'playing') {
    pauseGame();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  vmCamera.aspect = camera.aspect;
  vmCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- main loop ----------
const clock = new THREE.Clock();

function syncInput() {
  const i = player.input;
  i.f = !!(keys['KeyW'] || keys['ArrowUp']);
  i.b = !!(keys['KeyS'] || keys['ArrowDown']);
  i.l = !!(keys['KeyA'] || keys['ArrowLeft']);
  i.r = !!(keys['KeyD'] || keys['ArrowRight']);
  i.jump = !!keys['Space'];
  i.sprint = !!(keys['ShiftLeft'] || keys['ShiftRight']);
}

function updateHud(dt) {
  const ws = weapons.hudState();
  const spreadPx = weapons.currentSpread() *
    (window.innerHeight / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const enemiesLabel = enemies.total > 0 ? `${enemies.remaining}/${enemies.total}` : '\u2014';
  const remaining = game.timeLimit ? Math.max(0, game.timeLimit - game.time) : null;
  hud.update(dt, {
    health: player.health,
    maxHealth: player.maxHealth,
    alive: player.alive,
    weapon: ws,
    grenades: grenades.hudState(),
    time: remaining !== null ? fmtClock(remaining) : fmtTime(game.time),
    timeLow: remaining !== null && remaining <= 45,
    missionLabel: game.scenario ? game.scenario.short : '\u2014',
    threatLabel: game.difficulty ? game.difficulty.name : '\u2014',
    enemiesLabel,
    score: game.score,
    kills: game.kills,
    spreadPx,
    zoom: ws.zoomActive,
  });
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // Any gameplay exception is caught and surfaced instead of silently
  // killing the animation loop (which looks like a frozen browser).
  try {
    if (game.state === 'playing') {
      game.time += dt;
      syncInput();
      player.update(dt);
      enemies.update(dt, player, camera);
      weapons.update(dt);
      grenades.update(dt);
      pickups.update(dt, player);
      effects.update(dt);
      world.update(t);
      updateHud(dt);
      // Central failure check — covers every damage source (enemy fire,
      // melee, rocket splash / self damage, grenades, ...) and the timer.
      if (game.timeLimit && game.time >= game.timeLimit) toTimeExpired();
      else if (!player.alive) beginDeath();
    } else if (game.state === 'dying') {
      game.deathT += dt;
      player.update(dt);
      weapons.update(dt);   // let rockets in flight finish their show
      grenades.update(dt);  // live grenades still detonate
      enemies.update(dt, player, camera);
      effects.update(dt);
      world.update(t);
      updateHud(dt);
      if (game.deathT > 1.7) toGameOver();
    } else if (game.state !== 'fatal') {
      world.update(t);
      effects.update(dt);
    }

    // keep the viewmodel camera in sync (FOV changes with sniper zoom)
    vmCamera.fov = camera.fov;
    vmCamera.aspect = camera.aspect;
    vmCamera.updateProjectionMatrix();
  } catch (err) {
    console.error('[NEON COMPOUND] frame error:', err);
    if (game.state !== 'fatal') {
      game.state = 'fatal';
      weapons.release();
      const el = document.getElementById('fatal');
      if (el) {
        el.style.display = 'flex';
        el.textContent =
          '\u26A0  Runtime error \u2014 the game has stopped.\n\n' +
          (err && err.stack ? err.stack : String(err)) +
          '\n\nReload the page to play again.';
      }
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(vmScene, vmCamera);
});

// initial menu view
hud.showScreen('menu');
