# NEON ARENA — a Three.js ego shooter

A browser-based first-person wave survival shooter built with plain
[three.js](https://threejs.org/) (r160, loaded from CDN via import map).
No build step, no assets — all geometry, textures and sounds are generated
procedurally in code.

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

## The weapons

| # | Weapon | Type | Character |
|---|---|---|---|
| 1 | **M9 Sidearm** | hitscan | Semi-auto, infinite reserve ammo — your fallback |
| 2 | **Viper SMG** | hitscan | Full-auto, fast, spread blooms while spraying |
| 3 | **Breach-12 Shotgun** | hitscan | 9 pellets, massive close-range damage with falloff |
| 4 | **Longview Railgun** | hitscan | 130 dmg, right-mouse scope (FOV zoom + scope overlay), precise when still |
| 5 | **Hellfire RPG** | projectile | Rocket with splash damage — careful, it can hurt you too |

Each weapon has its own procedural 3D viewmodel (rendered in a separate scene
pass so it never clips into walls), recoil spring, muzzle flash + light,
tracers, headshot multipliers, reload timing and ammo economy.

### Grenades (`G`)

Carried throwables rather than a weapon slot: you deploy with **3** (max 6),
and each ammo crate or cleared wave adds **+1**. They arc with your movement
momentum, bounce off walls and crates, blink faster as the 2.2 s fuse burns
down, then detonate for splash damage — including to you at point-blank range.

## Gameplay

- Endless waves of robots: **grunts** (fast melee), **shooters** (keep distance,
  glowing projectiles) and **heavies** (tanky, 3-round bursts, bigger model).
- Waves scale in count, HP and damage; new types unlock at waves 2 and 3.
- Enemies drop **health kits** and **ammo crates**; clearing a wave grants a
  score bonus and replenishes reserves.
- Headshots deal 2.2× damage; hitmarkers turn red on kills.
- Score, kills, wave counter, dynamic crosshair (opens up with spread/movement),
  directional damage indicators, health vignette and a short death cam.

## Project structure

```
index.html          HUD markup, menus, three.js import map
css/style.css       neon HUD styling, screens, animations
js/main.js          renderer, game states (menu/playing/dying/paused/gameover), loop, input
js/world.js         arena: lights, sky, floor, cover, stairs, glowing pylons, spawn points
js/player.js        mouse look, WASD physics, jump/gravity, step-assist, bob, shake, death cam
js/weapons.js       5 weapon definitions, viewmodels, hitscan/rockets, reload/switch/zoom
js/grenades.js      throwable frag grenades (fuse, bounce physics, shared explosion)
js/enemies.js       3 enemy types, AI (chase/strafe/windup/LOS bursts), waves, projectiles
js/physics.js       circle-vs-AABB collision, step support, ground snapping (shared)
js/pickups.js       health/ammo drops
js/effects.js       sparks, tracers, explosions, glow textures
js/audio.js         procedural WebAudio SFX (shots, explosion, hitmarks, UI)
js/hud.js           DOM HUD binding + screens
```

## Tweaking

Balance lives in plain data at the top of each system:

- Weapon feel → `WEAPON_DEFS` in `js/weapons.js` (damage, RPM via `fireDelay`,
  spread/bloom, recoil, mag/reserve, zoom FOV…).
- Enemy types & wave scaling → `ENEMY_TYPES` and `waveComposition()` in `js/enemies.js`.
- Arena layout → the `addBox(...)` calls in `js/world.js`.
