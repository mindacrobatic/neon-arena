/**
 * UNDERCROFT — a lightless basement warren.
 *
 * A 3x3 grid of chambers separated by chest-high (well, head-high) wall runs,
 * with a reactor core squatting in the middle cell. Doorways sit in the middle
 * of every divider and the corners are open, so the whole floor loops rather
 * than dead-ends — but every sightline is short and every approach is covered.
 * Two raised supply vaults reward anyone who pushes the outer cells.
 */
export function build(k) {
  const ARENA = 56;
  const W = 18.7;       // divider line offset
  const WH = 4.6;       // divider height

  k.addPerimeter(ARENA, 6, 2, 'concreteDark', 2.6);

  // ============ chamber dividers (doorways at the centre of each run) ============
  for (const s of [-1, 1]) {
    // vertical dividers at x = +-W
    k.addBox(s * W, 0, -38, 1.4, WH, 30, 'concreteDark');
    k.addBox(s * W, 0, 0, 1.4, WH, 30, 'concreteDark');
    k.addBox(s * W, 0, 38, 1.4, WH, 30, 'concreteDark');
    // horizontal dividers at z = +-W
    k.addBox(-38, 0, s * W, 30, WH, 1.4, 'concreteDark');
    k.addBox(0, 0, s * W, 30, WH, 1.4, 'concreteDark');
    k.addBox(38, 0, s * W, 30, WH, 1.4, 'concreteDark');
  }

  // ============ central reactor ============
  k.addBox(0, 0, 0, 7, 5, 7, 'concreteDark');
  k.addBox(0, 5, 0, 2.2, 1.4, 2.2, 'metal');
  k.addBox(0, 3.4, 3.54, 6, 0.14, 0.06, 'accent', k.STRIP);
  k.addBox(0, 3.4, -3.54, 6, 0.14, 0.06, 'accent', k.STRIP);
  k.addBox(3.54, 3.4, 0, 0.06, 0.14, 6, 'accent', k.STRIP);
  k.addBox(-3.54, 3.4, 0, 0.06, 0.14, 6, 'accent', k.STRIP);

  // ============ pillars ============
  for (const [x, z] of [[-32, 0], [32, 0], [0, 32], [0, -32], [-32, 32], [32, 32], [-32, -32], [32, -32]]) {
    k.addBox(x, 0, z, 1.6, 5.5, 1.6, 'metal');
  }

  // ============ supply vaults (outer cells, one each on opposite corners) ============
  k.addBox(-42, 0, 42, 14, 2.2, 14, 'concrete');
  k.addStairs(-49.35, 42, 6, 'x-', 2.2, 5, 'concrete');
  k.addBox(42, 0, -42, 14, 2.2, 14, 'concrete');
  k.addStairs(49.35, -42, 6, 'x+', 2.2, 5, 'concrete');

  // ============ clutter / cover ============
  k.addBox(-30, 0, 10, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-27.8, 0, 10, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-30, 1.2, 10, 2.0, 1.0, 2.0, 'crate');
  k.addBox(30, 0, -10, 2.2, 1.2, 2.2, 'crate');
  k.addBox(27.8, 0, -10, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-30, 0, -10, 2.2, 1.2, 2.2, 'crate');
  k.addBox(30, 0, 10, 2.2, 1.2, 2.2, 'crate');
  k.addBox(0, 0, 34, 2.4, 1.2, 2.4, 'crate');
  k.addBox(0, 0, -34, 2.4, 1.2, 2.4, 'crate');
  k.addBox(-12, 0, -40, 2.2, 1.2, 2.2, 'crate');
  k.addBox(12, 0, -40, 2.2, 1.2, 2.2, 'crate');
  k.addBox(12, 0, 40, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-45, 0, 10, 10, 1.6, 1.2, 'concrete');
  k.addBox(45, 0, -10, 10, 1.6, 1.2, 'concrete');
  k.addBox(10, 0, 45, 1.2, 1.6, 10, 'concrete');
  k.addBox(-10, 0, -45, 1.2, 1.6, 10, 'concrete');

  // ============ lighting (8 lit pylons; deliberately sparse and moody) ============
  k.addPylon(-52, 52, 0, true);
  k.addPylon(52, 52, 0, true);
  k.addPylon(-52, -52, 0, true);
  k.addPylon(52, -52, 0, true);
  k.addPylon(52, 0, 0, true);
  k.addPylon(-52, 0, 0, true);
  k.addPylon(0, 53, 0, true);
  k.addPylon(0, -53, 0, true);

  return {
    arena: ARENA,
    spawn: { x: 0, z: 48, yaw: 0 },
    enemies: [
      // central reactor chamber
      { type: 'grunt', x: 8, y: 0, z: 0, patrol: 5 },
      { type: 'grunt', x: -8, y: 0, z: 0, patrol: 5 },
      { type: 'shooter', x: 0, y: 0, z: 11, patrol: 3 },
      // north chamber
      { type: 'grunt', x: 0, y: 0, z: -30, patrol: 6 },
      { type: 'grunt', x: 10, y: 0, z: -40, patrol: 5 },
      { type: 'shooter', x: 0, y: 0, z: -44, patrol: 3 },
      // west chamber
      { type: 'grunt', x: -34, y: 0, z: 8, patrol: 6 },
      { type: 'grunt', x: -44, y: 0, z: -16, patrol: 5 },
      { type: 'shooter', x: -44, y: 0, z: 0, patrol: 3 },
      // east chamber
      { type: 'grunt', x: 34, y: 0, z: 8, patrol: 6 },
      { type: 'grunt', x: 44, y: 0, z: -16, patrol: 5 },
      { type: 'shooter', x: 44, y: 0, z: 0, patrol: 3 },
      // north-west vault chamber
      { type: 'grunt', x: -34, y: 0, z: -34, patrol: 6 },
      { type: 'shooter', x: -44, y: 0, z: -44, patrol: 3 },
      { type: 'heavy', x: -40, y: 0, z: -26, patrol: 2, tier: 2, yawDeg: 0 },
      // north-east vault chamber
      { type: 'grunt', x: 34, y: 0, z: -34, patrol: 6 },
      { type: 'shooter', x: 28, y: 0, z: -44, patrol: 3 },
      { type: 'heavy', x: 40, y: 0, z: -26, patrol: 2, tier: 2, yawDeg: 0 },
      { type: 'shooter', x: 42, y: 2.2, z: -42, patrol: 1.5, tier: 2 },  // on the vault
      // south-west vault chamber
      { type: 'grunt', x: -34, y: 0, z: 34, patrol: 6 },
      { type: 'shooter', x: -30, y: 0, z: 44, patrol: 3 },
      { type: 'shooter', x: -42, y: 2.2, z: 42, patrol: 1.5, tier: 2 },  // on the vault
      // south-east chamber
      { type: 'grunt', x: 34, y: 0, z: 34, patrol: 6 },
      { type: 'shooter', x: 44, y: 0, z: 44, patrol: 3 },
    ],
    pickups: [
      { kind: 'health', x: 0, y: 0, z: 20 },
      { kind: 'ammo', x: 0, y: 0, z: 36 },
      { kind: 'ammo', x: -12, y: 0, z: -24 },
      { kind: 'ammo', x: 12, y: 0, z: 24 },
      { kind: 'health', x: -34, y: 0, z: 20 },
      { kind: 'ammo', x: 34, y: 0, z: -20 },
      { kind: 'health', x: -40, y: 0, z: -30 },
      { kind: 'ammo', x: 40, y: 0, z: 30 },
      { kind: 'health', x: -42, y: 2.2, z: 42 },  // south-west vault (guarded)
      { kind: 'ammo', x: 42, y: 2.2, z: -42 },    // north-east vault (guarded)
      { kind: 'ammo', x: 0, y: 0, z: -52 },
      { kind: 'ammo', x: -48, y: 0, z: 6 },
      { kind: 'ammo', x: 48, y: 0, z: -6 },
    ],
  };
}
