import * as THREE from 'three';

const ARENA = 46; // half-size of the playable floor; walls sit just outside

function makeGridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#23242e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 800; i++) {
    g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.035).toFixed(3)})`;
    g.fillRect((Math.random() * 256) | 0, (Math.random() * 256) | 0, 2, 2);
  }
  g.strokeStyle = '#2f3140';
  g.lineWidth = 2;
  for (let i = 32; i < 256; i += 32) {
    g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(256, i + 0.5); g.stroke();
  }
  g.strokeStyle = '#3d4059';
  g.lineWidth = 4;
  g.strokeRect(1, 1, 254, 254);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(23, 23);
  tex.anisotropy = 8;
  return tex;
}

/**
 * Builds the arena: lights, sky, floor, walls, cover, stairs, pylons.
 * Returns collision data used by the player, enemies and projectiles.
 */
export function createWorld(scene) {
  const solids = [];      // AABB list {min,max} for entity collision
  const colliders = [];   // flat mesh list for bullet raycasts
  const pulseLights = [];

  scene.background = new THREE.Color(0x0a0a16);
  scene.fog = new THREE.Fog(0x141428, 55, 230);

  // ---- gradient sky dome ----
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      cTop: { value: new THREE.Color(0x04040c) },
      cMid: { value: new THREE.Color(0x1c2342) },
      cBot: { value: new THREE.Color(0x37294d) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cBot;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(cMid, cTop, pow(h, 0.5)) : mix(cMid, cBot, pow(-h, 0.6));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), skyMat));

  // ---- stars ----
  const starPos = [];
  for (let i = 0; i < 450; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 0.9); // upper hemisphere
    const r = 300;
    starPos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({
    color: 0xaaccff, size: 1.7, sizeAttenuation: false,
    transparent: true, opacity: 0.75, fog: false, depthWrite: false,
  })));

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0x8899dd, 0x2a2a22, 0.65));
  const dir = new THREE.DirectionalLight(0xfff0dc, 1.9);
  dir.position.set(34, 58, 22);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 5, far: 170 });
  dir.shadow.camera.updateProjectionMatrix();
  dir.shadow.bias = -0.0004;
  dir.shadow.normalBias = 0.02;
  scene.add(dir);
  scene.add(dir.target);

  // ---- materials ----
  const matConcrete = new THREE.MeshStandardMaterial({ color: 0x565660, roughness: 0.92, metalness: 0.05 });
  const matConcreteDark = new THREE.MeshStandardMaterial({ color: 0x43434e, roughness: 0.95, metalness: 0.05 });
  const matCrate = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.85 });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x3a3a46, roughness: 0.35, metalness: 0.75 });
  const matAccent = new THREE.MeshStandardMaterial({
    color: 0x0c0c14, emissive: 0x00e5ff, emissiveIntensity: 1.3, roughness: 0.4,
  });

  // ---- floor ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshStandardMaterial({ map: makeGridTexture(), color: 0x9999aa, roughness: 0.95, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  colliders.push(ground);

  function addBox(x, yBase, z, w, h, d, mat, opts = {}) {
    const collide = opts.collide !== false;
    const addCollider = opts.addCollider !== false;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, yBase + h / 2, z);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = opts.receive !== false;
    scene.add(m);
    if (addCollider) colliders.push(m);
    if (collide) {
      solids.push({
        min: new THREE.Vector3(x - w / 2, yBase, z - d / 2),
        max: new THREE.Vector3(x + w / 2, yBase + h, z + d / 2),
      });
    }
    return m;
  }

  // ---- perimeter walls + glowing strips ----
  const H = 7, T = 2;
  addBox(0, 0, -(ARENA + T / 2), (ARENA + T) * 2, H, T, matConcreteDark);
  addBox(0, 0, (ARENA + T / 2), (ARENA + T) * 2, H, T, matConcreteDark);
  addBox(-(ARENA + T / 2), 0, 0, T, H, ARENA * 2, matConcreteDark);
  addBox((ARENA + T / 2), 0, 0, T, H, ARENA * 2, matConcreteDark);
  const stripOpts = { collide: false, addCollider: false, cast: false };
  addBox(0, 3.4, -(ARENA - 0.03), ARENA * 2, 0.12, 0.06, matAccent, stripOpts);
  addBox(0, 3.4, (ARENA - 0.03), ARENA * 2, 0.12, 0.06, matAccent, stripOpts);
  addBox(-(ARENA - 0.03), 3.4, 0, 0.06, 0.12, ARENA * 2, matAccent, stripOpts);
  addBox((ARENA - 0.03), 3.4, 0, 0.06, 0.12, ARENA * 2, matAccent, stripOpts);

  // ---- central platform with stairs on both sides ----
  addBox(0, 0, 0, 10, 2.2, 10, matConcrete);
  for (let i = 0; i < 5; i++) {
    const h = (i + 1) * 0.44;
    const z = 5 + 0.35 + (4 - i) * 0.7;
    addBox(0, 0, z, 4, h, 0.7, matConcrete);
    addBox(0, 0, -z, 4, h, 0.7, matConcrete);
  }

  // ---- mid cover walls ----
  addBox(-16, 0, 12, 10, 2.6, 1.4, matConcrete);
  addBox(16, 0, 12, 10, 2.6, 1.4, matConcrete);
  addBox(-16, 0, -18, 1.4, 2.6, 12, matConcrete);
  addBox(16, 0, -18, 1.4, 2.6, 12, matConcrete);

  // ---- low walls near the south/north spawn edges ----
  addBox(0, 0, 26, 14, 1.8, 1.2, matConcrete);
  addBox(0, 0, -30, 14, 1.8, 1.2, matConcrete);

  // ---- pillars ----
  for (const [x, z] of [[-24, -6], [24, -6], [-24, 6], [24, 6]]) {
    addBox(x, 0, z, 1.6, 5, 1.6, matMetal);
  }

  // ---- corner bunkers ----
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(sx * 36, 0, sz * 41, 12, 3.2, 1.6, matConcrete);
      addBox(sx * 41, 0, sz * 36, 1.6, 3.2, 12, matConcrete);
    }
  }

  // ---- diagonal blocks ----
  addBox(30, 0, -30, 3, 2, 3, matConcrete);
  addBox(-30, 0, 30, 3, 2, 3, matConcrete);

  // ---- crate clusters (single crates are jump-on-able, stacks use the neighbour as a step) ----
  addBox(-9, 0, 18, 2.2, 1.2, 2.2, matCrate);
  addBox(-6.6, 0, 18, 2.2, 1.2, 2.2, matCrate);
  addBox(-7.8, 0, 20.4, 2.2, 1.2, 2.2, matCrate);
  addBox(9, 0, 18, 2.2, 1.2, 2.2, matCrate);
  addBox(9, 1.2, 18, 2.0, 1.0, 2.0, matCrate);
  addBox(6.6, 0, 18, 2.2, 1.2, 2.2, matCrate);
  addBox(7.8, 0, 20.4, 2.2, 1.2, 2.2, matCrate);
  addBox(-22, 0, 32, 2.4, 1.2, 2.4, matCrate);
  addBox(22, 0, -32, 2.4, 1.2, 2.4, matCrate);

  // ---- glowing pylons ----
  function addPylon(x, z) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.4, 10), matMetal);
    base.position.set(x, 0.2, z);
    base.castShadow = true; base.receiveShadow = true;
    scene.add(base); colliders.push(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.2, 8), matMetal);
    pole.position.set(x, 2.5, z);
    pole.castShadow = true;
    scene.add(pole); colliders.push(pole);
    for (const ry of [1.1, 3.6]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 10), matAccent);
      ring.position.set(x, ry, z);
      scene.add(ring);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), matAccent);
    cap.position.set(x, 4.7, z);
    scene.add(cap);
    const light = new THREE.PointLight(0x00e5ff, 7, 24, 2);
    light.position.set(x, 4.6, z);
    scene.add(light);
    pulseLights.push({ light, phase: Math.random() * Math.PI * 2 });
    solids.push({
      min: new THREE.Vector3(x - 0.35, 0, z - 0.35),
      max: new THREE.Vector3(x + 0.35, 4.8, z + 0.35),
    });
  }
  addPylon(-20, -20); addPylon(20, -20); addPylon(-20, 20); addPylon(20, 20);

  // ---- enemy spawn points (validated against solids) ----
  const rawSpawns = [
    [0, -40], [0, 40], [-40, 0], [40, 0],
    [28, -28], [-28, -28], [28, 28], [-28, 28],
    [14, -42], [-14, 42], [42, 14], [-42, -14],
    [-42, 14], [42, -14], [14, 42], [-14, -42],
  ];
  const spawnPoints = [];
  for (const [x, z] of rawSpawns) {
    let ok = true;
    for (const s of solids) {
      if (x > s.min.x - 1.2 && x < s.max.x + 1.2 && z > s.min.z - 1.2 && z < s.max.z + 1.2) { ok = false; break; }
    }
    if (ok) spawnPoints.push(new THREE.Vector3(x, 0, z));
  }

  const playerSpawn = new THREE.Vector3(0, 0, 34);

  function update(t) {
    matAccent.emissiveIntensity = 1.15 + Math.sin(t * 2.2) * 0.45;
    for (const pl of pulseLights) pl.light.intensity = 6.5 + Math.sin(t * 2.2 + pl.phase) * 2;
  }

  return { solids, colliders, spawnPoints, playerSpawn, arenaHalf: ARENA - 1.6, update };
}
