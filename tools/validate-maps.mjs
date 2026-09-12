/**
 * Headless level validator — `npm run validate`.
 *
 * Replays every map through the same dependency-free kit the browser uses,
 * then checks the things that are painful to eyeball in a 3D scene:
 *
 *   1. every enemy / pickup placement sits in clear space (not inside geometry)
 *   2. the player spawn is clear
 *   3. every enemy and pickup is REACHABLE on foot from the spawn, using the
 *      same rules the entities do: 0.56 m step-up, gravity for drops, a 1.8 m
 *      tall body that cannot pass through walls
 *   4. no enemy is camping the player spawn
 *
 * Reachability is a flood fill over a 0.25 m grid of "stand levels" (ground
 * plus every solid top with headroom). Movement allows the 0.56 m step-assist
 * plus the player's ~1.45 m jump, and gravity for drops — anything a flood
 * fill cannot reach, a player cannot reach either.
 */
import { createKit } from '../js/kit.js';
import { SCENARIOS, DIFFICULTIES, getScenario } from '../js/scenarios.js';
import { build as compound } from '../js/maps/compound.js';
import { build as foundry } from '../js/maps/foundry.js';
import { build as spire } from '../js/maps/spire.js';
import { build as catacomb } from '../js/maps/catacomb.js';

const MAP_MODULES = { compound, foundry, spire, catacomb };

const STEP = 0.25;         // grid resolution (m)
const CORE_R = 0.16;       // "can the body core stand here" radius
const PLAYER_H = 1.8;
const MAX_CLIMB = 1.4;     // step-assist (0.56) or a jump (~1.45) gets you this far up
const MAX_DROP = 14;       // a fall deeper than this is treated as out of bounds
const MAX_LEVEL = 15;      // ignore anything above this
const BUCKET_PAD = 1.0;

const problems = [];
const warnings = [];

function fail(msg) { problems.push(msg); }
function warn(msg) { warnings.push(msg); }

/** Same test the game applies at load time (js/world.js spotBlocked). */
function spotBlocked(solids, arena, x, y, z, halfH, margin) {
  if (Math.abs(x) > arena - 1.8 || Math.abs(z) > arena - 1.8) return true;
  for (const s of solids) {
    if (s.max.y <= y + 0.25 || s.min.y >= y + halfH) continue;
    if (x > s.min.x - margin && x < s.max.x + margin &&
        z > s.min.z - margin && z < s.max.z + margin) return true;
  }
  return false;
}

function buildBuckets(solids) {
  const b = new Map();
  for (const s of solids) {
    const i0 = Math.floor((s.min.x - BUCKET_PAD) / STEP);
    const i1 = Math.ceil((s.max.x + BUCKET_PAD) / STEP);
    const k0 = Math.floor((s.min.z - BUCKET_PAD) / STEP);
    const k1 = Math.ceil((s.max.z + BUCKET_PAD) / STEP);
    for (let i = i0; i <= i1; i++) {
      for (let k = k0; k <= k1; k++) {
        const key = `${i},${k}`;
        let arr = b.get(key);
        if (!arr) { arr = []; b.set(key, arr); }
        arr.push(s);
      }
    }
  }
  return b;
}

/**
 * Circle-vs-AABB in XZ with vertical overlap.
 *
 * The radius here is the body CORE, not the full 0.45 m collision radius. The
 * real game pushes the player's circle flush against a riser and then lets
 * step-assist lift them, so a player standing on a 0.7 m step really does have
 * their centre ~0.2 m from the next riser. Testing with 0.45 would reject every
 * staircase.
 */
function bodyBlocked(near, x, z, feetY) {
  const top = feetY + PLAYER_H - 0.12;
  for (const s of near) {
    if (s.max.y <= feetY + 0.06 || s.min.y >= top) continue;
    const cx = Math.min(Math.max(x, s.min.x), s.max.x);
    const cz = Math.min(Math.max(z, s.min.z), s.max.z);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < CORE_R * CORE_R) return true;
  }
  return false;
}

/**
 * Every height at (x,z) where the player could stand with headroom.
 * A solid's top counts if the point is within 0.315 m of its footprint,
 * matching the game's ground snap (`findGround` uses radius * 0.7).
 */
