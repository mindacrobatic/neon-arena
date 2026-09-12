/**
 * SKYSPIRE — a stepped ziggurat rising out of an open plaza.
 *
 * Three tiers climb from the plaza to a rooftop command post, with the stairs
 * spiralling around the tower (south face, then east ring, then north ring) so
 * the ascent is exposed from several angles. Long sightlines in every
 * direction: whoever holds the roof owns the plaza, which is exactly why the
 * garage of shooters on the tiers wants it back.
 */
export function build(k) {
  const ARENA = 50;

  k.addPerimeter(ARENA, 14, 2, 'concreteDark', 5.6);

  // ============ the ziggurat ============
  k.addBox(0, 0, 0, 24, 2.75, 24, 'concrete');       // tier 1
  k.addBox(0, 2.75, 0, 16, 2.75, 16, 'concrete');    // tier 2
  k.addBox(0, 5.5, 0, 8, 2.75, 8, 'concrete');       // tier 3
  k.addBox(0, 8.25, -2, 4, 2.6, 3, 'metal');         // rooftop command hut
  k.addBox(2.6, 8.25, 2.6, 0.12, 2.4, 0.12, 'accent', k.STRIP);
  k.addBox(0, 2.6, 12.04, 20, 0.1, 0.06, 'accent', k.STRIP);
  k.addBox(0, 2.6, -12.04, 20, 0.1, 0.06, 'accent', k.STRIP);
  k.addBox(0, 5.35, 8.04, 12, 0.1, 0.06, 'accent', k.STRIP);
  k.addBox(0, 8.1, 4.04, 6, 0.1, 0.06, 'accent', k.STRIP);

  // ascent: plaza -> tier 1 (south), tier 1 -> tier 2 (east ring), tier 2 -> tier 3 (north ring)
  k.addStairs(0, 12.35, 6, 'z+', 2.75, 5, 'concrete');
  k.addStairs(8.35, 0, 4, 'x+', 2.75, 5, 'concrete', { yBase: 2.75 });
  k.addStairs(0, -4.35, 4, 'z-', 2.75, 5, 'concrete', { yBase: 5.5 });

  // ============ plaza — flanking watch platforms ============
  k.addBox(34, 0, 34, 14, 2.75, 14, 'concrete');
  k.addStairs(34, 41.35, 6, 'z+', 2.75, 5, 'concrete');
  k.addBox(-34, 0, -34, 14, 2.75, 14, 'concrete');
  k.addStairs(-34, -41.35, 6, 'z-', 2.75, 5, 'concrete');

  // ============ plaza — cover lanes ============
  k.addBox(-30, 0, 10, 16, 3.4, 1.4, 'concreteDark');
  k.addBox(30, 0, 10, 16, 3.4, 1.4, 'concreteDark');
  k.addBox(-30, 0, -10, 16, 3.4, 1.4, 'concreteDark');
  k.addBox(30, 0, -10, 16, 3.4, 1.4, 'concreteDark');
  k.addBox(-8, 0, 40, 6, 1.5, 1.1, 'concrete');
  k.addBox(8, 0, 40, 6, 1.5, 1.1, 'concrete');
  k.addBox(-18, 0, 22, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-15.8, 0, 22, 2.2, 1.2, 2.2, 'crate');
  k.addBox(18, 0, 22, 2.2, 1.2, 2.2, 'crate');
  k.addBox(15.8, 0, 22, 2.2, 1.2, 2.2, 'crate');
  k.addBox(-18, 1.2, 22, 2.0, 1.0, 2.0, 'crate');
  k.addBox(0, 0, 30, 2.4, 1.2, 2.4, 'crate');
  k.addBox(-40, 0, 20, 8, 4.4, 3.2, 'container');
  k.addBox(40, 0, -20, 8, 4.4, 3.2, 'container');
  k.addBox(-20, 0, -42, 3.2, 4.4, 8, 'container');
  k.addBox(20, 0, 42, 3.2, 4.4, 8, 'container');

  // ============ lighting (8 lit pylons) ============
  k.addPylon(-46, 46, 0, true);
  k.addPylon(46, 46, 0, true);
  k.addPylon(-46, -46, 0, true);
  k.addPylon(46, -46, 0, true);
  k.addPylon(46, 0, 0, true);
  k.addPylon(-46, 0, 0, true);
  k.addPylon(0, 46, 0, true);
  k.addPylon(0, -46, 0, true);

  return {
    arena: ARENA,
    spawn: { x: 0, z: 44, yaw: 0 },
    enemies: [
      // plaza floor
      { type: 'grunt', x: 6, y: 0, z: 26, patrol: 5 },
      { type: 'grunt', x: -18, y: 0, z: 34, patrol: 5 },
      { type: 'grunt', x: 18, y: 0, z: 34, patrol: 5 },
      { type: 'shooter', x: -30, y: 0, z: 24, patrol: 4 },
      { type: 'shooter', x: 30, y: 0, z: 24, patrol: 4 },
      { type: 'grunt', x: -30, y: 0, z: -24, patrol: 5 },
      { type: 'grunt', x: 30, y: 0, z: -24, patrol: 5 },
      { type: 'shooter', x: -44, y: 0, z: 0, patrol: 4 },
      { type: 'shooter', x: 44, y: 0, z: 0, patrol: 4 },
      // watch platforms
      { type: 'shooter', x: 34, y: 2.75, z: 34, patrol: 2, yawDeg: 180 },
      { type: 'grunt', x: 30, y: 2.75, z: 38, patrol: 2 },
      { type: 'shooter', x: -34, y: 2.75, z: -34, patrol: 2, tier: 2, yawDeg: 0 },
      { type: 'grunt', x: -30, y: 2.75, z: -38, patrol: 2 },
      // tier 1 ring
      { type: 'grunt', x: -9, y: 2.75, z: 9, patrol: 2 },
      { type: 'grunt', x: 9, y: 2.75, z: 9, patrol: 2 },
      { type: 'shooter', x: 0, y: 2.75, z: -9, patrol: 2, yawDeg: 0 },
      // tier 2 ring
      { type: 'shooter', x: -6, y: 5.5, z: 6, patrol: 1.5, tier: 2 },
      { type: 'grunt', x: 6, y: 5.5, z: -6, patrol: 1.5 },
      // rooftop command post
      { type: 'heavy', x: 0, y: 8.25, z: 3, patrol: 1.5, tier: 2, yawDeg: 0 },
      { type: 'shooter', x: 3, y: 8.25, z: 0, patrol: 1.5, tier: 2, yawDeg: 0 },
    ],
    pickups: [
      { kind: 'health', x: 0, y: 0, z: 26 },
      { kind: 'ammo', x: -22, y: 0, z: 26 },
      { kind: 'ammo', x: 22, y: 0, z: 26 },
      { kind: 'health', x: -34, y: 0, z: 25 },
      { kind: 'health', x: 34, y: 0, z: 25 },
      { kind: 'ammo', x: -44, y: 0, z: -20 },
      { kind: 'ammo', x: 48, y: 0, z: -16 },
      { kind: 'health', x: 0, y: 2.75, z: 9 },     // tier 1
      { kind: 'ammo', x: 9, y: 2.75, z: -9 },     // tier 1
      { kind: 'health', x: 30, y: 2.75, z: 34 },  // SE watch platform
      { kind: 'ammo', x: -30, y: 2.75, z: -34 },  // NW watch platform
      { kind: 'ammo', x: 0, y: 5.5, z: 5 },       // tier 2
      { kind: 'health', x: 0, y: 8.25, z: 4 },    // rooftop (guarded)
    ],
  };
}
