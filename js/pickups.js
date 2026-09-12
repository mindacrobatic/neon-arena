import * as THREE from 'three';
import { makeGlowTexture } from './effects.js?v=3';

const glowTex = makeGlowTexture();

/**
 * Spinning health / ammo drops. Kill drops expire after a while; supplies
 * placed around the compound at deploy time are permanent (`permanent`).
 */
export class PickupManager {
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks || {};
    this.items = [];
  }

  spawn(pos, kind, permanent = false) {
    const g = new THREE.Group();
    let spriteColor;
    if (kind === 'health') {
      const white = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 });
      const red = new THREE.MeshStandardMaterial({
        color: 0xff2244, emissive: 0xff2244, emissiveIntensity: 0.7, roughness: 0.4,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), white);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.12), red);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.36), red);
      g.add(b, c1, c2);
      g.userData.mats = [white, red];
      spriteColor = 0xff4466;
    } else {
      const olive = new THREE.MeshStandardMaterial({ color: 0x6b6b35, roughness: 0.7 });
      const yellow = new THREE.MeshStandardMaterial({
        color: 0xddaa22, emissive: 0xddaa22, emissiveIntensity: 0.55, roughness: 0.5,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.45), olive);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.47), yellow);
      lid.position.y = 0.2;
      g.add(b, lid);
      g.userData.mats = [olive, yellow];
      spriteColor = 0xffcc44;
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: spriteColor, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.5, fog: false,
    }));
    sprite.scale.setScalar(1.6);
    g.add(sprite);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const baseY = pos.y ?? 0;
    g.position.set(pos.x, baseY + 0.55, pos.z);
    this.scene.add(g);
    this.items.push({
      group: g, kind, t: Math.random() * 6, baseY, sprite,
      life: permanent ? Infinity : 26,
    });
  }

  update(dt, player) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      it.group.rotation.y += dt * 2.2;
      it.group.position.y = it.baseY + 0.55 + Math.sin(it.t * 2.6) * 0.12;
      const dx = it.group.position.x - player.position.x;
      const dz = it.group.position.z - player.position.z;
      const dy = it.group.position.y - (player.position.y + 0.8);
      if (dx * dx + dz * dz + dy * dy < 1.7 * 1.7) {
        if (it.kind === 'health') this.hooks.onHealth?.(30);
        else this.hooks.onAmmo?.();
        this._remove(i);
        continue;
      }
      if (it.t > it.life) { this._remove(i); continue; }
      if (it.life - it.t < 4) it.group.visible = (((it.life - it.t) * 7) | 0) % 2 === 0;
    }
  }

  _remove(i) {
    const it = this.items[i];
    this.scene.remove(it.group);
    (it.group.userData.mats || []).forEach(m => m.dispose());
    it.sprite.material.dispose();
    this.items.splice(i, 1);
  }

  reset() {
    while (this.items.length) this._remove(0);
  }
}
