import * as THREE from 'three';
import { createKit } from './kit.js?v=3';
import { MAPS } from './maps/index.js?v=3';
import { SCENARIOS } from './scenarios.js?v=3';

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
  tex.anisotropy = 8;
  return tex;
}

/** True when an entity box at (x,y,z) overlaps any solid of that map. */
function spotBlocked(solids, arena, x, y, z, halfH, margin) {
  if (Math.abs(x) > arena - 1.8 || Math.abs(z) > arena - 1.8) return true;
  for (const s of solids) {
    if (s.max.y <= y + 0.25 || s.min.y >= y + halfH) continue;
    if (x > s.min.x - margin && x < s.max.x + margin &&
        z > s.min.z - margin && z < s.max.z + margin) return true;
  }
  return false;
}

/**
 * Builds every scenario's arena up front, then activates one at a time.
 *
 * Each map module (js/maps/*.js) describes its layout through the dependency
 * free kit (js/kit.js), which produces both the mesh descriptions and the
 * collision solids. We build all of them once into their own hidden groups:
 * switching scenarios is then just a visibility flip plus swapping which
 * collision arrays / placements `world` exposes, so the player, enemies,
 * pickups and weapons all see the active arena through the same object.
 *
 * Point lights are the one thing that cannot be swapped freely — changing the
 * scene's light count forces three.js to recompile every lit shader. Every map
 * therefore gets padded up to the same pylon-light budget, so the compiled
 * light count never changes between scenarios.
 */
