import * as THREE from 'three';
import { pointInSolids } from './physics.js?v=2';
import { makeGlowTexture } from './effects.js?v=2';

/**
 * The five weapons. `kind` is either 'hitscan' (instant raycast bullets)
 * or 'projectile' (rocket with splash damage). `noise` is how far (in metres)
 * a shot alerts unaware enemies — the compound hears you pull the trigger.
 */
export const WEAPON_DEFS = [
  {
    id: 'pistol', name: 'M9 SIDEARM', short: 'M9', kind: 'hitscan', auto: false,
    fireDelay: 0.16, damage: 26, pellets: 1, range: 220, noise: 16,
    magSize: 12, reserveStart: Infinity, reserveMax: Infinity, reloadTime: 1.15, ammoPick: 0,
    spread: 0.0032, bloomPerShot: 0.005, bloomMax: 0.022,
    recoil: { aim: 0.011, view: 2.2, shake: 0.05 },
    tracerColor: 0xffe08a, flashSize: 0.16, accent: 0x66ccff,
    vm: { x: 0.24, y: -0.23, z: -0.36 },
  },
  {
    id: 'smg', name: 'VIPER SMG', short: 'VIPER', kind: 'hitscan', auto: true,
    fireDelay: 0.068, damage: 13, pellets: 1, range: 170, noise: 21,
    magSize: 32, reserveStart: 160, reserveMax: 280, reloadTime: 1.5, ammoPick: 90,
    spread: 0.011, bloomPerShot: 0.0055, bloomMax: 0.05,
    recoil: { aim: 0.005, view: 1.5, shake: 0.028 },
    tracerColor: 0x99ffbb, flashSize: 0.13, accent: 0x66ff99,
    vm: { x: 0.26, y: -0.25, z: -0.4 },
  },
  {
    id: 'tesla', name: 'ARC-9 TESLA GUN', short: 'ARC-9', kind: 'hitscan', auto: true,
    fireDelay: 0.13, damage: 20, pellets: 1, range: 85, noise: 17,
    magSize: 24, reserveStart: 120, reserveMax: 240, reloadTime: 1.55, ammoPick: 60,
    spread: 0.008, bloomPerShot: 0.004, bloomMax: 0.035,
    recoil: { aim: 0.007, view: 1.6, shake: 0.05 },
    tracerColor: 0x99eeff, flashSize: 0.24, accent: 0x44ddff,
    chain: { jumps: 3, radius: 9, falloff: 0.6 },
    vm: { x: 0.27, y: -0.25, z: -0.38 },
  },
  {
    id: 'sniper', name: 'LONGVIEW RAILGUN', short: 'LONGVIEW', kind: 'hitscan', auto: false,
    fireDelay: 1.05, damage: 130, pellets: 1, range: 400, zoomFov: 20, noise: 34,
    magSize: 5, reserveStart: 20, reserveMax: 35, reloadTime: 2.3, ammoPick: 8,
    spread: 0.0004, bloomPerShot: 0.02, bloomMax: 0.045,
    recoil: { aim: 0.055, view: 7, shake: 0.3 },
    tracerColor: 0x88ddff, flashSize: 0.34, accent: 0x44aaff,
    vm: { x: 0.28, y: -0.26, z: -0.42 },
  },
  {
    id: 'rocket', name: 'HELLFIRE RPG', short: 'HELLFIRE', kind: 'projectile', auto: false,
    fireDelay: 1.25, magSize: 3, reserveStart: 6, reserveMax: 15, reloadTime: 2.6, ammoPick: 3, noise: 24,
    spread: 0.0015, bloomPerShot: 0, bloomMax: 0,
    recoil: { aim: 0.02, view: 8, shake: 0.38 },
    flashSize: 0.42, accent: 0xff5544,
    projectile: { speed: 34, radius: 6.5, damage: 115, selfDamage: 38, gravity: 2.6 },
    vm: { x: 0.3, y: -0.29, z: -0.45 },
  },
];

// ---------- viewmodel construction (procedural, no assets) ----------

const metal = (color = 0x2b2b34, m = 0.8, r = 0.32) =>
  new THREE.MeshStandardMaterial({ color, metalness: m, roughness: r });
