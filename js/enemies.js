import * as THREE from 'three';
import { collideHorizontal, findStepSupport, findGround, pointInSolids } from './physics.js';
import { makeGlowTexture } from './effects.js';

export const ENEMY_TYPES = {
  grunt: {
    hp: 34, speed: 4.3, damage: 13, kind: 'melee', range: 2.4, attackCd: 1.0,
    color: 0xb03a2e, glow: 0xff4422, points: 100, scale: 1.0,
  },
  shooter: {
    hp: 46, speed: 3.2, damage: 9, kind: 'ranged', range: 30, prefMin: 9, prefMax: 18, attackCd: 1.5,
    projSpeed: 26, color: 0x7d3c98, glow: 0xcc66ff, points: 150, scale: 1.0,
  },
  heavy: {
    hp: 150, speed: 2.3, damage: 7, kind: 'ranged', range: 34, prefMin: 7, prefMax: 21, attackCd: 2.6,
    burst: 3, projSpeed: 22, color: 0x1e8449, glow: 0x66ff88, points: 250, scale: 1.3,
  },
};

const PROJ_G = 6; // projectile gravity (used for aim compensation too)
const glowTex = makeGlowTexture();
const PROJ_GEO = new THREE.SphereGeometry(0.14, 10, 8);

const GEO = {
  leg: new THREE.BoxGeometry(0.18, 0.75, 0.22),
  torso: new THREE.BoxGeometry(0.72, 0.85, 0.48),
  head: new THREE.BoxGeometry(0.46, 0.36, 0.4),
  visor: new THREE.BoxGeometry(0.38, 0.09, 0.06),
  core: new THREE.BoxGeometry(0.16, 0.16, 0.06),
  arm: new THREE.BoxGeometry(0.15, 0.62, 0.17),
  shoulder: new THREE.BoxGeometry(0.22, 0.18, 0.24),
  gun: new THREE.BoxGeometry(0.1, 0.1, 0.62),
};
GEO.leg.translate(0, -0.375, 0);  // pivot at hip
GEO.arm.translate(0, -0.31, 0);   // pivot at shoulder

const _ray = new THREE.Raycaster();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();