export function createWorld(scene) {
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

  // ---- lights (shared) ----
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

  // ---- materials (shared across every map so shaders compile once) ----
  const MATERIALS = {
    concrete: new THREE.MeshStandardMaterial({ color: 0x565660, roughness: 0.92, metalness: 0.05 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x43434e, roughness: 0.95, metalness: 0.05 }),
    crate: new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3a3a46, roughness: 0.35, metalness: 0.75 }),
    container: new THREE.MeshStandardMaterial({ color: 0x7a4630, roughness: 0.6, metalness: 0.45 }),
    accent: new THREE.MeshStandardMaterial({
      color: 0x0c0c14, emissive: 0x00e5ff, emissiveIntensity: 1.3, roughness: 0.4,
    }),
  };
  const groundTex = makeGridTexture();
  const pulseLights = [];
  const maps = new Map();

  function buildPylon(group, colliders, litPylons, sh) {
    const x = sh.x, z = sh.z, yBase = sh.yBase || 0;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.4, 10), MATERIALS.metal);
    base.position.set(x, yBase + 0.2, z);
    base.castShadow = true; base.receiveShadow = true;
    group.add(base); colliders.push(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.2, 8), MATERIALS.metal);
    pole.position.set(x, yBase + 2.5, z);
    pole.castShadow = true;
    group.add(pole); colliders.push(pole);
    for (const ry of [1.1, 3.6]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 10), MATERIALS.accent);
      ring.position.set(x, yBase + ry, z);
      group.add(ring);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), MATERIALS.accent);
    cap.position.set(x, yBase + 4.7, z);
    group.add(cap);
    if (sh.lit !== false) {
      const light = new THREE.PointLight(0x00e5ff, 7, 24, 2);
      light.position.set(x, yBase + 4.6, z);
      group.add(light);
      litPylons.push(light);
      pulseLights.push({ light, phase: Math.random() * Math.PI * 2 });
    }
  }

  // ================= build every scenario's arena =================
  const stats = {};

  for (const scenario of SCENARIOS) {
    const def = MAPS[scenario.mapId];
    if (!def) throw new Error(`[world] no map registered for scenario "${scenario.id}"`);

    const kit = createKit();
    const layout = def.build(kit);
    const arena = layout.arena;

    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    // ground plane (physics treats y = 0 as the implicit floor)
    const tex = groundTex.clone();
    tex.repeat.set(arena / 2, arena / 2);
    tex.needsUpdate = true;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(arena * 2 + 8, arena * 2 + 8),
      new THREE.MeshStandardMaterial({ map: tex, color: 0x9999aa, roughness: 0.95, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    const colliders = [ground];
    const litPylons = [];
    for (const sh of kit.shapes) {
      if (sh.kind === 'box') {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(sh.w, sh.h, sh.d),
          MATERIALS[sh.m] || MATERIALS.concrete
        );
        mesh.position.set(sh.x, sh.y, sh.z);
        mesh.castShadow = sh.cast;
        mesh.receiveShadow = sh.receive;
        group.add(mesh);
        if (sh.addCollider) colliders.push(mesh);
      } else if (sh.kind === 'pylon') {
        buildPylon(group, colliders, litPylons, sh);
      }
    }

    // ---- validate placements against this map's geometry ----
    const enemyPlacements = [];
    for (const e of layout.enemies) {
      if (spotBlocked(kit.solids, arena, e.x, e.y, e.z, 1.9, 0.7)) {
        console.warn(`[world:${scenario.mapId}] enemy placement skipped (inside geometry):`, e.type, e.x, e.y, e.z);
        continue;
      }
      enemyPlacements.push({
        type: e.type,
        pos: new THREE.Vector3(e.x, e.y, e.z),
        patrol: e.patrol ?? 0,
        tier: e.tier ?? 1,
        yaw: e.yawDeg === undefined ? null : THREE.MathUtils.degToRad(e.yawDeg),
      });
    }

    const pickupPlacements = [];
    for (const p of layout.pickups) {
      if (spotBlocked(kit.solids, arena, p.x, p.y, p.z, 0.9, 0.4)) {
        console.warn(`[world:${scenario.mapId}] pickup placement skipped (inside geometry):`, p.kind, p.x, p.y, p.z);
        continue;
      }
      pickupPlacements.push({ kind: p.kind, pos: new THREE.Vector3(p.x, p.y, p.z) });
    }

    stats[scenario.id] = {
      hostiles: enemyPlacements.length,
      supplies: pickupPlacements.length,
    };

    maps.set(scenario.mapId, {
      group, solids: kit.solids, colliders, litPylons,
      arenaHalf: arena - 1.6,
      playerSpawn: new THREE.Vector3(layout.spawn.x, layout.spawn.y ?? 0, layout.spawn.z),
      spawnYaw: layout.spawn.yaw ?? 0,
      enemyPlacements, pickupPlacements,
    });
  }

  // Pad every map's pylon lights up to the same budget so that switching
  // scenarios never changes the scene's light count (which would recompile
  // every lit shader). Filler lights sit far below the arena at zero intensity.
  const lightBudget = Math.max(...[...maps.values()].map(m => m.litPylons.length));
  for (const m of maps.values()) {
    for (let i = m.litPylons.length; i < lightBudget; i++) {
      m.group.add(new THREE.PointLight(0x00e5ff, 0, 1, 2));
    }
  }

  // ================= the stable world handle =================
  const world = {
    solids: [],
    colliders: [],
    enemyPlacements: [],
    pickupPlacements: [],
    playerSpawn: new THREE.Vector3(),
    arenaHalf: 0,
    mapId: null,
    current: null,
    stats,
  };

  /** Make one scenario's arena the live one. Call before spawning anything. */
  world.activate = function activate(scenarioId) {
    const scenario = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0];
    const m = maps.get(scenario.mapId);
    for (const [id, mp] of maps) mp.group.visible = (id === scenario.mapId);
    world.mapId = scenario.mapId;
    world.current = m;
    world.solids = m.solids;
    world.colliders = m.colliders;
    world.arenaHalf = m.arenaHalf;
    world.playerSpawn.copy(m.playerSpawn);
    world.enemyPlacements = m.enemyPlacements;
    world.pickupPlacements = m.pickupPlacements;
    return world;
  };

  world.update = function update(t) {
    MATERIALS.accent.emissiveIntensity = 1.15 + Math.sin(t * 2.2) * 0.45;
    for (const pl of pulseLights) pl.light.intensity = 6.5 + Math.sin(t * 2.2 + pl.phase) * 2;
  };

  return world;
}