const accentMat = c =>
  new THREE.MeshStandardMaterial({ color: 0x0a0a10, emissive: c, emissiveIntensity: 1.7, roughness: 0.4, metalness: 0.2 });

function B(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0);
  return m;
}

// cylinder aligned to Z (guns point down -Z in viewmodel space)
function C(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 12, open = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
  m.position.set(x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
}

function buildViewmodel(def) {
  const g = new THREE.Group();
  const M = metal();
  const M2 = metal(0x1c1c24, 0.6, 0.5);
  const P = metal(0x141419, 0.15, 0.75);
  const A = accentMat(def.accent);
  const muzzle = new THREE.Object3D();

  switch (def.id) {
    case 'pistol':
      g.add(B(0.085, 0.105, 0.34, M, 0, 0.01, -0.08));       // slide
      g.add(B(0.06, 0.05, 0.3, M2, 0, -0.045, -0.08));       // frame
      g.add(B(0.075, 0.21, 0.1, P, 0, -0.15, 0.075, 0.3));   // grip
      g.add(B(0.03, 0.05, 0.02, M2, 0, 0.075, -0.2));        // front sight
      g.add(B(0.006, 0.02, 0.26, A, 0.045, 0.02, -0.08));    // accent L
      g.add(B(0.006, 0.02, 0.26, A, -0.045, 0.02, -0.08));   // accent R
      muzzle.position.set(0, 0.01, -0.27);
      break;
    case 'smg':
      g.add(B(0.1, 0.13, 0.44, M, 0, 0, -0.12));             // receiver
      g.add(C(0.022, 0.022, 0.26, M2, 0, 0.01, -0.45));      // barrel
      g.add(B(0.055, 0.2, 0.08, P, 0, -0.16, -0.06, -0.18)); // magazine
      g.add(B(0.07, 0.09, 0.24, P, 0, -0.02, 0.2));          // stock
      g.add(B(0.06, 0.14, 0.08, P, 0, -0.12, 0.08, 0.35));   // grip
      g.add(B(0.11, 0.015, 0.1, A, 0, 0.062, -0.2));         // top accent
      muzzle.position.set(0, 0.01, -0.58);
      break;
    case 'tesla': {
      g.add(B(0.1, 0.13, 0.4, M, 0, 0, -0.08));              // receiver
      g.add(B(0.055, 0.15, 0.09, P, 0, -0.14, 0.0, 0.25));   // grip
      g.add(B(0.06, 0.11, 0.24, P, 0, -0.03, 0.2));          // stock
      g.add(C(0.026, 0.026, 0.56, M2, 0, 0.02, -0.52));      // barrel core
      for (let i = 0; i < 4; i++)                            // tesla coil rings
        g.add(C(0.052 - i * 0.007, 0.052 - i * 0.007, 0.03, A, 0, 0.02, -0.32 - i * 0.12, 14));
      g.add(B(0.045, 0.15, 0.07, A, 0, -0.13, -0.16));       // energy cell (glowing mag)
      g.add(C(0.011, 0.011, 0.24, M2, 0.055, 0.02, -0.84, 8));   // electrode L
      g.add(C(0.011, 0.011, 0.24, M2, -0.055, 0.02, -0.84, 8));  // electrode R
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8), A);
      orb.position.set(0, 0.02, -0.95);                      // discharge orb
      g.add(orb);
      muzzle.position.set(0, 0.02, -0.95);
      break;
    }
    case 'sniper':
      g.add(C(0.024, 0.024, 0.95, M2, 0, 0.01, -0.62));      // barrel
      g.add(B(0.09, 0.11, 0.5, M, 0, 0, -0.16));             // receiver
      g.add(C(0.042, 0.042, 0.32, P, 0, 0.1, -0.22, 10));    // scope tube
      g.add(C(0.035, 0.035, 0.02, accentMat(0x88ddff), 0, 0.1, -0.385, 10)); // lens
      g.add(B(0.05, 0.05, 0.14, M2, 0.062, -0.02, 0.02));    // bolt handle
      g.add(B(0.085, 0.14, 0.38, P, 0, -0.05, 0.26, 0.14));  // stock
      g.add(B(0.02, 0.16, 0.02, M2, 0.04, -0.12, -0.85, 0.3));  // bipod
      g.add(B(0.02, 0.16, 0.02, M2, -0.04, -0.12, -0.85, 0.3));
      g.add(B(0.095, 0.012, 0.14, A, 0, 0.058, -0.05));
      muzzle.position.set(0, 0.01, -1.1);
      break;
    case 'rocket': {
      const tube = C(0.085, 0.085, 0.88, M, 0, 0, -0.34, 16, true);
      tube.material = tube.material.clone();
      tube.material.side = THREE.DoubleSide;
      g.add(tube);
      g.add(C(0.095, 0.095, 0.06, M2, 0, 0, -0.76, 16));     // front ring
      g.add(C(0.095, 0.095, 0.06, M2, 0, 0, 0.08, 16));      // rear ring
      g.add(B(0.05, 0.09, 0.05, P, 0, -0.13, -0.1, 0.2));    // grip
      g.add(B(0.04, 0.07, 0.16, M2, 0, 0.1, -0.3));          // sight
      g.add(C(0.092, 0.092, 0.1, accentMat(def.accent), 0, 0, -0.52, 16)); // band
      muzzle.position.set(0, 0, -0.82);
      break;
    }
  }
  g.add(muzzle);
  return { group: g, muzzle };
}

