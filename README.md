# Ember Archive

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Made with JavaScript](https://img.shields.io/badge/Made%20with-JavaScript-F7DF1E.svg)](game/src/main.js)
[![make.fun bounty](https://img.shields.io/badge/make.fun-best--stealth--game-blue.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

**Ember Archive** — a complete original top-down stealth game. You are the infiltrator:
steal all **6 intel files** from the night archive and slip out the **EXIT** unseen, past
**5 wardens** walking **5 learnable patrol routes**, using **13 hiding spots** (8 crates,
5 shadow pools) and 3 throwable coins across 3 routes through one rich level.

Entry for the [best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759)
on make.fun. Static files under `game/` — no build step, no network requests, everything
loaded from `game/` or `data:` URIs. Serve with `node serve.ts` and open
http://localhost:8080.

## How it plays

- **Guards with vision cones** — each warden sees a lit cone clipped by walls; the lit
  floor is exactly the floor it can see. Cones turn amber as suspicion grows, red on alarm.
- **Detection with a chance to recover** — suspicion rises while you are seen (fast up
  close, slow at range, slower still while sneaking or standing in shadow) and drains
  while you stay hidden. A full meter sounds the alarm: the guard chases you, and on
  losing sight it searches your last seen spot, looks around, then walks back to patrol.
- **Patrols you can learn** — every warden walks a fixed loop and pauses at each waypoint.
  Wait for the gap, cross behind the cone, and the route is yours.
- **Three routes** — the north corridor, the central hall, and the west shadow lane all
  cross the archive, so a blocked route is never a dead end.
- **Coins** — toss one to make the nearest warden go and look where it landed.
- **Score and timer** — 500 points per intel file, a time bonus for a fast clean escape,
  a penalty per alarm. The exit stays locked until all 6 files are stolen.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift (hold) | Sneak — slower, quieter, harder to spot |
| R (hold) | Hurry — faster, louder, easier to spot |
| E | Pick up an intel file |
| C or right-click | Throw a coin toward the cursor (3 coins) |
| Left-click | Walk to that spot |
| P / Esc | Pause |
| Space / Enter | Start, restart after being caught or escaping |

## Sound

All sound is synthesised in code with WebAudio (`game/src/audio.js`): footsteps whose
pace and loudness follow your movement and the nearest guard, a two-tone alert stinger,
pickup blips, and a win figure. No sound files.

## Facts

- 1 level, 24 × 16 tiles, seen from above
- 5 guards, 5 patrol routes
- 13 hiding spots (8 crates, 5 shadow pools)
- 6 intel files to steal, 3 coins to throw
- 9 source files, one clear job each (`game/src/level.js`, `guards.js`, `vision.js`,
  `player.js`, `input.js`, `audio.js`, `render.js`, `shots.js`, `main.js`)

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and
  writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`
- `game/` — the playable game (`index.html` + `src/*.js`)
- `screenshots/` — 4 real renders of the game in a browser (`?shot=cover|patrol|alarm|exit`)
- `serve.ts` — serves `game/` on localhost for play-testing
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