class Enemy {
  constructor(type, pos, wave, manager) {
    const def = ENEMY_TYPES[type];
    this.type = type;
    this.def = def;
    this.manager = manager;
    this.baseScale = def.scale;
    this.maxHp = def.hp * (1 + (wave - 1) * 0.14);
    this.hp = this.maxHp;
    this.attackDamage = def.damage * (1 + (wave - 1) * 0.07);
    this.speed = def.speed * (1 + Math.min(0.35, (wave - 1) * 0.02));
    this.radius = 0.42 * def.scale;
    this.height = 1.9 * def.scale;

    this.state = 'spawn'; // spawn | chase | dying
    this.t = 0;
    this.attackT = def.attackCd * (0.4 + Math.random() * 0.6);
    this.windT = 0;
    this.swingT = 0;
    this.burst = 0;
    this.burstT = 0;
    this.flash = 0;
    this.phase = Math.random() * 10;
    this.seed = Math.random() * 10;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 1.5 + Math.random() * 2;
    this.wanderT = 0;
    this.wanderDir = 1;
    this.stuckT = 0;
    this.vy = 0;
    this.moving = false;
    this.groundY = pos.y;

    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.group.scale.setScalar(0.01);

    const body = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.45, metalness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x23232c, roughness: 0.6, metalness: 0.4 });
    const glowM = new THREE.MeshStandardMaterial({ color: 0x0c0c12, emissive: def.glow, emissiveIntensity: 2.2, roughness: 0.4 });
    this.mats = [body, dark, glowM];
    this.bodyMat = body;
    this.glowMat = glowM;

    const add = (geo, mat, x, y, z, parent, mult) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.userData.enemy = this;
      m.userData.mult = mult ?? 1;
      (parent || this.group).add(m);
      return m;
    };
    this.legL = add(GEO.leg, dark, -0.16, 0.75, 0, null, 0.85);
    this.legR = add(GEO.leg, dark, 0.16, 0.75, 0, null, 0.85);
    this.torso = add(GEO.torso, body, 0, 1.17, 0);
    add(GEO.core, glowM, 0, 1.25, 0.25);
    this.shL = add(GEO.shoulder, dark, -0.44, 1.5, 0, null, 0.85);
    this.shR = add(GEO.shoulder, dark, 0.44, 1.5, 0, null, 0.85);
    this.armL = add(GEO.arm, dark, -0.44, 1.44, 0, null, 0.85);
    this.armR = add(GEO.arm, dark, 0.44, 1.44, 0, null, 0.85);
    this.head = add(GEO.head, body, 0, 1.79, 0, null, 2.2);
    add(GEO.visor, glowM, 0, 0.02, 0.21, this.head);
    if (def.kind === 'ranged') {
      add(GEO.gun, dark, 0, -0.62, 0.28, this.armR, 0.85);
      this.armR.rotation.x = -Math.PI / 2 * 0.95;
      this.armL.rotation.x = -0.3;
    }
    this.hitMeshes = [this.legL, this.legR, this.torso, this.head, this.armL, this.armR, this.shL, this.shR];

    // floating health bar (billboarded)
    this.hpBar = new THREE.Object3D();
    this.hpBar.position.set(0, 2.42, 0);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x0a0a12, transparent: true, opacity: 0.75, depthWrite: false });
    this.hpFillMat = new THREE.MeshBasicMaterial({ color: 0x44ff66, transparent: true, opacity: 0.95, depthWrite: false });
    const bgGeo = new THREE.PlaneGeometry(0.95, 0.11);
    const fillGeo = new THREE.PlaneGeometry(0.88, 0.06);
    fillGeo.translate(0.44, 0, 0.001); // anchor left for scale-x fill
    const bg = new THREE.Mesh(bgGeo, bgMat);
    this.hpFill = new THREE.Mesh(fillGeo, this.hpFillMat);
    this.hpFill.position.set(-0.44, 0, 0.002);
    this.hpBar.add(bg);
    this.hpBar.add(this.hpFill);
    this.group.add(this.hpBar);
    this.barMats = [bgMat, this.hpFillMat];
    this.barGeos = [bgGeo, fillGeo];

    manager.scene.add(this.group);
  }

  damage(amount) {
    if (this.state === 'dying') return false;
    this.hp -= amount;
    this.flash = 1;
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  die() {
    this.state = 'dying';
    this.t = 0;
    this.groundY = this.group.position.y;
    this.hpBar.visible = false;
    for (const m of this.mats) m.transparent = true;
  }

  hasLOS(ctx) {
    if (!ctx.player.alive) return false;
    const gp = this.group.position;
    _v1.set(gp.x, gp.y + 1.62 * this.baseScale, gp.z);
    ctx.player.torsoPoint(_v2);
    _v3.subVectors(_v2, _v1);
    const d = _v3.length();
    if (d < 0.01) return true;
    _v3.normalize();
    _ray.set(_v1, _v3);
    _ray.far = Math.max(0.1, d - 0.6);
    const hits = _ray.intersectObjects(ctx.colliders, false);
    _ray.far = Infinity;
    return hits.length === 0;
  }

  fire(ctx, dist) {
    const gp = this.group.position;
    const def = this.def;
    const p = ctx.player;
    _v1.set(gp.x, gp.y + 1.62 * this.baseScale, gp.z);
    const tt = dist / def.projSpeed;
    _v2.set(
      p.position.x + p.velocity.x * tt * 0.55,
      p.position.y + 1.0 + 0.5 * PROJ_G * tt * tt * 0.75,
      p.position.z + p.velocity.z * tt * 0.55
    );
    ctx.fireProjectile(_v1, _v2, this);
  }

  updateBar(ctx) {
    const frac = Math.max(0, this.hp / this.maxHp);
    this.hpFill.scale.x = Math.max(frac, 0.001);
    this.hpFillMat.color.setHSL(0.33 * frac, 0.95, 0.5);
    _q1.copy(this.group.quaternion).invert();
    this.hpBar.quaternion.copy(_q1).multiply(ctx.camera.quaternion);
  }

  update(dt, ctx) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 4.5);
    this.bodyMat.emissive.setScalar(this.flash * 0.9);
    this.glowMat.emissiveIntensity = 2.0 + Math.sin(ctx.time * 6 + this.seed) * 0.5 + this.flash * 4;

    // ---- materializing ----
    if (this.state === 'spawn') {
      const k = Math.min(1, this.t / 0.55);
      const s = this.baseScale * (1 - Math.pow(1 - k, 3));
      this.group.scale.setScalar(Math.max(0.01, s));
      this.glowMat.emissiveIntensity = 2 + (1 - k) * 7;
      if (k >= 1) {
        this.state = 'chase';
        this.t = 0;
        this.group.scale.setScalar(this.baseScale);
      }
      this.updateBar(ctx);
      return;
    }

    // ---- dying: topple, sink, fade ----
    if (this.state === 'dying') {
      const k = Math.min(1, this.t / 0.45);
      this.group.rotation.x = -Math.PI / 2 * (1 - Math.pow(1 - k, 2));
      const k2 = Math.max(0, (this.t - 0.7) / 1.0);
      this.group.position.y = this.groundY - k2 * 1.5;
      const op = 1 - k2;
      for (const m of this.mats) m.opacity = op;
      if (this.t > 1.85) this.manager.remove(this);
      return;
    }

    // ---- chase / attack ----
    const gp = this.group.position;
    const pp = ctx.player.position;
    const dx = pp.x - gp.x, dz = pp.z - gp.z;
    const dy = pp.y - gp.y;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    let moveX = 0, moveZ = 0, wantMove = false;

    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = 1.6 + Math.random() * 2.2; }

    if (ctx.player.alive) {
      if (this.wanderT > 0) {
        this.wanderT -= dt;
        moveX = -nz * this.wanderDir + nx * 0.35;
        moveZ = nx * this.wanderDir + nz * 0.35;
        wantMove = true;
      } else if (this.def.kind === 'melee') {
        if (dist > this.def.range * 0.85) { moveX = nx; moveZ = nz; wantMove = true; }
      } else {
        if (dist > this.def.prefMax) { moveX = nx; moveZ = nz; wantMove = true; }
        else if (dist < this.def.prefMin) { moveX = -nx; moveZ = -nz; wantMove = true; }
        else { moveX = -nz * this.strafeDir; moveZ = nx * this.strafeDir; wantMove = true; }
      }
    }

    // separation from other enemies
    for (const other of this.manager.enemies) {
      if (other === this || other.state === 'dying') continue;
      const ox = gp.x - other.group.position.x, oz = gp.z - other.group.position.z;
      const d2 = ox * ox + oz * oz;
      const minD = (this.radius + other.radius) * 1.5;
      if (d2 < minD * minD && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        moveX += (ox / d) * (minD - d) * 2.4;
        moveZ += (oz / d) * (minD - d) * 2.4;
        wantMove = true;
      }
    }

    // movement with collision + step assist + stuck wandering
    this.moving = false;
    const ml = Math.hypot(moveX, moveZ);
    if (ml > 0.01) {
      moveX /= ml; moveZ /= ml;
      const bx = gp.x, bz = gp.z;
      gp.x += moveX * this.speed * dt;
      gp.z += moveZ * this.speed * dt;
      const blocked = collideHorizontal(gp, this.radius, gp.y + 0.05, this.height * 0.9, ctx.solids);
      if (blocked) {
        _v4.set(bx + moveX * this.speed * dt, gp.y, bz + moveZ * this.speed * dt);
        const stepY = findStepSupport(_v4, this.radius, this.height, gp.y, ctx.solids);
        if (stepY !== null) {
          gp.y = stepY;
          gp.x = _v4.x; gp.z = _v4.z;
          collideHorizontal(gp, this.radius, gp.y + 0.05, this.height * 0.9, ctx.solids);
        }
      }
      const movedSq = (gp.x - bx) * (gp.x - bx) + (gp.z - bz) * (gp.z - bz);
      const want = this.speed * dt;
      if (movedSq < want * want * 0.16) this.stuckT += dt;
      else this.stuckT = Math.max(0, this.stuckT - dt * 2);
      if (this.stuckT > 0.85 && this.wanderT <= 0) {
        this.wanderT = 0.7 + Math.random() * 0.7;
        this.wanderDir = Math.random() < 0.5 ? 1 : -1;
        this.stuckT = 0;
      }
      this.moving = movedSq > 1e-8;
    } else if (wantMove) {
      this.moving = false;
    }

    // gravity / ground snapping (lets enemies walk down steps and off ledges)
    const sup = findGround(gp.x, gp.z, gp.y, this.radius, ctx.solids, 0.56, 6);
    if (sup > gp.y + 0.02) { gp.y = sup; this.vy = 0; }
    else if (sup < gp.y - 0.02) {
      this.vy -= 22 * dt;
      gp.y += this.vy * dt;
      if (gp.y <= sup) { gp.y = sup; this.vy = 0; }
    } else { gp.y = sup; this.vy = 0; }

    const B = ctx.arenaHalf;
    gp.x = THREE.MathUtils.clamp(gp.x, -B, B);
    gp.z = THREE.MathUtils.clamp(gp.z, -B, B);

    // face the player
    if (ctx.player.alive) {
      const targetYaw = Math.atan2(dx, dz);
      let da = targetYaw - this.group.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.group.rotation.y += da * (1 - Math.exp(-10 * dt));
    }

    // walk animation
    if (this.moving) this.phase += dt * this.speed * 2.3;
    const sw = this.moving ? Math.sin(this.phase) * 0.62 : 0;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;

    // attacks
    if (this.def.kind === 'melee') {
      this.attackT -= dt;
      if (this.windT > 0) {
        this.windT -= dt;
        this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, -2.5, 20, dt);
        this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, -sw * 0.6, 10, dt);
        if (this.windT <= 0) {
          this.swingT = 0.3;
          if (ctx.player.alive && dist < this.def.range + 0.9 && Math.abs(dy) < 1.7) {
            ctx.damagePlayer(this.attackDamage, gp);
          }
        }
      } else if (this.swingT > 0) {
        this.swingT -= dt;
        this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, -0.2, 24, dt);
        this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, sw * 0.6, 10, dt);
      } else {
        this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, sw * 0.6, 10, dt);
        this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, -sw * 0.6, 10, dt);
        if (this.attackT <= 0 && ctx.player.alive && dist < this.def.range && Math.abs(dy) < 1.7) {
          this.windT = 0.32;
          this.attackT = this.def.attackCd;
        }
      }
    } else {
      this.attackT -= dt;
      if (this.burst > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.burst--;
          this.burstT = 0.16;
          if (this.hasLOS(ctx)) this.fire(ctx, dist);
        }
      }
      if (this.attackT <= 0 && ctx.player.alive && dist < this.def.range) {
        if (this.hasLOS(ctx)) {
          this.fire(ctx, dist);
          if (this.def.burst) { this.burst = this.def.burst - 1; this.burstT = 0.16; }
          this.attackT = this.def.attackCd * (0.85 + Math.random() * 0.3);
        } else {
          this.attackT = 0.25;
        }
      }
      this.armR.rotation.x = -Math.PI / 2 * 0.95;
      this.armL.rotation.x = THREE.MathUtils.damp(
        this.armL.rotation.x,
        -0.3 + (this.moving ? Math.sin(this.phase * 0.7) * 0.15 : 0),
        8, dt
      );
    }

    this.updateBar(ctx);
  }
}

