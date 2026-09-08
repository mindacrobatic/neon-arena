import * as THREE from 'three';
import { pointInSolids } from './physics.js?v=2';

/**
 * Throwable frag grenades — a carried ammo type (not a weapon slot).
 * Arcing throw with player-velocity inheritance, bounces off world solids,
 * blinking fuse, then detonates through the shared explosion routine
 * (WeaponSystem.explodeAt) with splash + self damage.
 * Note: intentionally adds NO lights to the scene — the light count must
 * stay constant to avoid three.js shader recompiles (see weapons/effects).
 */

export const GRENADE = {
  start: 3,          // grenades on a fresh deploy
  max: 6,            // carry capacity
  perPickup: 1,      // gained per ammo crate
  fuse: 2.2,         // seconds from throw to detonation
  throwSpeed: 17,
  gravity: 22,
  radius: 0.12,      // physical radius (collision)
  cooldown: 0.7,     // min time between throws
  explosion: { radius: 5.5, damage: 95, selfDamage: 28 },
};

const GRENADE_GEO = new THREE.SphereGeometry(GRENADE.radius, 10, 8);

class Grenade {
  constructor(sys, pos, vel) {
    this.sys = sys;
    this.fuse = GRENADE.fuse;
    this.vel = vel.clone();
    this.t = 0;
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x2e4a2e, roughness: 0.5, metalness: 0.35,
      emissive: 0xff2222, emissiveIntensity: 0.5,
    });
    this.mesh = new THREE.Mesh(GRENADE_GEO, this.mat);
    this.mesh.position.copy(pos);
    this.mesh.castShadow = true;
    sys.scene.add(this.mesh);
  }

  update(dt) {
    const solids = this.sys.game.world.solids;
    const r = GRENADE.radius;
    const p = this.mesh.position;
    this.t += dt;
    this.fuse -= dt;
    this.vel.y -= GRENADE.gravity * dt;

    // axis-separated movement with bounce off world solids
    let bounce = 0;
    p.x += this.vel.x * dt;
    if (pointInSolids(p, solids, r)) {
      p.x -= this.vel.x * dt;
      bounce = Math.max(bounce, Math.abs(this.vel.x));
      this.vel.x *= -0.42; this.vel.z *= 0.85; this.vel.y *= 0.85;
    }
    p.z += this.vel.z * dt;
    if (pointInSolids(p, solids, r)) {
      p.z -= this.vel.z * dt;
      bounce = Math.max(bounce, Math.abs(this.vel.z));
      this.vel.z *= -0.42; this.vel.x *= 0.85; this.vel.y *= 0.85;
    }
    p.y += this.vel.y * dt;
    if (p.y <= r) {
      p.y = r;
      bounce = Math.max(bounce, Math.abs(this.vel.y));
      this.vel.y = Math.abs(this.vel.y) > 0.9 ? -this.vel.y * 0.45 : 0;
      this.vel.x *= 0.8; this.vel.z *= 0.8;
    } else if (pointInSolids(p, solids, r)) {
      p.y -= this.vel.y * dt;
      bounce = Math.max(bounce, Math.abs(this.vel.y));
      this.vel.y *= -0.42; this.vel.x *= 0.85; this.vel.z *= 0.85;
    }

    // rolling friction when slow on the ground
    if (p.y <= r + 0.01 && Math.abs(this.vel.y) < 0.5) {
      this.vel.x = THREE.MathUtils.damp(this.vel.x, 0, 6, dt);
      this.vel.z = THREE.MathUtils.damp(this.vel.z, 0, 6, dt);
    }
    if (bounce > 2.5) this.sys.game.audio.grenadeBounce(bounce > 8);

    // blinking fuse light (emissive only — no scene lights!)
    const urg = 1 - Math.max(0, this.fuse) / GRENADE.fuse;
    const on = Math.sin(this.t * (10 + urg * 40)) > 0;
    this.mat.emissiveIntensity = on ? 1.5 + urg * 3 : 0.25;

    // tumble
    this.mesh.rotation.x += dt * this.vel.z * 2;
    this.mesh.rotation.z -= dt * this.vel.x * 2;

    if (this.fuse <= 0) this.explode();
  }

  explode() {
    const pos = this.mesh.position.clone();
    this.dispose();
    const i = this.sys.live.indexOf(this);
    if (i >= 0) this.sys.live.splice(i, 1);
    this.sys.game.weapons.explodeAt(pos, GRENADE.explosion);
  }

  dispose() {
    this.sys.scene.remove(this.mesh);
    this.mat.dispose();
  }
}

export class GrenadeSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.count = GRENADE.start;
    this.cooldown = 0;
    this.live = [];
  }

  /** Remove live grenades without detonating (end-of-mission cleanup). */
  clearLive() {
    for (const g of [...this.live]) g.dispose();
    this.live = [];
  }

  reset() {
    this.clearLive();
    this.count = GRENADE.start;
    this.cooldown = 0;
  }

  addAmmo(n = GRENADE.perPickup) {
    this.count = Math.min(GRENADE.max, this.count + n);
  }

  throwGrenade() {
    if (this.cooldown > 0 || this.live.length >= 8) return;
    if (this.count <= 0) {
      this.game.audio.empty();
      this.cooldown = 0.3;
      return;
    }
    const p = this.game.player;
    const camera = p.camera;
    camera.updateMatrixWorld();
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const pos = origin.clone().addScaledVector(dir, 0.45).addScaledVector(right, 0.18);
    pos.y -= 0.12;
    const vel = dir.multiplyScalar(GRENADE.throwSpeed).addScaledVector(p.velocity, 0.35);
    vel.y += 2.2;

    this.count--;
    this.cooldown = GRENADE.cooldown;
    this.live.push(new Grenade(this, pos, vel));
    this.game.audio.grenadeThrow();
  }

  update(dt) {
    this.cooldown -= dt;
    for (let i = this.live.length - 1; i >= 0; i--) this.live[i].update(dt);
  }

  hudState() {
    return { count: this.count, max: GRENADE.max };
  }
}
