# Neon Compound

**Scout the arena. Choose your approach. Clear the sector.**

A browser-based first-person shooter built with [Three.js](https://threejs.org/).
Explore four handcrafted arenas where robots guard, patrol, and react to what
they see and hear. Every enemy is in place from the start, so you can scout a
route before starting a fight.

**4 arenas · 4 difficulty levels · 5 weapons · Procedural visuals and audio**

No build step or asset downloads to manage. Geometry, textures, and sound effects
are generated in code; Three.js r160 loads from a CDN.

[Quick start](#quick-start) · [Controls](#controls) · [Missions](#missions) ·
[Weapons](#weapons) · [Enemy behavior](#enemy-behavior) · [Development](#development)

## Quick start

From the project folder, start a local web server:

```bash
python3 -m http.server 8000
```

1. Open [localhost:8000](http://localhost:8000) in a modern desktop browser.
2. Choose a scenario and difficulty on the deploy screen.
3. Select **DEPLOY** to play. Press **Esc** or **P** to pause.

Python 3 is needed for this server command. No package installation is required
to play. An internet connection is needed to load Three.js unless your browser
already has it cached.

> **Your objective:** eliminate every hostile. In Blackout Sweep, you must also
> finish before the six-minute timer expires.

## Controls

| Action | Control |
| :--- | :--- |
| Move | `W` `A` `S` `D` or arrow keys |
| Look | Mouse, captured during play |
| Sprint | Hold `Shift` |
| Jump | `Space` |
| Fire | Left mouse button |
| Scope, railgun only | Hold right mouse button |
| Reload | `R` |
| Throw grenade | `G` |
| Switch weapon | `1`–`5` or mouse wheel |
| Pause | `Esc` or `P` |

## Missions

Selecting a scenario previews its arena behind the menu. The mission panel
shows its objective, enemy and supply counts, and special rules. Use
**MISSION SELECT** from the pause, defeat, or victory screen to choose again.

| Scenario | Arena | Hostiles | What to expect |
| :--- | :--- | ---: | :--- |
| **Assault** | Neon Compound | 26 | An open-ended compound with container yards, raised positions, and flank routes. |
| **Close Quarters** | Slagworks Foundry | 25 | A central furnace, ring corridor, and connected catwalks. Less reserve ammo. |
| **High Ground** | Skyspire | 20 | A tiered tower with long sightlines. Start with the railgun selected, extra reserve ammo, and fewer grenades. |
| **Blackout Sweep** | Undercroft | 24 | A basement maze with short sightlines. Six-minute limit; guards have no distance limit on pursuit. |

### Difficulty

Difficulty changes enemy strength and awareness, your supplies, and score rewards.
Scenario rules apply on top of these settings.

| Difficulty | Experience | Reserve ammo | Score multiplier |
| :--- | :--- | :---: | :---: |
| **Easy** | Weaker, slower guards and generous supplies | ×1.6 | ×0.75 |
| **Normal** | The default balance | ×1 | ×1 |
| **Hard** | Tougher, more accurate guards and limited supplies | ×0.8 | ×1.6 |
| **Nightmare** | Fast, heavily armored guards with sharp aim | ×0.6 | ×2.5 |

<details>
<summary><strong>Detailed difficulty values</strong></summary>

Values are multipliers unless shown otherwise. Lower aim error means more
accurate shots. Enemy damage and damage received are separate settings that
both affect incoming enemy attacks.

| Setting | Easy | Normal | Hard | Nightmare |
| :--- | ---: | ---: | ---: | ---: |
| Enemy health | ×0.75 | ×1 | ×1.35 | ×1.80 |
| Enemy damage | ×0.55 | ×1 | ×1.40 | ×1.90 |
| Enemy speed | ×0.90 | ×1 | ×1.08 | ×1.16 |
| Aim error, radians | 0.075 | 0.035 | 0.020 | 0.011 |
| Sight range | ×0.85 | ×1 | ×1.12 | ×1.25 |
| Hearing range | ×0.80 | ×1 | ×1.10 | ×1.20 |
| Damage received | ×0.65 | ×1 | ×1.45 | ×2.0 |
| Starting grenades, standard missions | 5 | 3 | 2 | 1 |

High Ground uses a lower base grenade count. Tier-2 elites receive a further
14% health and 7% damage increase, and award double score.

</details>

## Weapons

| Slot | Weapon | Best use and tradeoff |
| :---: | :--- | :--- |
| `1` | **M9 Sidearm** | Semi-automatic, unlimited reserve ammo, and a smaller noise radius. Useful against isolated guards. |
| `2` | **Viper SMG** | Rapid automatic fire. Spread increases during sustained bursts. |
| `3` | **ARC-9 Tesla Gun** | Automatic arc bolts chain to up to three additional robots, losing damage with each jump. |
| `4` | **Longview Railgun** | Scoped, high-damage shots with 130 base damage. Its loud report alerts distant guards. |
| `5` | **Hellfire RPG** | Rockets deal splash damage to groups—and can hurt you at close range. |

Each weapon has a procedural 3D model, recoil, muzzle effects, and its own reload
and ammo behavior. Headshots deal **2.2× damage**; hitmarkers turn red on a kill.

### Frag grenades

Press **G** to throw without changing weapons. Grenades carry your movement
momentum, bounce off surfaces, and detonate after **2.2 seconds**. Their splash
damage can hurt you, too.

You normally start with **3 grenades**, adjusted by difficulty and scenario.
Ammo crates restore **1 grenade**, up to a maximum of **6**.

## Enemy behavior

The arenas contain three robot types: fast melee **grunts**, ranged **shooters**,
and durable **heavies** that fire three-round bursts. Elite variants guard
valuable positions.

- **Scout before firing.** Guards scan or patrol until they detect a disturbance.
  Cover and their facing direction matter.
- **Watch the amber question mark.** Suspicion builds before combat. Break sight
  and stay quiet to let it fade; partial suspicion does not alert nearby guards.
- **Manage your noise.** Walking is quieter than sprinting. Gunfire and explosions
  can alert enemies behind cover, and an alerted guard can warn nearby allies.
- **Break contact to escape.** Guards investigate the last place they saw or heard
  you, search, and return to their posts if they cannot find you.
- **Use the terrain.** Robots follow routes around obstacles and up stairs, but
  cannot jump. Most stop pursuing beyond their patrol area; Undercroft removes
  that distance limit.

An alerted guard flashes, reveals its health bar, and sounds an alarm. The HUD
shows **CONTACT!** once per engagement.

<details>
<summary><strong>Detection and pursuit reference</strong></summary>

| Mechanic | Behavior |
| :--- | :--- |
| Vision | 110° forward cone, with a ±45° vertical limit except at very close horizontal range. Requires clear line of sight; range scales with difficulty. |
| Visual suspicion | Sustained sight fills the meter in about 0.9 seconds after detection. |
| Footsteps | Walking reaches 40% of hearing range, about 3.2–3.6 m on Normal. Sprinting reaches the full 8–9 m. Standing still and airborne movement produce no footstep noise. |
| Sound suspicion | Hearing alone fills the meter in 1.5 seconds. Guards turn toward the noise, which may expose you to visual detection. |
| Suspicion decay | Without sight or noise, a full meter would take about 1.54 seconds to empty. |
| Gunfire | Approximate alert radii: sidearm 16 m, SMG 21 m, railgun 34 m. Explosions alert a much larger area. |
| Ally alarms | Alert nearby guards within about 12–13 m and share a remembered contact location. |
| Search | Guards investigate the last known contact and scan there for four seconds. After 20 seconds without fresh evidence, a long or failed pursuit becomes a search in place. |
| Navigation | Patrol, investigation, and return routes use collision-checked waypoint graphs. Unreachable targets do not trigger movement through walls. |

Breaking sight while staying quiet stops the remembered player position from
updating. Gunfire and explosions provide new sound locations; ally alarms share
a contact location rather than continuously revealing the player. Ranged guards
keep their distance while they can see you, then investigate when sight is lost.

</details>

## Supplies and scoring

Each arena has **13 placed supplies**, with valuable caches guarded by enemies.
Defeated robots can also drop health kits and ammo crates.

Clear every hostile to earn **SECTOR CLEARED**, a **1,000-point clear bonus**,
and a time bonus of up to **1,500 points**. Faster clears earn more; both bonuses
scale with difficulty. In Undercroft, running out of time ends the mission with
**TIME EXPIRED**.

The HUD tracks health, ammo, score, kills, mission time, and remaining hostiles.
Directional damage indicators help locate incoming fire.

## Development

The game uses plain JavaScript modules and runs without a build step. Node.js
is used for the development checks below; no npm dependencies are required.

### Project layout

| Area | Files | Responsibility |
| :--- | :--- | :--- |
| Page and styling | `index.html`, `css/style.css` | Deploy screen, HUD markup, styles, and Three.js import map |
| Game loop | `js/main.js` | Rendering, input, game states, and mission setup |
| Mission data | `js/scenarios.js` | Scenarios, difficulty settings, and mission rules |
| Arenas | `js/maps/`, `js/kit.js`, `js/world.js` | Map layouts, shared construction kit, and arena activation |
| Movement | `js/player.js`, `js/physics.js` | Player controls, collision, jumping, and step support |
| Combat | `js/weapons.js`, `js/grenades.js` | Weapons, projectiles, reloads, and explosions |
| Enemy AI | `js/enemies.js`, `js/perception.js`, `js/navigation.js` | Behavior, detection, and collision-checked pathfinding |
| Feedback and supplies | `js/hud.js`, `js/effects.js`, `js/audio.js`, `js/pickups.js` | Interface, visual effects, procedural audio, and pickups |
| Validation | `tools/`, `package.json` | Map, wiring, perception, navigation, and integration checks |

### Run the checks

```bash
npm run validate
```

This checks all four maps using the same construction kit as the browser:

- **Placement and reachability:** blocked spawns, objects inside geometry, and
  enemies or pickups the player cannot reach.
- **Wiring:** relative imports, HUD element IDs, and matching cache versions.
- **Perception:** vision, movement noise, and suspicion rules.
- **Navigation:** waypoint routes, stairs, body clearance, and unreachable targets.

The map validator uses a 0.25 m grid and the game's movement rules, including
0.56 m step assistance, gravity, and the player's approximately 1.45 m jump.

### Run the AI integration tests

Use **Node.js 22.15+** and a local copy of the **Three.js r160 ES module**.
Point `THREE_MODULE` to that file; if it lives outside a JavaScript module
package, save it with the `.mjs` extension.

```bash
THREE_MODULE=/absolute/path/three.module.mjs npm run test:ai
```

These tests exercise the real enemy update and world activation code, including
raycasts, contact memory, alarms, path following, and stair movement. Only canvas
painting is stubbed. Browser playtesting is still needed to verify visuals and feel.

### Change the game

| To change… | Start here |
| :--- | :--- |
| Difficulty and score multipliers | `DIFFICULTIES` in `js/scenarios.js` |
| Mission rules and starting equipment | `SCENARIOS` in `js/scenarios.js` |
| Arena layouts, enemies, and supplies | The arena module in `js/maps/` |
| Weapon damage, fire rate, spread, recoil, or ammo | `WEAPON_DEFS` in `js/weapons.js` |
| Robot stats, detection ranges, and pursuit limits | `ENEMY_TYPES` in `js/enemies.js` |

To add an arena:

1. Create a module in `js/maps/` using an existing map as a reference.
2. Build geometry with the shared kit (`addBox`, `addStairs`, `addPylon`,
   `addPerimeter`) and return `{ arena, spawn, enemies, pickups }`.
3. Register the map in `js/maps/index.js`, then reference its `mapId` in a scenario.
4. Run `npm run validate` and playtest in the browser.

Keep stair steps at or below **0.56 m** for step assistance. Invalid enemy or
supply placements produce a warning and are skipped at load time; validation
helps catch them before playtesting.

### Refresh after editing

If the browser shows old code or styles, hard-refresh with **Cmd/Ctrl + Shift + R**.
Imports and the stylesheet use matching `?v=N` cache versions. When bumping that
version, update all module import specifiers and the references in `index.html`
together. `npm run validate` catches mismatched versions.