function waveComposition(n) {
  const count = Math.min(26, Math.round(4 + n * 2.2));
  if (n === 1) return new Array(count).fill('grunt');
  const wg = 6;
  const ws = n >= 2 ? 2.2 + n * 0.35 : 0;
  const wh = n >= 3 ? Math.min(3.5, (n - 2) * 0.7) : 0;
  const total = wg + ws + wh;
  const out = [];
  for (let i = 0; i < count; i++) {
    let r = Math.random() * total;
    if ((r -= wg) <= 0) out.push('grunt');
    else if ((r -= ws) <= 0) out.push('shooter');
    else out.push('heavy');
  }
  return out;
}

/**
 * Spawns waves, updates all enemies + enemy projectiles,
 * and is the single entry point for damaging enemies.
 */
export class EnemyManager {
  constructor(scene, world, effects, hooks) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.hooks = hooks || {};
    this.enemies = [];
    this.projectiles = [];
    this.wave = 0;
    this.spawnQueue = [];
    this.spawnT = 0;
    this.betweenT = 2.0;
    this.active = false;
  }

  get remaining() { return this.enemies.length + this.spawnQueue.length; }

  reset() {
    for (const e of [...this.enemies]) this.remove(e);
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mat.dispose();
      p.sprMat.dispose();
    }
    this.projectiles = [];
    this.wave = 0;
    this.spawnQueue = [];
    this.active = false;
    this.betweenT = 2.0;
  }

  startWave(n) {
    this.wave = n;
    this.spawnQueue = waveComposition(n);
    this.spawnT = 0.6;
    this.active = true;
    this.hooks.onWaveStart?.(n);
  }

  remove(e) {
    this.scene.remove(e.group);
    e.mats.forEach(m => m.dispose());
    e.barMats.forEach(m => m.dispose());
    e.barGeos.forEach(g => g.dispose());
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  spawnOne(type, player) {
    const pts = this.world.spawnPoints;
    const far = pts.filter(p => p.distanceTo(player.position) > 18);
    const pool = far.length ? far : pts;
    const pt = pool[(Math.random() * pool.length) | 0];
    this.enemies.push(new Enemy(type, pt.clone(), this.wave, this));
  }

  spawnProjectile(from, aim, enemy) {
    const def = enemy.def;
    const dir = new THREE.Vector3().copy(aim).sub(from).normalize();
    const mat = new THREE.MeshBasicMaterial({ color: def.glow, fog: false });
    const mesh = new THREE.Mesh(PROJ_GEO, mat);
    mesh.position.copy(from).addScaledVector(dir, 0.7);
    const sprMat = new THREE.SpriteMaterial({
      map: glowTex, color: def.glow, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.85, fog: false,
    });
    const spr = new THREE.Sprite(sprMat);
    spr.scale.setScalar(0.85);
    mesh.add(spr);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh, mat, sprMat,
      vel: dir.multiplyScalar(def.projSpeed),
      damage: enemy.attackDamage,
      gravity: PROJ_G,
      life: 0,
      color: def.glow,
    });
    this.effects.spark(mesh.position, def.glow, 4, 2.5, 0.04);
  }

  update(dt, player, camera) {
    // wave flow
    if (this.active) {
      if (this.spawnQueue.length > 0) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnOne(this.spawnQueue.shift(), player);
          this.spawnT = 0.55;
        }
      } else if (this.enemies.length === 0) {
        this.active = false;
        this.betweenT = 4.5;
        this.hooks.onWaveComplete?.(this.wave);
      }
    } else {
      this.betweenT -= dt;
      if (this.betweenT <= 0) this.startWave(this.wave + 1);
    }

    const ctx = {
      player, camera,
      solids: this.world.solids,
      colliders: this.world.colliders,
      arenaHalf: this.world.arenaHalf,
      time: performance.now() / 1000,
      damagePlayer: (amt, pos) => this.hooks.onPlayerDamage?.(amt, pos),
      fireProjectile: (from, aim, enemy) => this.spawnProjectile(from, aim, enemy),
    };
    for (let i = this.enemies.length - 1; i >= 0; i--) this.enemies[i].update(dt, ctx);
    this.updateProjectiles(dt, player);
  }

  updateProjectiles(dt, player) {
    const torso = player.torsoPoint(_v3);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life += dt;
      pr.vel.y -= pr.gravity * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      const p = pr.mesh.position;
      let done = false;
      if (p.y <= 0.14 || pointInSolids(p, this.world.solids, 0.08) || pr.life > 4.5) {
        this.effects.spark(p, pr.color, 6, 3.5, 0.05);
        done = true;
      } else if (player.alive) {
        const dx = p.x - torso.x, dy = p.y - torso.y, dz = p.z - torso.z;
        if (dx * dx + dy * dy + dz * dz < 0.81) {
          this.hooks.onPlayerDamage?.(pr.damage, p.clone());
          this.effects.spark(p, 0xff4444, 8, 4, 0.05);
          done = true;
        }
      }
      if (done) {
        this.scene.remove(pr.mesh);
        pr.mat.dispose();
        pr.sprMat.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  /** Flat list of currently-hittable enemy meshes (for hitscan raycasts). */
  getRayTargets() {
    const out = [];
    for (const e of this.enemies) {
      if (e.state === 'dying') continue;
      for (const m of e.hitMeshes) out.push(m);
    }
    return out;
  }

  /** Apply damage; fires hooks. Returns true when the hit killed. */
  damageEnemy(enemy, amount, point, dir) {
    if (enemy.state === 'dying') return false;
    const killed = enemy.damage(amount);
    this.hooks.onHitEnemy?.(enemy, killed, point, dir);
    if (killed) this.hooks.onKill?.(enemy);
    return killed;
  }
}
