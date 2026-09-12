/**
 * NEON COMPOUND — the original arena.
 *
 *   south  -> Arrival plaza (player spawn, safe)
 *   center -> Courtyard with a raised command platform (a heavy guards the top,
 *             visible from the plaza gate)
 *   east   -> Industrial yard (shipping containers, a climbable vantage point)
 *   west   -> Raised terrace deck with stairs and parapets (sniper spot)
 *   north  -> Transit corridor leading to the walled north stronghold
 *   flanks -> Loop alleys around the stronghold, so every zone can be
 *             approached from more than one direction.
 *
 * Every hostile is pre-placed from the first second — nothing spawns in.
 */
export function build(k) {
  const ARENA = 62;

  k.addPerimeter(ARENA, 8, 2, 'concreteDark', 3.4);

  // ============ ZONE A — arrival plaza (south) ============
  k.addBox(-14, 0, 50, 6, 3.4, 5, 'concreteDark');
  k.addBox(14, 0, 50, 6, 3.4, 5, 'concreteDark');
  k.addPylon(-14, 50, 3.4, true);
  k.addPylon(14, 50, 3.4, true);
  k.addBox(-6.5, 0, 45, 7, 1.5, 1.1, 'concrete');
  k.addBox(6.5, 0, 45, 7, 1.5, 1.1, 'concrete');
  k.addBox(-9, 0, 56, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-9, 1.2, 56, 2.0, 1.0, 2.0, 'crate');
  k.addBox(9, 0, 56, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-2.2, 0.01, 50.2, 0.14, 0.05, 7.6, 'accent', k.STRIP);
  k.addBox(2.2, 0.01, 50.2, 0.14, 0.05, 7.6, 'accent', k.STRIP);

  // plaza -> courtyard divider (z = 42) with a grand central gate
  k.addBox(-17, 0, 42, 18, 3.2, 1.4, 'concrete');
  k.addBox(17, 0, 42, 18, 3.2, 1.4, 'concrete');
  k.addBox(-17, 2.0, 42.73, 17.6, 0.12, 0.06, 'accent', k.STRIP);
  k.addBox(17, 2.0, 42.73, 17.6, 0.12, 0.06, 'accent', k.STRIP);

  // ============ ZONE B — central courtyard ============
  k.addBox(0, 0, 20, 13, 2.2, 13, 'concrete');
  k.addStairs(0, 26.85, 5, 'z+', 2.2, 5, 'concrete');
  k.addStairs(0, 13.15, 5, 'z-', 2.2, 5, 'concrete');
  k.addBox(4.6, 2.2, 16.2, 2.4, 1.3, 2.4, 'metal');
  k.addBox(-5.5, 3.5, 23.8, 0.12, 1.8, 0.12, 'accent', k.STRIP);
  k.addBox(-19.2, 0, 30, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-16.8, 0, 30, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-18, 0, 32.4, 2.2, 1.2, 2.2, 'crate');
  k.addBox(16.8, 0, 30, 2.2, 1.2, 2.2, 'crate');
  k.addBox(19.2, 0, 30, 2.2, 1.2, 2.2, 'crate');
  k.addBox(18, 0, 32.4, 2.2, 1.2, 2.2, 'crate');
  k.addBox(19.2, 1.2, 30, 2.0, 1.0, 2.0, 'crate');
  k.addBox(-13, 0, 16, 8, 2.4, 1.4, 'concrete');
  k.addBox(13, 0, 16, 8, 2.4, 1.4, 'concrete');
  for (const [x, z] of [[-24, 16], [24, 16], [-24, 36], [24, 36]]) {
    k.addBox(x, 0, z, 1.6, 5.5, 1.6, 'metal');
  }
  k.addPylon(0, 33, 0, true);

  // ============ ZONE C — east industrial yard ============
  k.addBox(29, 0, 30, 1.4, 3.6, 26, 'concreteDark');
  k.addBox(29, 0, 4, 1.4, 3.6, 14, 'concreteDark');
  k.addBox(38, 0, 36, 3.2, 4.4, 8, 'container');
  k.addBox(46, 0, 30, 8, 4.4, 3.2, 'container');
  k.addBox(54, 0, 38, 3.2, 4.4, 7, 'container');
  k.addBox(42, 0, 18, 3.2, 4.4, 9, 'container');
  k.addBox(50, 0, 10, 7, 4.4, 3.2, 'container');
  k.addBox(55, 0, 22, 6, 2.2, 6, 'container');
  k.addBox(50.6, 0, 22, 2.2, 1.2, 2.2, 'crate');
  k.addBox(50.6, 1.2, 22, 2.0, 1.0, 2.0, 'crate');
  k.addBox(36, 0, 12, 7, 1.6, 1.2, 'concrete');
  k.addBox(34, 0, 24, 2.4, 1.2, 2.4, 'crate');
  k.addBox(58, 0, 14, 2.4, 1.2, 2.4, 'crate');
  k.addPylon(46, 20, 0, true);

  // ============ ZONE D — west terrace ============
  k.addBox(-29, 0, 30, 1.4, 3.6, 26, 'concreteDark');
  k.addBox(-29, 0, 4, 1.4, 3.6, 14, 'concreteDark');
  k.addBox(-46, 0, 24, 22, 2.2, 26, 'concrete');
  k.addStairs(-34.65, 24, 5, 'x+', 2.2, 5, 'concrete');
  k.addStairs(-46, 10.65, 5, 'z-', 2.2, 5, 'concrete');
  k.addBox(-46, 2.2, 36.5, 22, 0.9, 1.0, 'concreteDark');       // north edge
  k.addBox(-56.5, 2.2, 24, 1.0, 0.9, 26, 'concreteDark');       // west edge
  k.addBox(-52.75, 2.2, 11.5, 8.5, 0.9, 1.0, 'concreteDark');   // south W
  k.addBox(-39.25, 2.2, 11.5, 8.5, 0.9, 1.0, 'concreteDark');   // south E
  k.addBox(-35.5, 2.2, 16.25, 1.0, 0.9, 10.5, 'concreteDark');  // east S
  k.addBox(-35.5, 2.2, 31.75, 1.0, 0.9, 10.5, 'concreteDark');  // east N
  k.addBox(-52, 2.2, 31, 4.5, 2.0, 4.5, 'metal');
  k.addPylon(-46, 16, 2.2, true);
  k.addBox(-46, 0, 4, 10, 1.8, 1.2, 'concrete');
  k.addBox(-40, 0, 6, 2.4, 1.2, 2.4, 'crate');
  k.addBox(-38, 0, 42, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-35.8, 0, 42, 2.2, 1.2, 2.2, 'crate');
  k.addPylon(-33, 6, 0, false);

  // ============ ZONE E — north transit corridor ============
  k.addBox(-16, 0, 2, 8, 2.2, 1.2, 'concrete');
  k.addBox(16, 0, 2, 8, 2.2, 1.2, 'concrete');
  k.addBox(-8, 0, 7, 2.2, 1.2, 2.2, 'crate');
  k.addBox(8, 0, 7, 2.2, 1.2, 2.2, 'crate');
  k.addPylon(-20, 4, 0, false);
  k.addPylon(20, 4, 0, false);

  // ============ ZONE F — north stronghold ============
  k.addBox(-20.5, 0, -1, 27, 4.6, 1.6, 'concreteDark');
  k.addBox(20.5, 0, -1, 27, 4.6, 1.6, 'concreteDark');
  k.addBox(-20.5, 2.9, -0.16, 26.6, 0.12, 0.06, 'accent', k.STRIP);
  k.addBox(20.5, 2.9, -0.16, 26.6, 0.12, 0.06, 'accent', k.STRIP);
  k.addPylon(-8.8, 1.6, 0, true);
  k.addPylon(8.8, 1.6, 0, true);
  k.addBox(-34, 0, -45, 1.6, 4.6, 22, 'concreteDark');
  k.addBox(-34, 0, -14, 1.6, 4.6, 24, 'concreteDark');
  k.addBox(34, 0, -45, 1.6, 4.6, 22, 'concreteDark');
  k.addBox(34, 0, -14, 1.6, 4.6, 24, 'concreteDark');
  k.addBox(0, 0, -30, 14, 3.52, 10, 'concreteDark');
  k.addStairs(0, -24.65, 6, 'z+', 3.52, 8, 'concrete');
  k.addBox(-5.5, 3.52, -33.5, 0.12, 2.0, 0.12, 'accent', k.STRIP);   // roof antenna
  k.addBox(-5, 2.6, -24.96, 3.6, 0.12, 0.06, 'accent', k.STRIP);
  k.addBox(5, 2.6, -24.96, 3.6, 0.12, 0.06, 'accent', k.STRIP);
  k.addBox(-21, 0, -12, 12, 3.4, 1.4, 'concrete');
  k.addBox(21, 0, -12, 12, 3.4, 1.4, 'concrete');
  k.addBox(-24, 0, -44, 1.4, 3.4, 16, 'concrete');
  k.addBox(24, 0, -44, 1.4, 3.4, 16, 'concrete');
  k.addBox(-12.2, 0, -18, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-9.8, 0, -18, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-11, 0, -20.4, 2.2, 1.2, 2.2, 'crate');
  k.addBox(12.2, 0, -18, 2.2, 1.2, 2.2, 'crate');
  k.addBox(9.8, 0, -18, 2.2, 1.2, 2.2, 'crate');
  k.addBox(11, 0, -20.4, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-14, 0, -48, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-11.8, 0, -48, 2.2, 1.2, 2.2, 'crate');
  k.addBox(14, 0, -48, 2.2, 1.2, 2.2, 'crate');
  k.addBox(11.8, 0, -48, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-29, 0, -38, 2.4, 1.2, 2.4, 'crate');
  k.addBox(-29, 1.2, -38, 2.2, 1.0, 2.2, 'crate');
  k.addBox(-6, 0, -57, 2.2, 1.2, 2.2, 'crate');
  k.addBox(6, 0, -57, 2.2, 1.2, 2.2, 'crate');
  k.addPylon(-13.5, -22.5, 0, true);
  k.addPylon(13.5, -22.5, 0, true);
  k.addPylon(0, -42, 0, false);

  // ---- flank alleys (outside the stronghold, loop back to the yards) ----
  k.addBox(-48, 0, -12, 2.4, 1.2, 2.4, 'crate');
  k.addBox(-52, 0, -40, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-44, 0, -52, 2.2, 1.2, 2.2, 'crate');
  k.addBox(48, 0, -14, 2.4, 1.2, 2.4, 'crate');
  k.addBox(52, 0, -42, 2.2, 1.2, 2.2, 'crate');
  k.addPylon(-48, -30, 0, false);
  k.addPylon(48, -20, 0, false);

  return {
    arena: ARENA,
    spawn: { x: 0, z: 54, yaw: 0 },
    enemies: [
      // courtyard — the heavy on the command platform is visible from the gate
      { type: 'heavy', x: -2.5, y: 2.2, z: 21, patrol: 2, yawDeg: 0 },
      { type: 'shooter', x: -13, y: 0, z: 18, patrol: 2.5 },
      { type: 'shooter', x: 15, y: 0, z: 26, patrol: 3 },
      { type: 'grunt', x: -21, y: 0, z: 24, patrol: 6 },
      { type: 'grunt', x: 21, y: 0, z: 14, patrol: 5 },
      // east industrial yard
      { type: 'grunt', x: 36, y: 0, z: 26, patrol: 6 },
      { type: 'grunt', x: 48, y: 0, z: 38, patrol: 5 },
      { type: 'grunt', x: 56, y: 0, z: 8, patrol: 4 },
      { type: 'shooter', x: 55, y: 2.2, z: 22, patrol: 1.5, yawDeg: -90 },
      { type: 'shooter', x: 40, y: 0, z: 6, patrol: 4 },
      // west terrace
      { type: 'shooter', x: -50, y: 2.2, z: 20, patrol: 3.5, yawDeg: 90 },
      { type: 'grunt', x: -40, y: 2.2, z: 30, patrol: 2.5 },
      { type: 'grunt', x: -33, y: 0, z: 14, patrol: 5 },
      { type: 'shooter', x: -52, y: 0, z: 42, patrol: 4 },
      // north transit corridor
      { type: 'grunt', x: -6, y: 0, z: 4, patrol: 7 },
      { type: 'grunt', x: 12, y: 0, z: 6, patrol: 6 },
      // north stronghold (tier 2 elites: +14% HP, +7% damage)
      { type: 'heavy', x: 0, y: 3.52, z: -30.5, patrol: 2, tier: 2, yawDeg: 0 },
      { type: 'shooter', x: -4.5, y: 3.52, z: -27, patrol: 1.5, tier: 2, yawDeg: 0 },
      { type: 'grunt', x: -22, y: 0, z: -7, patrol: 4 },
      { type: 'grunt', x: -16, y: 0, z: -18, patrol: 4 },
      { type: 'grunt', x: 16, y: 0, z: -18, patrol: 4 },
      { type: 'shooter', x: -28, y: 0, z: -46, patrol: 3 },
      { type: 'shooter', x: 28, y: 0, z: -46, patrol: 3 },
      { type: 'heavy', x: 0, y: 0, z: -52, patrol: 3, tier: 2, yawDeg: 0 },
      // flank alleys
      { type: 'grunt', x: -44, y: 0, z: -22, patrol: 8 },
      { type: 'shooter', x: 44, y: 0, z: -30, patrol: 7 },
    ],
    pickups: [
      { kind: 'health', x: -13, y: 0, z: 14.3 },   // behind the west courtyard cover wall
      { kind: 'ammo', x: 20, y: 0, z: 36 },        // east courtyard pillar
      { kind: 'ammo', x: 46, y: 0, z: 36 },        // between containers, east yard
      { kind: 'health', x: 58.5, y: 0, z: 30 },    // east yard outer edge
      { kind: 'health', x: -52, y: 2.2, z: 27.5 }, // on the west deck, by the shelter
      { kind: 'ammo', x: -46, y: 0, z: 2 },        // south of the west deck
      { kind: 'health', x: -20, y: 0, z: -5.5 },   // stronghold west pocket (guarded)
      { kind: 'ammo', x: 20, y: 0, z: -5.5 },      // stronghold east pocket
      { kind: 'health', x: 0, y: 0, z: -58 },      // north cache (behind the heavy)
      { kind: 'ammo', x: -4, y: 0, z: -58 },
      { kind: 'ammo', x: 4, y: 0, z: -58 },
      { kind: 'ammo', x: -56, y: 0, z: -50 },      // west flank alley
      { kind: 'health', x: 56, y: 0, z: -52 },     // east flank alley
    ],
  };
}
