/**
 * Simple AABB helpers shared by the player and enemies.
 * A "solid" is { min: Vector3, max: Vector3 } — an axis-aligned box.
 * Entities are modelled as vertical capsules approximated by
 * a circle (radius) in XZ plus a feet Y and a height.
 */

/**
 * Push a circle out of every overlapping solid in the XZ plane.
 * Mutates pos. Returns true when something blocked the entity.
 */
export function collideHorizontal(pos, radius, feetY, height, solids) {
  let blocked = false;
  const top = feetY + height;
  for (const s of solids) {
    if (s.max.y <= feetY + 0.02 || s.min.y >= top) continue; // no vertical overlap
    const cx = pos.x < s.min.x ? s.min.x : (pos.x > s.max.x ? s.max.x : pos.x);
    const cz = pos.z < s.min.z ? s.min.z : (pos.z > s.max.z ? s.max.z : pos.z);
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    blocked = true;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2), push = radius - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
    } else {
      // Circle centre inside the rect: push out along the shallowest axis.
      const pxMin = pos.x - s.min.x, pxMax = s.max.x - pos.x;
      const pzMin = pos.z - s.min.z, pzMax = s.max.z - pos.z;
      const m = Math.min(pxMin, pxMax, pzMin, pzMax);
      if (m === pxMin) pos.x = s.min.x - radius;
      else if (m === pxMax) pos.x = s.max.x + radius;
      else if (m === pzMin) pos.z = s.min.z - radius;
      else pos.z = s.max.z + radius;
    }
  }
  return blocked;
}

/**
 * Resolve the vertical move of this step.
 * prevFeet: feet Y before integrating vy. pos.y is the new (post-integration) feet Y.
 * vel: velocity (vel.y zeroed on contact). Returns 'ground' | 'ceiling' | null.
 */
export function collideVertical(prevFeet, pos, radius, height, solids, vel) {
  let result = null;
  const prevTop = prevFeet + height;
  for (const s of solids) {
    const withinXZ =
      pos.x > s.min.x - radius * 0.75 && pos.x < s.max.x + radius * 0.75 &&
      pos.z > s.min.z - radius * 0.75 && pos.z < s.max.z + radius * 0.75;
    if (!withinXZ) continue;
    if (vel.y <= 0) {
      // Landing on top face: we were above (or level) and crossed down through it.
      if (prevFeet >= s.max.y - 0.3 && pos.y <= s.max.y) {
        pos.y = s.max.y; vel.y = 0; result = 'ground';
      }
    } else {
      // Head bump on bottom face.
      if (prevTop <= s.min.y + 0.3 && pos.y + height >= s.min.y) {
        pos.y = s.min.y - height; vel.y = 0; result = 'ceiling';
      }
    }
  }
  if (vel.y <= 0 && pos.y <= 0) { pos.y = 0; vel.y = 0; result = 'ground'; }
  return result;
}

/**
 * Step-assist: given the position an entity tried to reach (attemptPos, y ignored),
 * find a support surface at most 0.56 above its feet that it could step onto
 * with clear headroom. Returns the surface Y or null.
 */
export function findStepSupport(attemptPos, radius, height, feetY, solids) {
  let best = null;
  for (const s of solids) {
    if (s.max.y <= feetY + 0.03 || s.max.y > feetY + 0.56) continue;
    if (attemptPos.x < s.min.x - radius || attemptPos.x > s.max.x + radius) continue;
    if (attemptPos.z < s.min.z - radius || attemptPos.z > s.max.z + radius) continue;
    // Headroom check at the attempted position.
    let clear = true;
    for (const t of solids) {
      if (t === s) continue;
      if (t.max.y <= s.max.y + 0.02 || t.min.y >= s.max.y + height - 0.05) continue;
      const cx = attemptPos.x < t.min.x ? t.min.x : (attemptPos.x > t.max.x ? t.max.x : attemptPos.x);
      const cz = attemptPos.z < t.min.z ? t.min.z : (attemptPos.z > t.max.z ? t.max.z : attemptPos.z);
      const dx = attemptPos.x - cx, dz = attemptPos.z - cz;
      if (dx * dx + dz * dz < radius * radius) { clear = false; break; }
    }
    if (clear && (best === null || s.max.y > best)) best = s.max.y;
  }
  return best;
}

/**
 * Highest support surface at (x, z) reachable from feetY
 * (at most maxStep above, at most maxDrop below). Ground plane = 0.
 */
export function findGround(x, z, feetY, radius, solids, maxStep = 0.6, maxDrop = 6) {
  let best = 0;
  for (const s of solids) {
    const top = s.max.y;
    if (top > feetY + maxStep || top < feetY - maxDrop) continue;
    if (x < s.min.x - radius * 0.7 || x > s.max.x + radius * 0.7) continue;
    if (z < s.min.z - radius * 0.7 || z > s.max.z + radius * 0.7) continue;
    if (top > best) best = top;
  }
  return best;
}

/** True when point p lies inside any solid (optionally grown by margin). */
export function pointInSolids(p, solids, margin = 0) {
  for (const s of solids) {
    if (p.x > s.min.x - margin && p.x < s.max.x + margin &&
        p.y > s.min.y - margin && p.y < s.max.y + margin &&
        p.z > s.min.z - margin && p.z < s.max.z + margin) return true;
  }
  return false;
}