const ZN = new THREE.Vector3(0, 0, -1);

/** Rocket projectile (main scene). Explodes on impact / proximity / timeout. */
class Rocket {
  constructor(sys, pos, dir, def) {
    this.sys = sys;
    this.pdef = def.projectile;
    this.age = 0;
    this.vel = dir.clone().multiplyScalar(this.pdef.speed);
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x993322, metalness: 0.5, roughness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.6, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 10), bodyMat);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 10), darkMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -0.31;
    g.add(nose);
    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.14), darkMat);
      const a = (i * Math.PI * 2) / 3;
      fin.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.18);
      fin.rotation.z = a;
      g.add(fin);
    }
    this.glowMat = new THREE.SpriteMaterial({
      map: sys.glowTex, color: 0xff8844, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, fog: false,
    });
    const glow = new THREE.Sprite(this.glowMat);
    glow.scale.setScalar(0.7);
    glow.position.z = 0.28;
    g.add(glow);
    // claim a pooled light (never added/removed from the scene)
    this.light = sys.rocketLights.find(l => l.intensity === 0) || null;
    if (this.light) this.light.intensity = 9;
    g.position.copy(pos);
    g.quaternion.setFromUnitVectors(ZN, this.vel.clone().normalize());
    sys.scene.add(g);
    this.group = g;
    this.mats = [bodyMat, darkMat, this.glowMat];
    this.smokeT = 0;
  }

  update(dt) {
    this.age += dt;
    this.vel.y -= this.pdef.gravity * dt;
    this.group.position.addScaledVector(this.vel, dt);
    this.group.quaternion.setFromUnitVectors(ZN, this.vel.clone().normalize());
    if (this.light) this.light.position.copy(this.group.position);
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.03;
      this.sys.game.effects.spark(this.group.position, 0x777777, 1, 0.7, 0.1);
    }
    const p = this.group.position;
    let hit = false;
    if (p.y <= 0.16) { p.y = 0.16; hit = true; }
    else if (pointInSolids(p, this.sys.game.world.solids, 0.1)) hit = true;
    else if (this.age > 7) hit = true;
    else {
      for (const e of this.sys.game.enemies.enemies) {
        if (e.state === 'dying') continue;
        const ep = e.group.position;
        const dx = ep.x - p.x, dy = ep.y + 1.0 * e.baseScale - p.y, dz = ep.z - p.z;
        if (dx * dx + dy * dy + dz * dz < 1.25 * 1.25) { hit = true; break; }
      }
    }
    if (hit) this.sys.explodeRocket(this, p.clone());
  }

  dispose() {
    this.sys.scene.remove(this.group);
    this.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    this.mats.forEach(m => m.dispose());
    if (this.light) { this.light.intensity = 0; this.light = null; } // release to pool
  }
}

