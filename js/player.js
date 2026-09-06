import * as THREE from 'three';
import { collideHorizontal, collideVertical, findStepSupport } from './physics.js';

const _attempt = new THREE.Vector3();

/**
 * First-person player: mouse look (yaw/pitch), accelerated WASD movement,
 * sprint, jump, gravity, AABB collision with step-assist, head bob,
 * camera shake and a short death animation.
 */
export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.baseFov = 75;
    this.position = new THREE.Vector3();  // feet
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.45;
    this.height = 1.8;
    this.eyeHeight = 1.62;
    this.maxHealth = 100;
    this.health = 100;
    this.alive = true;
    this.onGround = false;
    this.walkSpeed = 6.2;
    this.sprintSpeed = 9.8;
    this.groundAccel = 13;
    this.airAccel = 3.5;
    this.jumpVel = 8.6;
    this.gravity = 25;
    this.input = { f: false, b: false, l: false, r: false, jump: false, sprint: false };
    this.sensitivity = 0.0021;
    this.zooming = false;
    this.bobPhase = 0;
    this.bobAmt = 0;
    this.shakeMag = 0;
    this.speedXZ = 0;
    this.deathT = 0;
    this.camera.rotation.order = 'YXZ';
    this.reset();
  }

  reset() {
    this.position.copy(this.world.playerSpawn);
    this.velocity.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.health = this.maxHealth;
    this.alive = true;
    this.onGround = true;
    this.shakeMag = 0;
    this.zooming = false;
    this.deathT = 0;
    this.bobAmt = 0;
    this.speedXZ = 0;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.syncCamera(0, 0, 0, true);
  }

  syncCamera(bobX = 0, bobY = 0, roll = 0, noShake = false) {
    const yaw = this.yaw;
    const rgtX = Math.cos(yaw), rgtZ = -Math.sin(yaw);
    let shX = 0, shY = 0, shP = 0, shY2 = 0, shR = 0;
    if (!noShake && this.shakeMag > 0.001) {
      const sh = this.shakeMag;
      shX = (Math.random() - 0.5) * sh * 0.09;
      shY = (Math.random() - 0.5) * sh * 0.09;
      shP = (Math.random() - 0.5) * sh * 0.02;
      shY2 = (Math.random() - 0.5) * sh * 0.02;
      shR = (Math.random() - 0.5) * sh * 0.045;
    }
    const c = this.camera;
    c.position.set(
      this.position.x + rgtX * (bobX + shX),
      this.position.y + this.eyeHeight + bobY + shY,
      this.position.z + rgtZ * (bobX + shX)
    );
    c.rotation.set(this.pitch + shP, yaw + shY2, roll + shR);
  }

  addLook(dx, dy) {
    const s = this.sensitivity * (this.zooming ? 0.38 : 1);
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -lim, lim);
  }

  addAimKick(up, side) {
    this.pitch += up;
    this.yaw += side;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -lim, lim);
  }

  addShake(m) { this.shakeMag = Math.min(1.5, this.shakeMag + m); }

  heal(v) { this.health = Math.min(this.maxHealth, this.health + v); }

  takeDamage(a) {
    if (!this.alive) return;
    this.health -= a;
    if (this.health <= 0) { this.health = 0; this.alive = false; }
  }

  torsoPoint(out) {
    return out.set(this.position.x, this.position.y + 0.95, this.position.z);
  }

  update(dt) {
    // ---- death animation: sink + roll over ----
    if (!this.alive) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 1.1);
      const c = this.camera;
      c.position.set(
        this.position.x,
        this.position.y + THREE.MathUtils.lerp(this.eyeHeight, 0.3, k),
        this.position.z
      );
      c.rotation.set(THREE.MathUtils.lerp(this.pitch, 0.12, k), this.yaw, 1.3 * k);
      return;
    }

    const inp = this.input;
    const yaw = this.yaw;
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rgtX = Math.cos(yaw), rgtZ = -Math.sin(yaw);

    // desired horizontal direction
    let wx = 0, wz = 0;
    if (inp.f) { wx += fwdX; wz += fwdZ; }
    if (inp.b) { wx -= fwdX; wz -= fwdZ; }
    if (inp.r) { wx += rgtX; wz += rgtZ; }
    if (inp.l) { wx -= rgtX; wz -= rgtZ; }
    const wl = Math.hypot(wx, wz);
    let speed = this.walkSpeed;
    if (wl > 1e-4) {
      wx /= wl; wz /= wl;
      if (inp.sprint && !inp.b) speed = this.sprintSpeed;
    }
    const accel = this.onGround ? this.groundAccel : this.airAccel;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, wx * speed, accel, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, wz * speed, accel, dt);
    this.speedXZ = Math.hypot(this.velocity.x, this.velocity.z);

    if (inp.jump && this.onGround) {
      this.velocity.y = this.jumpVel;
      this.onGround = false;
    }
    this.velocity.y = Math.max(this.velocity.y - this.gravity * dt, -48);
    const fallSpeed = this.velocity.y;

    // ---- horizontal move + collision (+ step assist for stairs/ledges) ----
    const solids = this.world.solids;
    const beforeX = this.position.x, beforeY = this.position.y, beforeZ = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    const blocked = collideHorizontal(this.position, this.radius, this.position.y + 0.06, this.height - 0.12, solids);
    if (blocked && this.onGround) {
      _attempt.set(beforeX + this.velocity.x * dt, beforeY, beforeZ + this.velocity.z * dt);
      const stepY = findStepSupport(_attempt, this.radius, this.height, beforeY, solids);
      if (stepY !== null) {
        this.position.y = stepY;
        this.position.x = _attempt.x;
        this.position.z = _attempt.z;
        collideHorizontal(this.position, this.radius, this.position.y + 0.06, this.height - 0.12, solids);
        if (this.velocity.y < 0) this.velocity.y = 0;
        this.onGround = true;
      }
    }
    const B = this.world.arenaHalf;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -B, B);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -B, B);

    // ---- vertical move + collision ----
    const prevFeet = this.position.y;
    this.position.y += this.velocity.y * dt;
    const wasGround = this.onGround;
    this.onGround = false;
    const vr = collideVertical(prevFeet, this.position, this.radius, this.height, solids, this.velocity);
    if (vr === 'ground') {
      this.onGround = true;
      if (!wasGround && fallSpeed < -15) {
        this.addShake(Math.min(0.25, (-fallSpeed - 15) * 0.012));
      }
    }

    // ---- head bob + shake + camera ----
    const targetBob = this.onGround ? Math.min(this.speedXZ / this.walkSpeed, 1.35) : 0;
    this.bobAmt = THREE.MathUtils.damp(this.bobAmt, targetBob, 8, dt);
    this.bobPhase += dt * (7 + this.speedXZ * 0.85);
    const bobY = Math.sin(this.bobPhase * 2) * 0.03 * this.bobAmt;
    const bobX = Math.cos(this.bobPhase) * 0.026 * this.bobAmt;
    this.shakeMag = Math.max(0, this.shakeMag - dt * (1.4 + this.shakeMag * 2.6));
    this.syncCamera(bobX, bobY, 0);
  }
}
