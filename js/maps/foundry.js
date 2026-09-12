/**
 * SLAGWORKS FOUNDRY — a smelting hall built around a central furnace.
 *
 * The furnace is a 24x24, 5 m block in the middle of the arena. Two ground
 * staircases climb its south and north faces, and two catwalk bridges run
 * east and west from its deck to raised loading platforms. The result is a
 * two-level circuit: fight the ring corridor below, or take the catwalk loop
 * above — every high position can be reached from two directions.
 */
export function build(k) {
  const ARENA = 54;

  k.addPerimeter(ARENA, 8, 2, 'concreteDark', 3.4);

  // ============ central furnace ============
  k.addBox(0, 0, 0, 24, 5, 24, 'concreteDark');
  k.addBox(0, 5, -7, 8, 4, 6, 'metal');                    // exhaust stack
  k.addBox(0, 4.5, 12.04, 20, 0.12, 0.06, 'accent', k.STRIP);
  k.addBox(0, 4.5, -12.04, 20, 0.12, 0.06, 'accent', k.STRIP);
  k.addBox(12.04, 4.5, 0, 0.06, 0.12, 20, 'accent', k.STRIP);
  k.addBox(-12.04, 4.5, 0, 0.06, 0.12, 20, 'accent', k.STRIP);
  k.addStairs(0, 12.35, 7, 'z+', 5, 10, 'concrete');       // ground -> deck (south)
  k.addStairs(0, -12.35, 7, 'z-', 5, 10, 'concrete');      // ground -> deck (north)

  // ============ catwalk bridges + loading platforms ============
  k.addBox(21, 4.6, 0, 18, 0.4, 5, 'metal');               // east bridge  x 12..30
  k.addBox(-21, 4.6, 0, 18, 0.4, 5, 'metal');              // west bridge  x -30..-12
  k.addBox(36, 0, 0, 12, 5, 12, 'concrete');               // east platform
  k.addBox(-36, 0, 0, 12, 5, 12, 'concrete');              // west platform
  k.addStairs(42.35, 0, 7, 'x+', 5, 10, 'concrete');       // ground -> east platform
  k.addStairs(-42.35, 0, 7, 'x-', 5, 10, 'concrete');      // ground -> west platform
  // bridge railings (decorative)
  for (const z of [2.5, -2.5]) {
    k.addBox(21, 5.5, z, 18, 0.08, 0.08, 'accent', k.STRIP);
    k.addBox(-21, 5.5, z, 18, 0.08, 0.08, 'accent', k.STRIP);
  }

  // ============ ring corridor — south bay ============
  k.addBox(-30, 0, 26, 14, 2.4, 5, 'concrete');
  k.addBox(30, 0, 26, 14, 2.4, 5, 'concrete');
  k.addBox(0, 0, 34, 16, 3.4, 1.4, 'concreteDark');        // choke: flank it left or right
  k.addBox(-18, 0, 38, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-15.8, 0, 38, 2.2, 1.2, 2.2, 'crate');
  k.addBox(18, 0, 38, 2.2, 1.2, 2.2, 'crate');
  k.addBox(15.8, 0, 38, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-18, 1.2, 38, 2.0, 1.0, 2.0, 'crate');

  // ============ ring corridor — north bay ============
  k.addBox(-30, 0, -26, 14, 2.4, 5, 'concrete');
  k.addBox(30, 0, -26, 14, 2.4, 5, 'concrete');
  k.addBox(0, 0, -34, 16, 3.4, 1.4, 'concreteDark');
  k.addBox(-20, 0, -46, 9, 4.6, 7, 'container');           // slag tanks
  k.addBox(20, 0, -46, 9, 4.6, 7, 'container');
  k.addBox(0, 0, -42, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-10, 0, -22, 2.4, 1.2, 2.4, 'crate');
  k.addBox(10, 0, -22, 2.4, 1.2, 2.4, 'crate');

  // ============ ring corridor — east / west service lanes ============
  k.addBox(44, 0, 20, 12, 3.4, 1.4, 'concreteDark');
  k.addBox(44, 0, -20, 12, 3.4, 1.4, 'concreteDark');
  k.addBox(-44, 0, 20, 12, 3.4, 1.4, 'concreteDark');
  k.addBox(-44, 0, -20, 12, 3.4, 1.4, 'concreteDark');
  k.addBox(44, 0, 34, 2.4, 1.2, 2.4, 'crate');
  k.addBox(-44, 0, 34, 2.4, 1.2, 2.4, 'crate');
  k.addBox(44, 0, -34, 2.4, 1.2, 2.4, 'crate');
  k.addBox(-44, 0, -34, 2.4, 1.2, 2.4, 'crate');
  k.addBox(24, 0, 40, 2.4, 1.2, 2.4, 'crate');
  k.addBox(-24, 0, 40, 2.4, 1.2, 2.4, 'crate');

  // ============ lighting (8 lit pylons; the renderer pads the budget) ============
  k.addPylon(-30, 44, 0, true);
  k.addPylon(30, 44, 0, true);
  k.addPylon(0, 44, 0, true);
  k.addPylon(0, -48, 0, true);
  k.addPylon(50, 0, 0, true);
  k.addPylon(-50, 0, 0, true);
  k.addPylon(50, -44, 0, true);
  k.addPylon(-50, -44, 0, true);
  k.addPylon(8, 8, 5, false);      // furnace deck trim
  k.addPylon(-8, -8, 5, false);

  return {
    arena: ARENA,
    spawn: { x: 0, z: 50, yaw: 0 },
    enemies: [
      // south approach + spawn side
      { type: 'grunt', x: 0, y: 0, z: 28, patrol: 6 },
      { type: 'grunt', x: -20, y: 0, z: 40, patrol: 6 },
      { type: 'grunt', x: 20, y: 0, z: 40, patrol: 6 },
      { type: 'shooter', x: -30, y: 0, z: 30, patrol: 3 },
      { type: 'shooter', x: 30, y: 0, z: 30, patrol: 3 },
      // service lanes
      { type: 'grunt', x: -36, y: 0, z: 14, patrol: 6 },
      { type: 'grunt', x: 36, y: 0, z: 14, patrol: 6 },
      { type: 'grunt', x: -36, y: 0, z: -14, patrol: 6 },
      { type: 'grunt', x: 36, y: 0, z: -14, patrol: 6 },
      { type: 'grunt', x: -46, y: 0, z: 12, patrol: 5 },
      { type: 'grunt', x: 46, y: 0, z: 12, patrol: 5 },
      // north bay
      { type: 'shooter', x: 0, y: 0, z: -26, patrol: 3 },
      { type: 'grunt', x: -20, y: 0, z: -40, patrol: 6 },
      { type: 'grunt', x: 20, y: 0, z: -40, patrol: 6 },
      { type: 'shooter', x: 0, y: 0, z: -44, patrol: 3 },
      // catwalk loop — bridges and loading platforms
      { type: 'shooter', x: 36, y: 5, z: 0, patrol: 1.5, tier: 2, yawDeg: -90 },
      { type: 'grunt', x: 33, y: 5, z: 4, patrol: 2 },
      { type: 'shooter', x: -36, y: 5, z: 0, patrol: 1.5, tier: 2, yawDeg: 90 },
      { type: 'grunt', x: -33, y: 5, z: -4, patrol: 2 },
      { type: 'shooter', x: 21, y: 5, z: 0, patrol: 1, yawDeg: -90 },
      { type: 'grunt', x: -21, y: 5, z: 0, patrol: 1 },
      // furnace deck — the prize at the centre
      { type: 'heavy', x: -7, y: 5, z: -6, patrol: 2, tier: 2, yawDeg: 0 },
      { type: 'shooter', x: 0, y: 5, z: 2, patrol: 2, yawDeg: 0 },
      { type: 'grunt', x: 7, y: 5, z: -6, patrol: 3 },
      { type: 'heavy', x: 0, y: 0, z: -50, patrol: 3 },
    ],
    pickups: [
      { kind: 'health', x: 0, y: 0, z: 20 },
      { kind: 'ammo', x: -24, y: 0, z: 20 },
      { kind: 'ammo', x: 24, y: 0, z: 20 },
      { kind: 'health', x: -44, y: 0, z: 30 },
      { kind: 'health', x: 44, y: 0, z: 30 },
      { kind: 'ammo', x: 0, y: 0, z: -20 },
      { kind: 'health', x: -24, y: 0, z: -40 },
      { kind: 'ammo', x: 24, y: 0, z: -40 },
      { kind: 'health', x: 0, y: 5, z: 6 },       // furnace deck (guarded)
      { kind: 'ammo', x: 39, y: 5, z: -4 },      // east platform
      { kind: 'ammo', x: -39, y: 5, z: 4 },      // west platform
      { kind: 'health', x: -50, y: 0, z: 10 },
      { kind: 'ammo', x: 50, y: 0, z: 10 },
    ],
  };
}
