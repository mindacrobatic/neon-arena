# NEON COMPOUND — a Three.js ego shooter

A browser-based first-person **exploration shooter** built with plain
[three.js](https://threejs.org/) (r160, loaded from CDN via import map).
No build step, no assets — all geometry, textures and sounds are generated
procedurally in code.

Instead of enemies popping in from nowhere, **every hostile is pre-placed in
the level from the first second**: robots guard, patrol and scan their zones,
and only engage when they notice you. Scout first, then choose how and when
each fight starts.

**Four hand-built arenas** and **four difficulty tiers** are chosen on the
deploy screen before every mission.

## Run it

Serve the folder over HTTP and open it in a modern browser (Chrome/Firefox/Edge/Safari):

```bash
cd egoshooter
python3 -m http.server 8000
# → http://localhost:8000
```

> An internet connection is required the first time because `three.js` itself
> is fetched from the unpkg CDN. Opening `index.html` via `file://` usually
> works too, but serving over HTTP is the reliable path.

> **Cache note:** simple static servers (like `python3 -m http.server`) send
> no cache headers, so browsers can keep stale JS modules — and stale CSS —
> in memory while loading a fresh `index.html`. Every module import and the
> stylesheet link therefore carries a `?v=N` cache-buster. **After editing any
> `js/` or `css/` file, bump the version in all import specifiers and in
> `index.html`** (e.g. `sed -i '' 's/?v=3/?v=4/g' js/*.js js/maps/*.js index.html`),
> or simply hard-reload the page (Cmd/Ctrl+Shift+R). `npm run validate` fails
> if the versions are ever mixed. A stale stylesheet is worth knowing about:
> the deploy-screen pickers are styled entirely by `css/style.css`, so an old
> cached copy makes the menu fall back to raw browser buttons.

## Deploy screen

The menu is the mission-select screen. Pick a **scenario** (which arena, which
mission rules) and a **difficulty**, then hit DEPLOY. Selecting a scenario
swaps the arena behind the menu as a live preview, and the panel under each
picker spells out the objective, the hostile/supply count, any special rules,
and exactly what the chosen difficulty changes. `MISSION SELECT` on the
pause/death/victory screens takes you back to it.

## The scenarios

| Scenario | Arena | Character | Hostiles |
|---|---|---|---|
| **ASSAULT** | Neon Compound | The original walled compound: command platform, container yards, west terrace, northern stronghold, flank alleys. Balanced and open-ended. | 26 |
| **CLOSE QUARTERS** | Slagworks Foundry | A smelting hall wrapped around a central furnace. Catwalk bridges link the furnace deck to two loading platforms — a two-level circuit above a ring corridor. Leaner ammo. | 25 |
| **HIGH GROUND** | Skyspire | A stepped ziggurat in an open plaza; the stairs spiral around the tower. Long sightlines everywhere, so the roof is worth taking. Deploys you with the **Longview Railgun** and slightly more ammo. | 20 |
| **BLACKOUT SWEEP** | Undercroft | A 3×3 basement warren of head-high dividers, pillars and two raised supply vaults. Short sightlines, ambushes, **no leash** — and the vents seal in **6:00**. | 24 |

Every arena is built from the same dependency-free kit, so collision geometry
and the level you see can never disagree, and all four are checked by the
headless validator below.

## Difficulty

Chosen per mission; it scales the robots, your economy and your score.

| Tier | Enemy HP | Enemy damage | Speed | Aim error | Enemy sight | Damage you take | Ammo | Start grenades | Score |
|---|---|---|---|---|---|---|---|---|---|
| **EASY** | ×0.75 | ×0.55 | ×0.90 | ±7.5% | ×0.85 | ×0.65 | ×1.6 | 5 | ×0.75 |
| **NORMAL** | ×1 | ×1 | ×1 | ±3.5% | ×1 | ×1 | ×1 | 3 | ×1 |
| **HARD** | ×1.35 | ×1.40 | ×1.08 | ±2.0% | ×1.12 | ×1.45 | ×0.8 | 2 | ×1.6 |
| **NIGHTMARE** | ×1.80 | ×1.90 | ×1.16 | ±1.1% | ×1.25 | ×2.0 | ×0.6 | 1 | ×2.5 |

"Aim error" is the size of the enemy's aim cone as a fraction of range: at 20 m
a Nightmare shooter misses by ~0.2 m, an Easy one by ~1.5 m. Scenario rules
stack on top (Skyspire starts you on the railgun, Undercroft is timed, and so
on). Tier-2 elites in the level data still get their own +14% HP / +7% damage.

## Controls

| Action | Key |
|---|---|
| Move | `W A S D` / arrow keys |
| Sprint | hold `Shift` |
| Jump | `Space` |
| Look | Mouse (pointer lock) |
| Fire | Left mouse |
| Scope zoom (railgun only) | hold Right mouse |
| Reload | `R` |
| Throw grenade | `G` |
| Switch weapon | `1` … `5` or mouse wheel |
| Pause | `Esc` or `P` |

## How enemies notice you

Pre-placed robots idle (scanning around) or patrol a loop near their post
until one of these happens:

- **Sight** — you are within their view range (shooters spot you from far
  away, grunts only fairly close) with an unobstructed line of sight. The
  range is scaled by difficulty.
- **Hearing** — you walk right up to them (~8 m), even behind cover.
- **Gunfire** — every shot makes noise: pistol ~16 m, SMG ~21 m, railgun
  ~34 m. Enemies inside that radius wake up whether they can see you or not.
  Explosions (rockets, grenades) alert a huge radius.
- **Chained alarm** — when one robot is alerted (or shot), allies within
  ~12–13 m are alerted with it. Fights tend to happen in groups — the ones
  you can see.
- **Leash** — chase you too far from their post and they disengage and walk
  home, so you can't accidentally pull a whole arena into one corner.
  (Undercroft switches this off.)

An alerted enemy flashes, its health bar appears, and a short alarm beep plays
(with a "CONTACT!" toast once per engagement).

## The weapons

| # | Weapon | Type | Character |
|---|---|---|---|
| 1 | **M9 Sidearm** | hitscan | Semi-auto, infinite reserve ammo, *quiet* — pick off lone guards without waking the block |
| 2 | **Viper SMG** | hitscan | Full-auto, fast, spread blooms while spraying |
| 3 | **ARC-9 Tesla Gun** | hitscan | Full-auto arc bolts that chain to up to 3 nearby robots with falloff |
| 4 | **Longview Railgun** | hitscan | 130 dmg, right-mouse scope (FOV zoom + scope overlay) — but the shot is loud |
| 5 | **Hellfire RPG** | projectile | Rocket with splash damage — careful, it can hurt you too |

Each weapon has its own procedural 3D viewmodel (rendered in a separate scene
pass so it never clips into walls), recoil spring, muzzle flash + light,
tracers, headshot multipliers, reload timing and ammo economy.

### Grenades (`G`)

Carried throwables rather than a weapon slot: you deploy with 3 (modified by
difficulty, max 6), and each ammo crate adds **+1**. They arc with your
movement momentum, bounce off walls and crates, blink faster as the 2.2 s fuse
burns down, then detonate for splash damage — including to you at point-blank
range.

## Gameplay

- All enemies exist from the start: **grunts** (fast melee, short sight),
  **shooters** (keep distance, glowing projectiles, long sight) and
  **heavies** (tanky, 3-round bursts, bigger model). Tier-2 elites guard the
  best positions (+14% HP, +7% damage, double score).
- Enemies drop **health kits** and **ammo crates**; more supplies are placed
  around each arena (13 per map — the best caches are guarded).
- Headshots deal 2.2× damage; hitmarkers turn red on kills.
- Score, kills, mission timer, hostiles `remaining/total`, dynamic crosshair
  (opens up with spread/movement), directional damage indicators, health
  vignette and a short death cam.
- Victory: eliminate every hostile → **SECTOR CLEARED** with a clear bonus
  (1000) plus a time bonus (up to 1500, decaying the longer you take), both
  multiplied by the difficulty's score factor. Undercroft also has a **time
  limit**; run it out and you get **TIME EXPIRED** instead.

## Project structure

```
index.html          HUD markup, deploy screen, three.js import map
css/style.css       neon HUD styling, screens, pickers, animations
package.json        "type": "module" + `npm run validate` (no deps, no build)
js/main.js          renderer, game states, mission setup, loop, input
js/scenarios.js     scenario + difficulty definitions (pure data, no imports)
js/kit.js           pure level-construction kit: shapes + collision solids
js/maps/            one module per arena (compound, foundry, spire, catacomb)
js/world.js         builds every arena once, swaps the active one, sky/lights
js/player.js        mouse look, WASD physics, jump/gravity, step-assist, bob, shake, death cam
js/weapons.js       5 weapon definitions (+ noise radii), viewmodels, hitscan/rockets, reload/switch/zoom
js/grenades.js      throwable frag grenades (fuse, bounce physics, shared explosion)
js/enemies.js       3 enemy types, idle/patrol + sight/hearing/noise alarm AI, difficulty scaling
js/physics.js       circle-vs-AABB collision, step support, ground snapping (shared)
js/pickups.js       health/ammo: permanent level placements + timed kill drops
js/effects.js       sparks, tracers, explosions, glow textures
js/audio.js         procedural WebAudio SFX (shots, explosion, hitmarks, alarm, victory, UI)
js/hud.js           DOM HUD, deploy-screen pickers, screens
tools/validate-maps.mjs   headless placement + reachability validator
tools/check-wiring.mjs    import / DOM-id / cache-buster checker
```

## Validating a level

Hand-built 3D geometry is easy to get subtly wrong — an enemy buried in a
wall, a supply crate on a roof with no way up. There is no build step, so
`npm run validate` replays every map through the **same kit the browser
uses** and checks the things you cannot eyeball:

```bash
npm install          # not required — there are no dependencies
npm run validate
```

```
scenarios
  NEON COMPOUND [compound]       arena 62  enemies 26  supplies 13  solids 132  unreachable 0
  SLAGWORKS FOUNDRY [foundry]    arena 54  enemies 25  supplies 13  solids  86  unreachable 0
  ...
```

`tools/validate-maps.mjs` fails the run when a placement is inside geometry,
when the spawn is blocked, or when an enemy/pickup cannot be **reached on
foot**: it flood-fills a 0.25 m grid of standable heights from the spawn using
the same movement rules as the game (0.56 m step-assist, gravity for drops,
and the player's ~1.45 m jump). `tools/check-wiring.mjs` then verifies that
every relative import resolves, that every DOM id the HUD looks up exists in
`index.html`, and that the `?v=N` cache-busters agree.

## Tweaking

Balance lives in plain data at the top of each system:

- **Difficulty** → `DIFFICULTIES` in `js/scenarios.js` (stat, ammo, economy and
  score multipliers per tier).
- **Scenarios & mission rules** → `SCENARIOS` in `js/scenarios.js`
  (`timeLimit`, `startWeapon`, `startGrenades`, `ammoScale`, `alertOnStart`,
  `noLeash` — all optional).
- **Level layout, enemy placements and supply placements** → one module per
  arena under `js/maps/`. A map is a pure function that receives the kit
  (`k.addBox`, `k.addStairs`, `k.addPylon`, `k.addPerimeter`) and returns
  `{ arena, spawn, enemies, pickups }`. Register a new one in
  `js/maps/index.js` and point a scenario at it with `mapId`.
  Placements are validated against the geometry at load time (a bad spot logs
  a warning and is skipped) and by `npm run validate`; stairs must keep steps
  ≤ 0.56 high so the shared step-assist works.
- Weapon feel → `WEAPON_DEFS` in `js/weapons.js` (damage, RPM via `fireDelay`,
  spread/bloom, recoil, mag/reserve, zoom FOV, `noise` alert radius…).
- Enemy types & alert behaviour → `ENEMY_TYPES` in `js/enemies.js`
  (`see`/`hear`/`chain`/`leash` ranges, HP, speed, damage).

Adding an arena costs one file: copy the structure of an existing module in
`js/maps/`, describe the layout with kit calls, list the enemies and supplies,
and run `npm run validate`.
