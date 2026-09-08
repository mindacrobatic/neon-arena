import * as THREE from 'three';

const ARENA = 62; // half-size of the playable floor; walls sit just outside

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
  tex.repeat.set(31, 31); // ~4 world units per tile
  tex.anisotropy = 8;
  return tex;
}

/**
 * Builds "the compound": an explorable multi-zone level.
 *
 *   south  → Arrival plaza (player spawn, safe)
 *   center → Courtyard with a raised command platform (a heavy guards the top,
 *            visible from the plaza gate — you know he's there before you commit)
 *   east   → Industrial yard (shipping containers, a climbable vantage point)
 *   west   → Raised terrace deck with stairs and parapets (sniper spot)
 *   north  → Transit corridor leading to the walled north stronghold
 *            (final fight: bunker roof guards, supply cache at the back)
 *
 * All enemies and supply pickups are PRE-PLACED via level data at the bottom
 * of this file — nothing spawns out of nowhere. The loop routes (courtyard →
 * corridor → gate, or yards → flank alleys → side doors) let you choose your
 * approach to every fight.
 *
 * Returns collision data + placements used by the player, enemies and pickups.
 */
export function createWorld(scene) {
  const solids = [];      // AABB list {min,max} for entity collision
  const colliders = [];   // flat mesh list for bullet raycasts
  const pulseLights = [];

  scene.background = new THREE.Color(0x0a0a16);
  scene.fog = new THREE.Fog(0x141428, 60, 285);

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
  for (let i = 0; i < 550; i++) {
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
  dir.position.set(40, 70, 28);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -88, right: 88, top: 88, bottom: -88, near: 5, far: 260 });
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
  const matContainer = new THREE.MeshStandardMaterial({ color: 0x7a4630, roughness: 0.6, metalness: 0.45 });
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

  const stripOpts = { collide: false, addCollider: false, cast: false };

  /**
   * Straight staircase of stacked boxes descending from a platform edge.
   * (x, z) is the centre of the TOP step; `dir` ('x+'|'x-'|'z+'|'z-') is the
   * direction it descends toward. topH must equal the platform height so the
   * top step is flush; every step is <= 0.56 high (the step-assist limit).
   */
  function addStairs(x, z, width, dir, topH, steps, mat, stepD = 0.7) {
    const stepH = topH / steps;
    for (let i = 0; i < steps; i++) {
      const h = topH - i * stepH;
      const off = i * stepD;
      if (dir === 'z+') addBox(x, 0, z + off, width, h, stepD, mat);
      else if (dir === 'z-') addBox(x, 0, z - off, width, h, stepD, mat);
      else if (dir === 'x+') addBox(x + off, 0, z, stepD, h, width, mat);
      else addBox(x - off, 0, z, stepD, h, width, mat);
    }
  }

  /** Glowing pylon. yBase lets it stand on platforms; `lit: false` skips the
   *  point light (emissive-only decor — keeps the shader light count sane). */
  function addPylon(x, z, yBase = 0, lit = true) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.4, 10), matMetal);
    base.position.set(x, yBase + 0.2, z);
    base.castShadow = true; base.receiveShadow = true;
    scene.add(base); colliders.push(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.2, 8), matMetal);
    pole.position.set(x, yBase + 2.5, z);
    pole.castShadow = true;
    scene.add(pole); colliders.push(pole);
    for (const ry of [1.1, 3.6]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 10), matAccent);
      ring.position.set(x, yBase + ry, z);
      scene.add(ring);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), matAccent);
    cap.position.set(x, yBase + 4.7, z);
    scene.add(cap);
    if (lit) {
      const light = new THREE.PointLight(0x00e5ff, 7, 24, 2);
      light.position.set(x, yBase + 4.6, z);
      scene.add(light);
      pulseLights.push({ light, phase: Math.random() * Math.PI * 2 });
    }
    solids.push({
      min: new THREE.Vector3(x - 0.35, yBase, z - 0.35),
      max: new THREE.Vector3(x + 0.35, yBase + 4.8, z + 0.35),
    });
  }

  // ---- perimeter walls + glowing strips ----
  const H = 8, T = 2;
  addBox(0, 0, -(ARENA + T / 2), (ARENA + T) * 2, H, T, matConcreteDark);
  addBox(0, 0, (ARENA + T / 2), (ARENA + T) * 2, H, T, matConcreteDark);
  addBox(-(ARENA + T / 2), 0, 0, T, H, ARENA * 2, matConcreteDark);
  addBox((ARENA + T / 2), 0, 0, T, H, ARENA * 2, matConcreteDark);
  addBox(0, 3.4, -(ARENA - 0.03), ARENA * 2, 0.12, 0.06, matAccent, stripOpts);
  addBox(0, 3.4, (ARENA - 0.03), ARENA * 2, 0.12, 0.06, matAccent, stripOpts);
  addBox(-(ARENA - 0.03), 3.4, 0, 0.06, 0.12, ARENA * 2, matAccent, stripOpts);
  addBox((ARENA - 0.03), 3.4, 0, 0.06, 0.12, ARENA * 2, matAccent, stripOpts);

  // ============ ZONE A — arrival plaza (south) ============
  // Guard booths flanking the entry street, lit pylons on their roofs.
  addBox(-14, 0, 50, 6, 3.4, 5, matConcreteDark);
  addBox(14, 0, 50, 6, 3.4, 5, matConcreteDark);
  addPylon(-14, 50, 3.4, true);
  addPylon(14, 50, 3.4, true);
  // Low cover walls + a jumpable crate stack near spawn.
  addBox(-6.5, 0, 45, 7, 1.5, 1.1, matConcrete);
  addBox(6.5, 0, 45, 7, 1.5, 1.1, matConcrete);
  addBox(-9, 0, 56, 2.2, 1.2, 2.2, matCrate);
  addBox(-9, 1.2, 56, 2.0, 1.0, 2.0, matCrate);
  addBox(9, 0, 56, 2.2, 1.2, 2.2, matCrate);
  // Neon guide strips along the entry lane (north = -z).
  addBox(-2.2, 0.01, 50.2, 0.14, 0.05, 7.6, matAccent, stripOpts);
  addBox(2.2, 0.01, 50.2, 0.14, 0.05, 7.6, matAccent, stripOpts);

  // ---- plaza → courtyard divider (z = 42) with a grand central gate ----
  addBox(-17, 0, 42, 18, 3.2, 1.4, matConcrete);
  addBox(17, 0, 42, 18, 3.2, 1.4, matConcrete);
  addBox(-17, 2.0, 42.73, 17.6, 0.12, 0.06, matAccent, stripOpts);
  addBox(17, 2.0, 42.73, 17.6, 0.12, 0.06, matAccent, stripOpts);

  // ============ ZONE B — central courtyard ============
  // Raised command platform with stairs on both faces.
  addBox(0, 0, 20, 13, 2.2, 13, matConcrete);
  addStairs(0, 26.85, 5, 'z+', 2.2, 5, matConcrete);
  addStairs(0, 13.15, 5, 'z-', 2.2, 5, matConcrete);
  // Roof comms hut + glowing antenna (landmark you can see from the gate).
  addBox(4.6, 2.2, 16.2, 2.4, 1.3, 2.4, matMetal);
  addBox(-5.5, 3.5, 23.8, 0.12, 1.8, 0.12, matAccent, stripOpts);
  // Crate clusters (west triangle, east stack).
  addBox(-19.2, 0, 30, 2.2, 1.2, 2.2, matCrate);
  addBox(-16.8, 0, 30, 2.2, 1.2, 2.2, matCrate);
  addBox(-18, 0, 32.4, 2.2, 1.2, 2.2, matCrate);
  addBox(16.8, 0, 30, 2.2, 1.2, 2.2, matCrate);
  addBox(19.2, 0, 30, 2.2, 1.2, 2.2, matCrate);
  addBox(18, 0, 32.4, 2.2, 1.2, 2.2, matCrate);
  addBox(19.2, 1.2, 30, 2.0, 1.0, 2.0, matCrate);
  // Mid cover walls + pillars.
  addBox(-13, 0, 16, 8, 2.4, 1.4, matConcrete);
  addBox(13, 0, 16, 8, 2.4, 1.4, matConcrete);
  for (const [x, z] of [[-24, 16], [24, 16], [-24, 36], [24, 36]]) {
    addBox(x, 0, z, 1.6, 5.5, 1.6, matMetal);
  }
  addPylon(0, 33, 0, true); // lights the gate → platform vista

  // ============ ZONE C — east industrial yard ============
  // Divider wall (x = 29) with a doorway at z ∈ [11, 17]; open to the north
  // strip (z < -3) so the yard wraps around into the east flank alley.
  addBox(29, 0, 30, 1.4, 3.6, 26, matConcreteDark);
  addBox(29, 0, 4, 1.4, 3.6, 14, matConcreteDark);
  // Shipping containers.
  addBox(38, 0, 36, 3.2, 4.4, 8, matContainer);
  addBox(46, 0, 30, 8, 4.4, 3.2, matContainer);
  addBox(54, 0, 38, 3.2, 4.4, 7, matContainer);
  addBox(42, 0, 18, 3.2, 4.4, 9, matContainer);
  addBox(50, 0, 10, 7, 4.4, 3.2, matContainer);
  // Low container = climbable vantage point (crate stack steps up to it).
  addBox(55, 0, 22, 6, 2.2, 6, matContainer);
  addBox(50.6, 0, 22, 2.2, 1.2, 2.2, matCrate);
  addBox(50.6, 1.2, 22, 2.0, 1.0, 2.0, matCrate);
  // Barrier + stray crates + yard light.
  addBox(36, 0, 12, 7, 1.6, 1.2, matConcrete);
  addBox(34, 0, 24, 2.4, 1.2, 2.4, matCrate);
  addBox(58, 0, 14, 2.4, 1.2, 2.4, matCrate);
  addPylon(46, 20, 0, true);

  // ============ ZONE D — west terrace ============
  // Divider wall (x = -29), doorway at z ∈ [11, 17].
  addBox(-29, 0, 30, 1.4, 3.6, 26, matConcreteDark);
  addBox(-29, 0, 4, 1.4, 3.6, 14, matConcreteDark);
  // Raised deck with stairs on the east face (from the doorway) and south face.
  addBox(-46, 0, 24, 22, 2.2, 26, matConcrete);
  addStairs(-34.65, 24, 5, 'x+', 2.2, 5, matConcrete);
  addStairs(-46, 10.65, 5, 'z-', 2.2, 5, matConcrete);
  // Parapets (vaultable by the player, not by enemies) with stair gaps.
  addBox(-46, 2.2, 36.5, 22, 0.9, 1.0, matConcreteDark);                 // north edge
  addBox(-56.5, 2.2, 24, 1.0, 0.9, 26, matConcreteDark);                 // west edge
  addBox(-52.75, 2.2, 11.5, 8.5, 0.9, 1.0, matConcreteDark);             // south W
  addBox(-39.25, 2.2, 11.5, 8.5, 0.9, 1.0, matConcreteDark);             // south E
  addBox(-35.5, 2.2, 16.25, 1.0, 0.9, 10.5, matConcreteDark);            // east S
  addBox(-35.5, 2.2, 31.75, 1.0, 0.9, 10.5, matConcreteDark);            // east N
  // Deck shelter + deck light.
  addBox(-52, 2.2, 31, 4.5, 2.0, 4.5, matMetal);
  addPylon(-46, 16, 2.2, true);
  // Ground structures around the deck.
  addBox(-46, 0, 4, 10, 1.8, 1.2, matConcrete);
  addBox(-40, 0, 6, 2.4, 1.2, 2.4, matCrate);
  addBox(-38, 0, 42, 2.2, 1.2, 2.2, matCrate);
  addBox(-35.8, 0, 42, 2.2, 1.2, 2.2, matCrate);
  addPylon(-33, 6, 0, false);

  // ============ ZONE E — north transit corridor (z ∈ [-3, 11]) ============
  addBox(-16, 0, 2, 8, 2.2, 1.2, matConcrete);
  addBox(16, 0, 2, 8, 2.2, 1.2, matConcrete);
  addBox(-8, 0, 7, 2.2, 1.2, 2.2, matCrate);
  addBox(8, 0, 7, 2.2, 1.2, 2.2, matCrate);
  addPylon(-20, 4, 0, false);
  addPylon(20, 4, 0, false);

  // ============ ZONE F — north stronghold ============
  // Gate wall (z = -1): opening at x ∈ [-7, 7], lit pylons flanking it.
  addBox(-20.5, 0, -1, 27, 4.6, 1.6, matConcreteDark);
  addBox(20.5, 0, -1, 27, 4.6, 1.6, matConcreteDark);
  addBox(-20.5, 2.9, -0.16, 26.6, 0.12, 0.06, matAccent, stripOpts);
  addBox(20.5, 2.9, -0.16, 26.6, 0.12, 0.06, matAccent, stripOpts);
  addPylon(-8.8, 1.6, 0, true);
  addPylon(8.8, 1.6, 0, true);
  // Flank walls (x = ±34) with side doors at z ∈ [-34, -26] — reachable from
  // the east/west yards via the flank alleys.
  addBox(-34, 0, -45, 1.6, 4.6, 22, matConcreteDark);
  addBox(-34, 0, -14, 1.6, 4.6, 24, matConcreteDark);
  addBox(34, 0, -45, 1.6, 4.6, 22, matConcreteDark);
  addBox(34, 0, -14, 1.6, 4.6, 24, matConcreteDark);
  // Central bunker with a long stair to its roof (final vantage point).
  addBox(0, 0, -30, 14, 3.52, 10, matConcreteDark);
  addStairs(0, -24.65, 6, 'z+', 3.52, 8, matConcrete);
  addBox(-5.5, 3.52, -33.5, 0.12, 2.0, 0.12, matAccent, stripOpts);   // roof antenna
  addBox(-5, 2.6, -24.96, 3.6, 0.12, 0.06, matAccent, stripOpts);     // face strips
  addBox(5, 2.6, -24.96, 3.6, 0.12, 0.06, matAccent, stripOpts);
  // Entry pocket walls + deep interior walls.
  addBox(-21, 0, -12, 12, 3.4, 1.4, matConcrete);
  addBox(21, 0, -12, 12, 3.4, 1.4, matConcrete);
  addBox(-24, 0, -44, 1.4, 3.4, 16, matConcrete);
  addBox(24, 0, -44, 1.4, 3.4, 16, matConcrete);
  // Crate clusters inside.
  addBox(-12.2, 0, -18, 2.2, 1.2, 2.2, matCrate);
  addBox(-9.8, 0, -18, 2.2, 1.2, 2.2, matCrate);
  addBox(-11, 0, -20.4, 2.2, 1.2, 2.2, matCrate);
  addBox(12.2, 0, -18, 2.2, 1.2, 2.2, matCrate);
  addBox(9.8, 0, -18, 2.2, 1.2, 2.2, matCrate);
  addBox(11, 0, -20.4, 2.2, 1.2, 2.2, matCrate);
  addBox(-14, 0, -48, 2.2, 1.2, 2.2, matCrate);
  addBox(-11.8, 0, -48, 2.2, 1.2, 2.2, matCrate);
  addBox(14, 0, -48, 2.2, 1.2, 2.2, matCrate);
  addBox(11.8, 0, -48, 2.2, 1.2, 2.2, matCrate);
  addBox(-29, 0, -38, 2.4, 1.2, 2.4, matCrate);
  addBox(-29, 1.2, -38, 2.2, 1.0, 2.2, matCrate);
  // North supply cache, flanked by crates.
  addBox(-6, 0, -57, 2.2, 1.2, 2.2, matCrate);
  addBox(6, 0, -57, 2.2, 1.2, 2.2, matCrate);
  // Interior lights.
  addPylon(-13.5, -22.5, 0, true);
  addPylon(13.5, -22.5, 0, true);
  addPylon(0, -42, 0, false);

  // ---- flank alleys (outside the stronghold, loop back to the yards) ----
  addBox(-48, 0, -12, 2.4, 1.2, 2.4, matCrate);
  addBox(-52, 0, -40, 2.2, 1.2, 2.2, matCrate);
  addBox(-44, 0, -52, 2.2, 1.2, 2.2, matCrate);
  addBox(48, 0, -14, 2.4, 1.2, 2.4, matCrate);
  addBox(52, 0, -42, 2.2, 1.2, 2.2, matCrate);
  addPylon(-48, -30, 0, false);
  addPylon(48, -20, 0, false);

  // ================= level data: enemy placements =================
  // [type, x, y, z, patrolRadius, tier = 1, yawDeg = random]
  // y is the floor height under the enemy (0 = ground, 2.2 = deck/platform,
  // 3.52 = bunker roof). patrol 0 = standing guard that scans its surroundings.
  const rawEnemies = [
    // courtyard — the heavy on the command platform is visible from the gate
    ['heavy', -2.5, 2.2, 21, 2, 1, 0],
    ['shooter', -13, 0, 18, 2.5],
    ['shooter', 15, 0, 26, 3],
    ['grunt', -21, 0, 24, 6],
    ['grunt', 21, 0, 14, 5],
    // east industrial yard
    ['grunt', 36, 0, 26, 6],
    ['grunt', 48, 0, 38, 5],
    ['grunt', 56, 0, 8, 4],
    ['shooter', 55, 2.2, 22, 1.5, 1, -90],   // on the low container vantage
    ['shooter', 40, 0, 6, 4],
    // west terrace
    ['shooter', -50, 2.2, 20, 3.5, 1, 90],   // patrolling the deck
    ['grunt', -40, 2.2, 30, 2.5],
    ['grunt', -33, 0, 14, 5],
    ['shooter', -52, 0, 42, 4],
    // north transit corridor
    ['grunt', -6, 0, 4, 7],
    ['grunt', 12, 0, 6, 6],
    // north stronghold (tier 2 elites: +14% HP, +7% damage)
    ['heavy', 0, 3.52, -30.5, 2, 2, 0],      // bunker roof, facing the gate
    ['shooter', -4.5, 3.52, -27, 1.5, 2, 0], // bunker roof
    ['grunt', -22, 0, -7, 4],                // west entry pocket
    ['grunt', -16, 0, -18, 4],
    ['grunt', 16, 0, -18, 4],
    ['shooter', -28, 0, -46, 3],
    ['shooter', 28, 0, -46, 3],
    ['heavy', 0, 0, -52, 3, 2, 0],           // guards the north supply cache
    // flank alleys
    ['grunt', -44, 0, -22, 8],
    ['shooter', 44, 0, -30, 7],
  ];

  // ================= level data: supply placements =================
  // [kind, x, y, z] — permanent (no despawn); health kits and ammo crates
  // are spread so every zone offers some resupply, best caches are guarded.
  const rawPickups = [
    ['health', -13, 0, 14.3],    // behind the west courtyard cover wall
    ['ammo', 20, 0, 36],         // east courtyard pillar
    ['ammo', 46, 0, 36],         // between containers, east yard
    ['health', 58.5, 0, 30],     // east yard outer edge
    ['health', -52, 2.2, 27.5],  // on the west deck, by the shelter
    ['ammo', -46, 0, 2],         // south of the west deck
    ['health', -20, 0, -5.5],    // stronghold west pocket (guarded)
    ['ammo', 20, 0, -5.5],       // stronghold east pocket
    ['health', 0, 0, -58],       // north cache (behind the heavy)
    ['ammo', -4, 0, -58],
    ['ammo', 4, 0, -58],
    ['ammo', -56, 0, -50],       // west flank alley
    ['health', 56, 0, -52],      // east flank alley
  ];

  /** True when an entity box at (x,y,z) overlaps any solid. */
  function spotBlocked(x, y, z, halfH, margin) {
    if (Math.abs(x) > ARENA - 1.8 || Math.abs(z) > ARENA - 1.8) return true;
    for (const s of solids) {
      if (s.max.y <= y + 0.25 || s.min.y >= y + halfH) continue;
      if (x > s.min.x - margin && x < s.max.x + margin &&
          z > s.min.z - margin && z < s.max.z + margin) return true;
    }
    return false;
  }

  const enemyPlacements = [];
  for (const [type, x, y, z, patrol, tier, yawDeg] of rawEnemies) {
    if (spotBlocked(x, y, z, 1.9, 0.7)) {
      console.warn('[world] enemy placement skipped (inside geometry):', type, x, y, z);
      continue;
    }
    enemyPlacements.push({
      type,
      pos: new THREE.Vector3(x, y, z),
      patrol: patrol ?? 0,
      tier: tier ?? 1,
      yaw: yawDeg === undefined ? null : THREE.MathUtils.degToRad(yawDeg),
    });
  }

  const pickupPlacements = [];
  for (const [kind, x, y, z] of rawPickups) {
    if (spotBlocked(x, y, z, 0.9, 0.4)) {
      console.warn('[world] pickup placement skipped (inside geometry):', kind, x, y, z);
      continue;
    }
    pickupPlacements.push({ kind, pos: new THREE.Vector3(x, y, z) });
  }

  const playerSpawn = new THREE.Vector3(0, 0, 54); // arrival plaza, facing north

  function update(t) {
    matAccent.emissiveIntensity = 1.15 + Math.sin(t * 2.2) * 0.45;
    for (const pl of pulseLights) pl.light.intensity = 6.5 + Math.sin(t * 2.2 + pl.phase) * 2;
  }

  return { solids, colliders, enemyPlacements, pickupPlacements, playerSpawn, arenaHalf: ARENA - 1.6, update };
}
