import * as THREE from 'three';
import { createWorld } from './world.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { EnemyManager, ENEMY_TYPES } from './enemies.js';
import { PickupManager } from './pickups.js';
import { WeaponSystem } from './weapons.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';

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
  state: 'menu', // menu | playing | dying | paused | gameover
  score: 0,
  kills: 0,
  locked: false,
  deathT: 0,
  audio: AudioSys,
  hooks: {},
};

const world = createWorld(scene);
game.world = world;
const effects = new Effects(scene);
game.effects = effects;
const player = new Player(camera, world);
game.player = player;
const hud = new HUD();

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
};
game.hooks.onPlayerHurt = (pos) => {
  hud.damageFlash();
  if (pos) hud.damageIndicator(angleToSourceDeg(pos));
  AudioSys.hurt();
};

const enemies = new EnemyManager(scene, world, effects, {
  onPlayerDamage(amount, pos) {
    if (game.state !== 'playing' || !player.alive) return;
    player.takeDamage(amount);
    player.addShake(0.12 + amount * 0.004);
    game.hooks.onPlayerHurt(pos);
    if (!player.alive) beginDeath();
  },
  onHitEnemy(enemy, killed) {
    hud.hitmarker(killed);
    if (killed) AudioSys.kill(); else AudioSys.hit();
  },
  onKill(enemy) {
    game.kills++;
    game.score += ENEMY_TYPES[enemy.type].points + (enemies.wave - 1) * 10;
    const pos = enemy.group.position;
    const r = Math.random();
    if (enemy.type === 'heavy' || r < 0.16) pickups.spawn(pos, 'health');
    else if (r < 0.52) pickups.spawn(pos, 'ammo');
  },
  onWaveStart(n) {
    hud.banner(`WAVE ${n}`);
    AudioSys.wave();
  },
  onWaveComplete(n) {
    const bonus = 200 * n;
    game.score += bonus;
    hud.banner(`WAVE ${n} CLEAR   +${bonus}`, 2.6);
    weapons.addAmmo();
    hud.message('SUPPLIES REPLENISHED', 2.5);
  },
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
    AudioSys.pickup();
    hud.message('AMMO RESUPPLY', 1.4);
  },
});
game.pickups = pickups;

const weapons = new WeaponSystem(camera, scene, vmScene, vmCamera, game);
game.weapons = weapons;

// ---------- state transitions ----------
function startGame() {
  game.score = 0;
  game.kills = 0;
  game.deathT = 0;
  player.reset();
  enemies.reset();
  pickups.reset();
  weapons.reset();
  effects.clear();
  game.state = 'playing';
  hud.showScreen(null);
  hud.message('HOSTILES INBOUND — SURVIVE', 2.5);
}

function beginDeath() {
  game.state = 'dying';
  game.deathT = 0;
  weapons.release();
  weapons.setZoom(false);
  AudioSys.gameover();
}

function toGameOver() {
  game.state = 'gameover';
  hud.showScreen('gameover', { score: game.score, kills: game.kills, wave: enemies.wave });
  if (document.pointerLockElement) document.exitPointerLock();
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  weapons.release();
  weapons.setZoom(false);
  hud.showScreen('pause');
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
  onPlay() { AudioSys.init(); startGame(); requestLock(); },
  onResume() { AudioSys.init(); resumeGame(); },
  onRestart() { startGame(); requestLock(); },
});

// ---------- input ----------
const keys = {};

window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (game.state === 'playing') {
    if (e.code === 'KeyR') weapons.reload();
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
  const enemiesLabel = enemies.remaining > 0
    ? String(enemies.remaining)
    : (enemies.wave === 0 ? '\u2014' : `NEXT ${Math.max(0, Math.ceil(enemies.betweenT))}s`);
  hud.update(dt, {
    health: player.health,
    maxHealth: player.maxHealth,
    alive: player.alive,
    weapon: ws,
    wave: Math.max(1, enemies.wave),
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

  if (game.state === 'playing') {
    syncInput();
    player.update(dt);
    enemies.update(dt, player, camera);
    weapons.update(dt);
    pickups.update(dt, player);
    effects.update(dt);
    world.update(t);
    updateHud(dt);
  } else if (game.state === 'dying') {
    game.deathT += dt;
    player.update(dt);
    enemies.update(dt, player, camera);
    effects.update(dt);
    world.update(t);
    updateHud(dt);
    if (game.deathT > 1.7) toGameOver();
  } else {
    world.update(t);
    effects.update(dt);
  }

  // keep the viewmodel camera in sync (FOV changes with sniper zoom)
  vmCamera.fov = camera.fov;
  vmCamera.aspect = camera.aspect;
  vmCamera.updateProjectionMatrix();

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(vmScene, vmCamera);
});

// initial menu view
hud.showScreen('menu');
