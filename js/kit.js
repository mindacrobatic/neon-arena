/**
 * Pure level-construction kit — no three.js, no DOM, no imports.
 *
 * A map module receives one of these and describes its layout with
 * `addBox` / `addStairs` / `addPylon` calls. The kit records two things:
 *
 *   shapes — visual/geometry descriptions the renderer turns into meshes
 *   solids — AABB collision boxes {min:{x,y,z}, max:{x,y,z}}
 *
 * Keeping this module dependency-free means the exact same collision
 * geometry the browser plays on can be replayed headlessly by
 * `tools/validate-maps.mjs` (see npm run validate).
 */

/** Options for decorative, non-colliding trim (glow strips and the like). */
export const STRIP = { collide: false, addCollider: false, cast: false };

function solidOf(x, yBase, z, w, h, d) {
  return {
    min: { x: x - w / 2, y: yBase, z: z - d / 2 },
    max: { x: x + w / 2, y: yBase + h, z: z + d / 2 },
  };
}

export function createKit() {
  const solids = [];
  const shapes = [];

  /**
   * Axis-aligned box. (x, z) is the centre, `yBase` the bottom, so the box
   * spans yBase .. yBase + h. `m` is a material name resolved by the renderer.
   */
  function addBox(x, yBase, z, w, h, d, m = 'concrete', opts = {}) {
    const collide = opts.collide !== false;
    const addCollider = opts.addCollider !== false;
    shapes.push({
      kind: 'box',
      x, y: yBase + h / 2, z, w, h, d, m,
      cast: opts.cast !== false,
      receive: opts.receive !== false,
      addCollider,
    });
    if (collide) solids.push(solidOf(x, yBase, z, w, h, d));
  }

  /**
   * Straight staircase of stacked boxes descending from a platform edge.
   * (x, z) is the centre of the TOP step; `dir` ('x+'|'x-'|'z+'|'z-') is the
   * direction it descends toward. `topH` is the platform height above
   * `opts.yBase`, so the top step is flush with the platform. Keep every step
   * <= 0.56 high (the shared step-assist limit).
   */
  function addStairs(x, z, width, dir, topH, steps, m = 'concrete', opts = {}) {
    const stepD = opts.stepD ?? 0.7;
    const yBase = opts.yBase ?? 0;
    const stepH = topH / steps;
    for (let i = 0; i < steps; i++) {
      const h = topH - i * stepH;
      const off = i * stepD;
      if (dir === 'z+') addBox(x, yBase, z + off, width, h, stepD, m);
      else if (dir === 'z-') addBox(x, yBase, z - off, width, h, stepD, m);
      else if (dir === 'x+') addBox(x + off, yBase, z, stepD, h, width, m);
      else addBox(x - off, yBase, z, stepD, h, width, m);
    }
  }

  /** Glowing pylon. `lit` adds a point light (the renderer budgets these). */
  function addPylon(x, z, yBase = 0, lit = true) {
    shapes.push({ kind: 'pylon', x, z, yBase, lit });
    solids.push(solidOf(x, yBase, z, 0.7, 4.8, 0.7));
  }

  /** Four perimeter walls around a square arena. `stripY` adds glow trim. */
  function addPerimeter(arena, h = 8, wallT = 2, m = 'concreteDark', stripY = 3.4) {
    const o = arena + wallT / 2;
    addBox(0, 0, -o, (arena + wallT) * 2, h, wallT, m);
    addBox(0, 0, o, (arena + wallT) * 2, h, wallT, m);
    addBox(-o, 0, 0, wallT, h, arena * 2, m);
    addBox(o, 0, 0, wallT, h, arena * 2, m);
    if (stripY !== null) {
      addBox(0, stripY, -(arena - 0.03), arena * 2, 0.12, 0.06, 'accent', STRIP);
      addBox(0, stripY, (arena - 0.03), arena * 2, 0.12, 0.06, 'accent', STRIP);
      addBox(-(arena - 0.03), stripY, 0, 0.06, 0.12, arena * 2, 'accent', STRIP);
      addBox((arena - 0.03), stripY, 0, 0.06, 0.12, arena * 2, 'accent', STRIP);
    }
  }

  return { solids, shapes, addBox, addStairs, addPylon, addPerimeter, STRIP };
}
