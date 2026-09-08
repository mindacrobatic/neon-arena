# NEON COMPOUND — a Three.js ego shooter

A browser-based first-person **exploration shooter** built with plain
[three.js](https://threejs.org/) (r160, loaded from CDN via import map).
No build step, no assets — all geometry, textures and sounds are generated
procedurally in code.

Instead of enemies popping in from nowhere, **every hostile is pre-placed in
the level from the first second**: robots guard, patrol and scan their zones,
and only engage when they notice you. Scout first, then choose how and when
each fight starts. Clear the compound to win.

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
> no cache headers, so browsers can keep stale JS modules in memory while
> loading a fresh `index.html`. Every module import therefore carries a
> `?v=N` cache-buster. **After editing any `js/` file, bump the version in all
> import specifiers and in `index.html`** (e.g. `sed -i '' 's/?v=2/?v=3/g' js/*.js index.html`),
> or simply hard-reload the page (Cmd/Ctrl+Shift+R).

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

## The compound

You deploy in the **arrival plaza** at the south end of a walled compound:

- **Central courtyard** — a raised command platform with stairs on both sides;
  a heavy guards the top, plainly visible from the gate before you commit.
- **East industrial yard** — shipping-container lanes and a climbable vantage
  point (crate stack → low container roof) with a shooter on it.
- **West terrace** — a raised deck with stairs and parapets overlooking the
  courtyard: a natural sniper perch, with supplies on top.
- **North transit corridor** — the approach to the **north stronghold**, a
  gated walled compound with a bunker you can climb, elite roof guards and a
  supply cache at the back.
- **Flank alleys** — loop routes around the stronghold walls with side doors,
  so every zone can be approached from more than one direction.

**26 enemies** are placed across these zones from the start (HUD shows
`remaining/total`), plus 13 pre-placed health/ammo supplies. Killing the last
hostile ends the mission with a **SECTOR CLEARED** screen (score + clear/time
bonus).

## How enemies notice you

Pre-placed robots idle (scanning around) or patrol a loop near their post
until one of these happens:

- **Sight** — you are within their view range (shooters spot you from far
  away, grunts only fairly close) with an unobstructed line of sight.
- **Hearing** — you walk right up to them (~8 m), even behind cover.
- **Gunfire** — every shot makes noise: pistol ~16 m, SMG ~21 m, railgun
  ~34 m. Enemies inside that radius wake up whether they can see you or not.
  Explosions (rockets, grenades) alert a huge radius.
- **Chained alarm** — when one robot is alerted (or shot), allies within
  ~12–13 m are alerted with it. Fights tend to happen in groups — the ones
  you can see.
- **Leash** — chase you too far from their post and they disengage and walk
  home, so you can't accidentally pull the whole compound into one corner.

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

Carried throwables rather than a weapon slot: you deploy with **3** (max 6),
and each ammo crate adds **+1**. They arc with your movement momentum, bounce
off walls and crates, blink faster as the 2.2 s fuse burns down, then
detonate for splash damage — including to you at point-blank range.

## Gameplay

- All enemies exist from the start: **grunts** (fast melee, short sight),
  **shooters** (keep distance, glowing projectiles, long sight) and
  **heavies** (tanky, 3-round bursts, bigger model). Three tier-2 elites
  guard the north stronghold (+14% HP, +7% damage, double score).
- Enemies drop **health kits** and **ammo crates**; more supplies are placed
  around the compound (the best caches are guarded — north stronghold).
- Headshots deal 2.2× damage; hitmarkers turn red on kills.
- Score, kills, mission timer, hostiles `remaining/total`, dynamic crosshair
  (opens up with spread/movement), directional damage indicators, health
  vignette and a short death cam.
- Victory: eliminate all 26 hostiles → **SECTOR CLEARED** with a clear bonus
  (1000) plus a time bonus (up to 1500, decaying the longer you take).

## Project structure

```
index.html          HUD markup, menus, three.js import map
css/style.css       neon HUD styling, screens, animations
js/main.js          renderer, game states (menu/playing/dying/paused/gameover/victory), loop, input
js/world.js         the compound: zones, walls, stairs, pylons, enemy + supply placements
js/player.js        mouse look, WASD physics, jump/gravity, step-assist, bob, shake, death cam
js/weapons.js       5 weapon definitions (+ noise radii), viewmodels, hitscan/rockets, reload/switch/zoom
js/grenades.js      throwable frag grenades (fuse, bounce physics, shared explosion)
js/enemies.js       3 enemy types, idle/patrol + sight/hearing/noise alarm AI, projectiles
js/physics.js       circle-vs-AABB collision, step support, ground snapping (shared)
js/pickups.js       health/ammo: permanent level placements + timed kill drops
js/effects.js       sparks, tracers, explosions, glow textures
js/audio.js         procedural WebAudio SFX (shots, explosion, hitmarks, alarm, victory, UI)
js/hud.js           DOM HUD binding + screens
```

## Tweaking

Balance lives in plain data at the top of each system:

- Weapon feel → `WEAPON_DEFS` in `js/weapons.js` (damage, RPM via `fireDelay`,
  spread/bloom, recoil, mag/reserve, zoom FOV, `noise` alert radius…).
- Enemy types & alert behaviour → `ENEMY_TYPES` in `js/enemies.js`
  (`see`/`hear`/`chain`/`leash` ranges, HP, speed, damage).
- **Level layout, enemy placements and supply placements** → `rawEnemies` /
  `rawPickups` and the `addBox(...)` calls in `js/world.js`. Placements are
  validated against the geometry at load time (a bad spot logs a warning and
  is skipped), and stairs/platforms must keep steps ≤ 0.56 high so the
  step-assist works.
