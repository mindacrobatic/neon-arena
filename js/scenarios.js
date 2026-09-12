/**
 * Scenario + difficulty definitions — pure data, no imports, no DOM.
 *
 * A scenario pairs one hand-built map (`mapId`, see js/maps/index.js) with a
 * set of mission rules. A difficulty scales the enemies and the player's
 * economy on top of that. Both are chosen on the deploy screen.
 */

/**
 * Difficulty knobs, all multipliers/absolute values applied at mission start:
 *   enemyHp / enemyDamage / enemySpeed  — robot stats
 *   enemyAim  — aim error in radians; lower is more accurate
 *   enemySee / enemyHear                — perception ranges
 *   playerDamage — multiplier on every hit the player takes
 *   ammo         — multiplier on weapon reserve ammo
 *   grenadeMul   — multiplier on starting grenades
 *   score        — multiplier on all score awarded
 */
export const DIFFICULTIES = [
  {
    id: 'easy',
    name: 'EASY',
    color: '#3dff8e',
    blurb: 'Slower, softer, near-blind robots and generous supplies.',
    enemyHp: 0.75, enemyDamage: 0.55, enemySpeed: 0.9, enemyAim: 0.075,
    enemySee: 0.85, enemyHear: 0.8, playerDamage: 0.65,
    ammo: 1.6, grenadeMul: 1.66, score: 0.75,
  },
  {
    id: 'normal',
    name: 'NORMAL',
    color: '#64d8ff',
    blurb: 'The intended balance. Guards notice you, gunfights hurt.',
    enemyHp: 1, enemyDamage: 1, enemySpeed: 1, enemyAim: 0.035,
    enemySee: 1, enemyHear: 1, playerDamage: 1,
    ammo: 1, grenadeMul: 1, score: 1,
  },
  {
    id: 'hard',
    name: 'HARD',
    color: '#ffd23d',
    blurb: 'Armoured, fast and sharp-eyed. They hit hard and shoot straight.',
    enemyHp: 1.35, enemyDamage: 1.4, enemySpeed: 1.08, enemyAim: 0.02,
    enemySee: 1.12, enemyHear: 1.1, playerDamage: 1.45,
    ammo: 0.8, grenadeMul: 0.66, score: 1.6,
  },
  {
    id: 'nightmare',
    name: 'NIGHTMARE',
    color: '#ff5d6e',
    blurb: 'Elite plating, surgical aim, threadbare supplies. No mistakes.',
    enemyHp: 1.8, enemyDamage: 1.9, enemySpeed: 1.16, enemyAim: 0.011,
    enemySee: 1.25, enemyHear: 1.2, playerDamage: 2,
    ammo: 0.6, grenadeMul: 0.33, score: 2.5,
  },
];

export const DEFAULT_DIFFICULTY = 'normal';

/**
 * Mission rules a scenario may set:
 *   timeLimit      — seconds before the mission fails (null = untimed)
 *   startWeapon    — weapon index the player deploys with
 *   startGrenades  — override the base grenade count (before difficulty)
 *   ammoScale      — scenario-specific reserve-ammo multiplier
 *   alertOnStart   — every hostile starts alerted and hunting
 *   noLeash        — hostiles never disengage; they chase across the map
 */
export const SCENARIOS = [
  {
    id: 'assault',
    mapId: 'compound',
    name: 'NEON COMPOUND',
    short: 'COMPOUND',
    mode: 'ASSAULT',
    color: '#64d8ff',
    tagline: 'Three approaches, one compound',
    description:
      'A walled compound with a raised command platform, container yards and a ' +
      'northern stronghold. Every zone can be flanked — scout it, then pick your fight.',
    objective: 'ELIMINATE ALL HOSTILES',
    rules: {},
  },
  {
    id: 'slagworks',
    mapId: 'foundry',
    name: 'SLAGWORKS FOUNDRY',
    short: 'SLAGWORKS',
    mode: 'CLOSE QUARTERS',
    color: '#ff9d3d',
    tagline: 'Ring corridor around a live furnace',
    description:
      'A smelting hall wrapped around a central furnace, with catwalk bridges ' +
      'linking the high decks. Fight the ring below or own the circuit above.',
    objective: 'ELIMINATE ALL HOSTILES',
    rules: { ammoScale: 0.85 },
  },
  {
    id: 'highground',
    mapId: 'spire',
    name: 'SKYSPIRE',
    short: 'SKYSPIRE',
    mode: 'HIGH GROUND',
    color: '#b98cff',
    tagline: 'Climb the tower, take the roof',
    description:
      'A stepped ziggurat rising out of an open plaza. Shooters hold every tier, ' +
      'so the ramps are killing grounds. Deploys you with the Longview Railgun.',
    objective: 'ELIMINATE ALL HOSTILES',
    rules: { startWeapon: 3, startGrenades: 2, ammoScale: 1.15 },
  },
  {
    id: 'blackout',
    mapId: 'catacomb',
    name: 'UNDERCROFT',
    short: 'UNDERCROFT',
    mode: 'BLACKOUT SWEEP',
    color: '#ff5d6e',
    tagline: 'Timed sweep of a lightless warren',
    description:
      'A basement maze of pillars, vaults and short sightlines. The garrison ' +
      'never breaks off a chase. The vents seal in six minutes.',
    objective: 'SWEEP THE UNDERCROFT',
    rules: { timeLimit: 360, noLeash: true },
  },
];

export function getScenario(id) {
  return SCENARIOS.find(s => s.id === id) || SCENARIOS[0];
}

export function getDifficulty(id) {
  return DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES.find(d => d.id === DEFAULT_DIFFICULTY);
}

/** Format the mission clock, used for both the HUD and the time limit. */
export function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