/**
 * Owns weapon state (mags/reserves), firing (hitscan + rockets),
 * reload, switching, zoom, and all viewmodel animation.
 * Viewmodels live in a separate scene rendered on top (never clips into walls).
 */
export class WeaponSystem {
  constructor(camera, scene, vmScene, vmCamera, game) {
    this.camera = camera;
    this.scene = scene;
    this.vmScene = vmScene;
    this.vmCamera = vmCamera;
    this.game = game;
    this.raycaster = new THREE.Raycaster();
    this.glowTex = makeGlowTexture();

    this.entries = WEAPON_DEFS.map(def => {
      const vm = buildViewmodel(def);
      vm.group.position.set(def.vm.x, def.vm.y, def.vm.z);
      vm.group.visible = false;
      vmScene.add(vm.group);
      return { def, mag: def.magSize, reserve: def.reserveStart, vm, base: new THREE.Vector3(def.vm.x, def.vm.y, def.vm.z) };
    });
    this.index = 0;
    this.entries[0].vm.group.visible = true;

    // viewmodel lighting
    vmScene.add(new THREE.HemisphereLight(0x99aaff, 0x445544, 1.1));
    const d1 = new THREE.DirectionalLight(0xffffff, 2.4);
    d1.position.set(1.5, 3, 2);
    vmScene.add(d1);
    const d2 = new THREE.DirectionalLight(0x6688ff, 0.8);
    d2.position.set(-2, -1, -3);
    vmScene.add(d2);
    this.vmMuzzleLight = new THREE.PointLight(0xffcc88, 0, 6, 2);
    vmScene.add(this.vmMuzzleLight);

    // world-space muzzle flash
    this.flashMat = new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xffdd99, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, fog: false,
    });
    this.flash = new THREE.Sprite(this.flashMat);
    this.flash.visible = false;
    scene.add(this.flash);
    this.worldFlashLight = new THREE.PointLight(0xffcc88, 0, 14, 2);
    scene.add(this.worldFlashLight);

    // Pooled rocket lights: always in the scene (intensity 0 when idle) so
    // spawning/exploding rockets never changes the light count — changing it
    // would force three.js to recompile every lit shader (browser stall).
    this.rocketLights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xff7733, 0, 14, 2);
      scene.add(l);
      this.rocketLights.push(l);
    }

    this.cooldown = 0;
    this.bloom = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.reloadDur = 0.001;
    this.fireHeld = false;
    this.switching = null;
    this.recoilZ = 0;
    this.recoilV = 0;
    this.zoom = false;
    this.rockets = [];
    this.flashT = 0;
    this.flashI = 0;
    this.bobPhase = 0;
  }

  get current() { return this.entries[this.index]; }

  /** Dispose rockets in flight without detonating them (end-of-mission cleanup). */
  clearRockets() {
    for (const r of this.rockets) r.dispose();
    this.rockets = [];
  }

  reset() {
    for (const e of this.entries) {
      e.mag = e.def.magSize;
      e.reserve = e.def.reserveStart;
    }
    this.clearRockets();
    this.index = 0;
    this.cooldown = 0;
    this.bloom = 0;
    this.reloading = false;
    this.fireHeld = false;
    this.switching = null;
    this.zoom = false;
    this.recoilZ = 0;
    this.recoilV = 0;
    this.game.player.zooming = false;
    this.camera.fov = this.game.player.baseFov;
    this.camera.updateProjectionMatrix();
    this.syncVisibility();
  }

  syncVisibility() {
    const zoomHide = this.zoom && !!this.current.def.zoomFov;
    for (let i = 0; i < this.entries.length; i++) {
      let vis;
      if (this.switching) vis = this.switching.swapped ? i === this.switching.to : i === this.index;
      else vis = i === this.index;
      if (zoomHide && !this.switching) vis = false;
      this.entries[i].vm.group.visible = vis;
    }
  }

  press() { this.fireHeld = true; this.tryFire(); }
  release() { this.fireHeld = false; }

  cycle(d) {
    this.switchTo((this.index + d + this.entries.length) % this.entries.length);
  }

  switchTo(i) {
    if (i === this.index || this.switching) return;
    if (i < 0 || i >= this.entries.length) return;
    this.switching = { to: i, t: 0, dur: 0.42, swapped: false };
    this.reloading = false;
    this.setZoom(false);
    this.syncVisibility();
  }

  setZoom(on) {
    const def = this.current.def;
    const want = !!on && !!def.zoomFov && !this.reloading && !this.switching;
    if (want === this.zoom) return;
    this.zoom = want;
    this.game.player.zooming = want;
    this.syncVisibility();
  }

  reload() {
    const e = this.current;
    if (this.reloading || this.switching) return;
    if (e.mag >= e.def.magSize || e.reserve <= 0) return;
    this.reloading = true;
    this.reloadDur = e.def.reloadTime;
    this.reloadT = this.reloadDur;
    this.setZoom(false);
    this.game.audio.reload();
  }

  completeReload() {
    const e = this.current;
    const need = e.def.magSize - e.mag;
    if (e.reserve === Infinity) e.mag = e.def.magSize;
    else {
      const take = Math.min(need, e.reserve);
      e.mag += take;
      e.reserve -= take;
    }
    this.reloading = false;
    this.game.audio.reloadDone();
  }

  addAmmo() {
    let gained = false;
    for (const e of this.entries) {
      if (e.reserve === Infinity) continue;
      if (e.reserve < e.def.reserveMax) {
        e.reserve = Math.min(e.def.reserveMax, e.reserve + e.def.ammoPick);
        gained = true;
      }
    }
    return gained;
  }

  currentSpread() {
    const def = this.current.def;
    const p = this.game.player;
    let s = def.spread + this.bloom;
    s += p.speedXZ * (def.id === 'sniper' ? 0.006 : 0.0022);
    if (!p.onGround) s += 0.018;
    if (this.zoom && def.zoomFov) s *= 0.06;
    return s;
  }

  tryFire() {
    if (this.switching || this.reloading || this.cooldown > 0) return;
    const e = this.current;
    const def = e.def;
    if (e.mag <= 0) {
      this.game.audio.empty();
      this.cooldown = 0.25;
      if (e.reserve > 0) this.reload();
      return;
    }
    e.mag--;
    this.cooldown = def.fireDelay;
    this.bloom = Math.min(def.bloomMax, this.bloom + def.bloomPerShot);
    this.recoilV += def.recoil.view * 0.42;
    this.game.audio.shot(def.id);
    this.game.hooks.onFire?.(def);

    // fresh matrices, then muzzle world position (vm space == camera space)
    this.scene.updateMatrixWorld();
    this.vmScene.updateMatrixWorld(true);
    const muzzleLocal = e.vm.muzzle.getWorldPosition(new THREE.Vector3());
    const muzzleW = muzzleLocal.clone().applyMatrix4(this.camera.matrixWorld);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const spread = this.currentSpread();

    // muzzle flash (world sprite + lights in both scenes)
    this.flashT = 0.055;
    this.flashI = def.id === 'sniper' ? 16 : def.id === 'tesla' ? 9 : def.id === 'rocket' ? 14 : 7;
    const flashCol = def.id === 'tesla' ? 0x99eeff : def.id === 'rocket' ? 0xff8844 : 0xffdd99;
    this.flash.position.copy(muzzleW);
    this.flash.material.color.set(flashCol);
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar(def.flashSize * (0.8 + Math.random() * 0.5));
    this.flash.visible = true;
    this.worldFlashLight.color.set(flashCol);
    this.worldFlashLight.position.copy(muzzleW);
    this.vmMuzzleLight.position.copy(muzzleLocal);
    this.vmMuzzleLight.color.set(flashCol);

    if (def.kind === 'projectile') {
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const pos = origin.clone()
        .addScaledVector(dir, 0.75)
        .addScaledVector(right, 0.12);
      pos.y -= 0.1;
      this.rockets.push(new Rocket(this, pos, dir, def));
    } else {
      this.hitscan(origin, dir, spread, def, muzzleW);
    }

    if (e.mag === 0 && e.reserve > 0) this.reload();
  }

  hitscan(origin, dir, spread, def, muzzleW) {
    const targets = this.game.enemies.getRayTargets().concat(this.game.world.colliders);
    const d = new THREE.Vector3();
    for (let p = 0; p < def.pellets; p++) {
      d.copy(dir);
      if (spread > 0) {
        d.x += (Math.random() - 0.5) * 2 * spread;
        d.y += (Math.random() - 0.5) * 2 * spread;
        d.z += (Math.random() - 0.5) * 2 * spread;
        d.normalize();
      }
      this.raycaster.set(origin, d);
      this.raycaster.far = def.range;
      const hits = this.raycaster.intersectObjects(targets, false);
      const end = new THREE.Vector3().copy(origin).addScaledVector(d, def.range);
      if (hits.length > 0) {
        const h = hits[0];
        end.copy(h.point);
        const enemy = h.object.userData.enemy;
        if (enemy) {
          const mult = h.object.userData.mult ?? 1;
          const dmg = def.damage * mult;
          this.game.enemies.damageEnemy(enemy, dmg, h.point, d);
          this.game.effects.spark(h.point, def.chain ? 0x99eeff : 0xff9944, 7, 5.5, 0.05);
          if (def.chain) this.chainArc(def, enemy, h.point);
        } else {
          this.game.effects.spark(h.point, 0xcccccc, 5, 4, 0.045);
        }
      }
      const tFrom = new THREE.Vector3().copy(muzzleW).addScaledVector(d, 0.05);
      if (def.chain) this.game.effects.lightning(tFrom, end, def.tracerColor);
      else this.game.effects.tracer(tFrom, end, def.tracerColor);
    }
    this.raycaster.far = Infinity;
  }

  /**
   * Tesla chain: after the primary bolt hits an enemy, arc to up to
   * `chain.jumps` further enemies within `chain.radius`, each jump dealing
   * `chain.falloff` of the previous jump's damage. Never re-hits a target.
   */
  chainArc(def, firstEnemy, firstPoint) {
    const ch = def.chain;
    const struck = new Set([firstEnemy]);
    let from = firstPoint.clone();
    let last = firstEnemy;
    let dmg = def.damage;
    for (let j = 0; j < ch.jumps; j++) {
      const lp = last.group.position;
      let best = null, bestD = ch.radius;
      for (const e of this.game.enemies.enemies) {
        if (e.state === 'dying' || struck.has(e)) continue;
        const ep = e.group.position;
        const dd = Math.hypot(ep.x - lp.x, ep.y - lp.y, ep.z - lp.z);
        if (dd < bestD) { bestD = dd; best = e; }
      }
      if (!best) break;
      struck.add(best);
      dmg *= ch.falloff;
      const bp = best.group.position;
      const to = new THREE.Vector3(bp.x, bp.y + 1.0 * best.baseScale, bp.z);
      const jdir = to.clone().sub(from).normalize();
      this.game.effects.lightning(from, to, def.tracerColor);
      this.game.effects.spark(to, 0x99eeff, 5, 4.5, 0.05);
      this.game.enemies.damageEnemy(best, dmg, to, jdir);
      from = to;
      last = best;
    }
  }

  /**
   * Shared area explosion (rockets AND grenades): visuals, audio,
   * splash damage with falloff, optional self damage + shake.
   * opt: { radius, damage, selfDamage }
   */
  explodeAt(pos, opt) {
    const radius = opt.radius;
    const damage = opt.damage;
    const selfDamage = opt.selfDamage ?? 0;
    this.game.effects.explosion(pos, radius);
    this.game.audio.explosion();
    // explosions are loud: alert every unaware enemy in a wide radius
    this.game.enemies.alertNoise(pos, 46);

    // splash damage to enemies (falloff with distance)
    for (const e of [...this.game.enemies.enemies]) {
      if (e.state === 'dying') continue;
      const ep = e.group.position;
      const d = Math.hypot(ep.x - pos.x, ep.y + 0.9 - pos.y, ep.z - pos.z);
      if (d < radius) {
        const f = 1 - 0.65 * (d / radius);
        const dir = new THREE.Vector3(ep.x - pos.x, 0.3, ep.z - pos.z).normalize();
        this.game.enemies.damageEnemy(e, damage * f, ep, dir);
      }
    }
    // self damage + shake
    const p = this.game.player;
    const d = Math.hypot(p.position.x - pos.x, p.position.y + 0.9 - pos.y, p.position.z - pos.z);
    if (selfDamage > 0 && p.alive && d < radius * 1.1) {
      const f = Math.max(0.25, 1 - d / (radius * 1.1));
      p.takeDamage(selfDamage * f);
      this.game.audio.hurt();
      this.game.hooks.onPlayerHurt?.(pos);
    }
    p.addShake(Math.max(0, 1.1 * (1 - d / (radius * 1.8))));
  }

  explodeRocket(rocket, pos) {
    rocket.dispose();
    const i = this.rockets.indexOf(rocket);
    if (i >= 0) this.rockets.splice(i, 1);
    this.explodeAt(pos, rocket.pdef);
  }

  update(dt) {
    const p = this.game.player;
    this.cooldown -= dt;
    this.bloom = Math.max(0, this.bloom - dt * 0.06);

    if (this.fireHeld && this.current.def.auto) this.tryFire();

    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.completeReload();
    }

    // weapon switch: lower old, swap at midpoint, raise new
    if (this.switching) {
      const sw = this.switching;
      sw.t += dt;
      const q = sw.t / sw.dur;
      if (!sw.swapped && q >= 0.5) {
        sw.swapped = true;
        this.index = sw.to;
        this.syncVisibility();
      }
      if (q >= 1) {
        this.switching = null;
        this.syncVisibility();
      }
    }

    // zoom FOV
    const def = this.current.def;
    const targetFov = (this.zoom && def.zoomFov) ? def.zoomFov : p.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      if (Math.abs(this.camera.fov - targetFov) < 0.05) this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // recoil spring (viewmodel only; aim kick is applied to the player)
    this.recoilV += (-this.recoilZ * 320 - this.recoilV * 24) * dt;
    this.recoilZ = Math.min(this.recoilZ + this.recoilV * dt, 0.12);

    // bob
    const speedF = Math.min(p.speedXZ / 6, 1.3);
    this.bobPhase += dt * (p.onGround ? 7.5 + p.speedXZ * 0.9 : 2);
    const bobX = Math.cos(this.bobPhase) * 0.016 * speedF;
    const bobY = Math.sin(this.bobPhase * 2) * 0.012 * speedF;

    // animate visible viewmodels
    for (const e of this.entries) {
      const g = e.vm.group;
      if (!g.visible) continue;
      let dip = 0;
      if (this.switching) {
        const q = this.switching.t / this.switching.dur;
        dip = q < 0.5 ? q * 2 : (1 - q) * 2;
      }
      let rl = 0;
      if (this.reloading) rl = Math.sin((1 - this.reloadT / this.reloadDur) * Math.PI);
      g.position.set(
        e.base.x + bobX,
        e.base.y + bobY - dip * 0.42 - rl * 0.16,
        e.base.z + this.recoilZ
      );
      g.rotation.set(
        this.recoilZ * 2.8 - dip * 0.9 - rl * 0.65,
        bobX * 0.5 + dip * 0.1,
        rl * 0.3 + bobY * 1.1
      );
    }

    // flash decay
    this.flashT -= dt;
    if (this.flashT <= 0) {
      this.flash.visible = false;
      this.worldFlashLight.intensity = 0;
      this.vmMuzzleLight.intensity = 0;
    } else {
      const k = this.flashT / 0.055;
      this.worldFlashLight.intensity = this.flashI * k;
      this.vmMuzzleLight.intensity = this.flashI * 0.8 * k;
      this.flash.scale.multiplyScalar(1 + dt * 6);
    }

    // rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) this.rockets[i].update(dt);
  }

  hudState() {
    const e = this.current;
    return {
      def: e.def,
      mag: e.mag,
      reserve: e.reserve,
      reloading: this.reloading,
      reloadProgress: this.reloading ? 1 - this.reloadT / this.reloadDur : 0,
      index: this.index,
      zoomActive: this.zoom && !!e.def.zoomFov,
    };
  }
}
