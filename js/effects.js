import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

const sparkGeo = new THREE.BoxGeometry(1, 1, 1);
const tracerGeo = new THREE.CylinderGeometry(0.016, 0.016, 1, 5, 1, true);
const blastGeo = new THREE.SphereGeometry(1, 20, 14);

/** Radial glow texture used for sprites (muzzle flashes, projectiles, pickups). */
export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Lightweight pooled particle/effect manager:
 * sparks (debris/blood), tracers (bullet lines), explosions (fireball + light).
 */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.sparks = [];
    this.tracers = [];
    this.blasts = [];
    this.sparkMats = new Map();
    // Pooled explosion light: stays in the scene permanently (intensity 0
    // when idle) so the light count never changes at runtime — adding/
    // removing lights would force three.js to recompile every lit shader,
    // which stalls the browser on each explosion.
    this.blastLight = new THREE.PointLight(0xffaa44, 0, 26, 2);
    scene.add(this.blastLight);
  }

  _sparkMat(color) {
    let m = this.sparkMats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, fog: false });
      this.sparkMats.set(color, m);
    }
    return m;
  }

  spark(pos, color = 0xffcc66, count = 8, speed = 6, size = 0.06) {
    if (this.sparks.length > 420) return;
    const mat = this._sparkMat(color);
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(sparkGeo, mat);
      const s0 = size * (0.6 + Math.random() * 0.8);
      mesh.scale.setScalar(s0);
      mesh.position.copy(pos);
      const vel = new THREE.Vector3(
        Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5
      ).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel, life: 0, maxLife: 0.35 + Math.random() * 0.3, size0: s0 });
    }
  }

  tracer(from, to, color = 0xffe08a) {
    _v1.subVectors(to, from);
    const len = _v1.length();
    if (len < 0.01) return;
    const mesh = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    mesh.position.copy(from).addScaledVector(_v1, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, _v2.copy(_v1).normalize());
    mesh.scale.set(1, len, 1);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0, maxLife: 0.07 });
  }

  explosion(pos, radius) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffaa33, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const ball = new THREE.Mesh(blastGeo, mat);
    ball.position.copy(pos);
    this.scene.add(ball);
    this.blastLight.position.set(pos.x, pos.y + 0.5, pos.z);
    this.blasts.push({ ball, mat, pos: pos.clone(), life: 0, maxLife: 0.55, radius });
    this.spark(pos, 0xffdd88, Math.min(30, (10 + radius * 2) | 0), radius * 1.6, 0.09);
    this.spark(pos, 0x884422, 10, radius * 0.8, 0.14);
  }

  update(dt) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        this.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
        continue;
      }
      s.vel.y -= 14 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      if (s.mesh.position.y < 0.02) {
        s.mesh.position.y = 0.02;
        s.vel.y *= -0.4; s.vel.x *= 0.7; s.vel.z *= 0.7;
      }
      const k = 1 - s.life / s.maxLife;
      s.mesh.scale.setScalar(s.size0 * k);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life += dt;
      if (t.life >= t.maxLife) {
        this.scene.remove(t.mesh);
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
        continue;
      }
      t.mesh.material.opacity = 0.85 * (1 - t.life / t.maxLife);
    }
    let strongest = null, strongestI = 0;
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.life += dt;
      const k = b.life / b.maxLife;
      if (k >= 1) {
        this.scene.remove(b.ball);
        b.mat.dispose();
        this.blasts.splice(i, 1);
        continue;
      }
      b.ball.scale.setScalar(b.radius * (0.3 + 0.7 * Math.sqrt(k)));
      b.mat.opacity = 0.9 * (1 - k) * (1 - k);
      b.mat.color.setHSL(0.09 - 0.06 * k, 1, 0.55 + 0.2 * (1 - k));
      const inten = 30 * (1 - k);
      if (inten > strongestI) { strongestI = inten; strongest = b; }
    }
    // drive the single pooled light from the strongest active blast
    if (strongest) this.blastLight.position.set(strongest.pos.x, strongest.pos.y + 0.5, strongest.pos.z);
    this.blastLight.intensity = strongestI;
  }

  clear() {
    for (const s of this.sparks) this.scene.remove(s.mesh);
    this.sparks.length = 0;
    for (const t of this.tracers) {
      this.scene.remove(t.mesh);
      t.mesh.material.dispose();
    }
    this.tracers.length = 0;
    for (const b of this.blasts) {
      this.scene.remove(b.ball);
      b.mat.dispose();
    }
    this.blasts.length = 0;
    this.blastLight.intensity = 0;
  }
}