function standLevels(buckets, cache, i, k) {
  const key = `${i},${k}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const x = i * STEP, z = k * STEP;
  const near = buckets.get(key) || [];
  const tops = new Set([0]);
  for (const s of near) {
    if (x > s.min.x - 0.315 && x < s.max.x + 0.315 &&
        z > s.min.z - 0.315 && z < s.max.z + 0.315) {
      tops.add(Math.round(s.max.y * 1000) / 1000);
    }
  }
  const out = [];
  for (const y of tops) {
    if (y < -0.01 || y > MAX_LEVEL) continue;
    if (!bodyBlocked(near, x, z, y + 0.06)) out.push(y);
  }
  out.sort((a, b) => a - b);
  cache.set(key, out);
  return out;
}

function floodFill(solids, arena, spawn) {
  const buckets = buildBuckets(solids);
  const cache = new Map();
  const reachable = new Map(); // "i,k" -> [y...]

  const startLevels = standLevels(buckets, cache, Math.round(spawn.x / STEP), Math.round(spawn.z / STEP));
  if (!startLevels.length) return { reachable, ok: false };

  const queue = [];
  const push = (i, k, y) => {
    const kk = `${i},${k}`;
    let arr = reachable.get(kk);
    if (!arr) { arr = []; reachable.set(kk, arr); }
    if (arr.some(v => Math.abs(v - y) < 0.02)) return;
    arr.push(y);
    queue.push([i, k, y]);
  };

  const i0 = Math.round(spawn.x / STEP);
  const k0 = Math.round(spawn.z / STEP);
  for (const y of startLevels) push(i0, k0, y);

  const limit = Math.floor(arena / STEP) + 1;
  while (queue.length) {
    const [i, k, y] = queue.pop();
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nk = k + dk;
      if (Math.abs(ni) > limit || Math.abs(nk) > limit) continue;
      for (const ny of standLevels(buckets, cache, ni, nk)) {
        if (ny > y + MAX_CLIMB + 0.001) continue;  // too tall to step or jump onto
        if (ny < y - MAX_DROP) continue;           // sanity: bottomless drop
        push(ni, nk, ny);
      }
    }
  }
  return { reachable, ok: true };
}

function reachableAt(reach, x, y, z) {
  const i0 = Math.round(x / STEP), k0 = Math.round(z / STEP);
  for (let di = -3; di <= 3; di++) {
    for (let dk = -3; dk <= 3; dk++) {
      const arr = reach.get(`${i0 + di},${k0 + dk}`);
      if (!arr) continue;
      if (arr.some(v => Math.abs(v - y) <= 0.6)) return true;
    }
  }
  return false;
}

// ============================ run ============================

console.log('NEON COMPOUND — level validation\n');

console.log('scenarios');
for (const s of SCENARIOS) {
  if (!MAP_MODULES[s.mapId]) fail(`scenario "${s.id}" references unknown map "${s.mapId}"`);
}
for (const d of DIFFICULTIES) {
  if (!(d.enemyHp > 0 && d.enemyDamage > 0 && d.enemySpeed > 0 && d.ammo > 0)) {
    fail(`difficulty "${d.id}" has a non-positive multiplier`);
  }
}

for (const scenario of SCENARIOS) {
  const mod = MAP_MODULES[scenario.mapId];
  const kit = createKit();
  const layout = mod(kit);
  const arena = layout.arena;
  const tag = `${scenario.name} [${scenario.mapId}]`;

  const badEnemies = layout.enemies.filter(e => spotBlocked(kit.solids, arena, e.x, e.y, e.z, 1.9, 0.7));
  const badPickups = layout.pickups.filter(p => spotBlocked(kit.solids, arena, p.x, p.y, p.z, 0.9, 0.4));
  for (const e of badEnemies) fail(`${tag}: enemy inside geometry — ${e.type} @ ${e.x},${e.y},${e.z}`);
  for (const p of badPickups) fail(`${tag}: pickup inside geometry — ${p.kind} @ ${p.x},${p.y},${p.z}`);

  if (spotBlocked(kit.solids, arena, layout.spawn.x, layout.spawn.y ?? 0, layout.spawn.z, 1.9, 0.5)) {
    fail(`${tag}: spawn is inside geometry @ ${layout.spawn.x},${layout.spawn.z}`);
  }

  const duplicate = new Set();
  for (const e of layout.enemies) {
    const key = `${e.type}:${e.x},${e.y},${e.z}`;
    if (duplicate.has(key)) warn(`${tag}: duplicate enemy placement ${key}`);
    duplicate.add(key);
  }

  const { reachable, ok } = floodFill(kit.solids, arena, layout.spawn);
  if (!ok) fail(`${tag}: spawn has no standing room`);

  let unreachableEnemies = 0;
  for (const e of layout.enemies) {
    if (!reachableAt(reachable, e.x, e.y, e.z)) {
      unreachableEnemies++;
      fail(`${tag}: enemy NOT reachable — ${e.type} @ ${e.x},${e.y},${e.z}`);
    }
  }
  let unreachablePickups = 0;
  for (const p of layout.pickups) {
    if (!reachableAt(reachable, p.x, p.y, p.z)) {
      unreachablePickups++;
      fail(`${tag}: pickup NOT reachable — ${p.kind} @ ${p.x},${p.y},${p.z}`);
    }
  }

  // spawn safety: nothing should be practically on top of the player at deploy
  let closest = Infinity, closestType = '';
  for (const e of layout.enemies) {
    const d = Math.hypot(e.x - layout.spawn.x, e.z - layout.spawn.z);
    if (d < closest) { closest = d; closestType = e.type; }
  }
  if (closest < 12) warn(`${tag}: ${closestType} is only ${closest.toFixed(1)} m from spawn`);

  console.log(
    `  ${tag.padEnd(30)} arena ${String(arena).padStart(2)}  ` +
    `enemies ${String(layout.enemies.length).padStart(2)}  ` +
    `supplies ${String(layout.pickups.length).padStart(2)}  ` +
    `solids ${String(kit.solids.length).padStart(3)}  ` +
    `unreachable ${unreachableEnemies + unreachablePickups}`
  );
}

console.log('\ndifficulties');
for (const d of DIFFICULTIES) {
  console.log(
    `  ${d.name.padEnd(10)} hp x${d.enemyHp}  dmg x${d.enemyDamage}  ` +
    `speed x${d.enemySpeed}  playerDmg x${d.playerDamage}  ammo x${d.ammo}  score x${d.score}`
  );
}

if (warnings.length) {
  console.log('\nwarnings');
  for (const w of warnings) console.log(`  ! ${w}`);
}

if (problems.length) {
  console.log('\nFAILURES');
  for (const p of problems) console.log(`  x ${p}`);
  console.log(`\n${problems.length} problem(s) found.`);
  process.exitCode = 1;
} else {
  console.log('\nAll maps valid: placements clear, spawn safe, everything reachable.');
}
