# Phase 4 — The Drama Pass

Design principle: **the market decides everything; weapons only dramatize it.**
Trade size (normalized against the rolling average, `r = qty / ema`) maps to an
escalation ladder. Kill counts always come from the same normalized numbers.

## Escalation ladder (`src/sim/arsenal.js`)

| Tier | Trigger | Visual |
|---|---|---|
| Infantry | always | mech charge (log-scaled troop count) |
| Grenades | r ≥ 8 | arc lob + cluster blast |
| Tank | r ≥ 20 | tank deploys, shells the line ~40s |
| Airstrike | whale (adaptive, ~6+ BTC) | jet flyby → missile → big boom |
| Carpet bomb | 3× whale | 3-jet squadron, bombs, slow-mo |

An enemy airstrike landing near a deployed tank destroys it.

## Systems

- `src/core/bus.js` — event bus decoupling sim from FX
- `src/render/fx/tracers.js` — instanced tracer fire; rate ∝ side aggression
- `src/render/fx/explosions.js` — pooled fireball/shockwave/debris/smoke/scorch
- `src/render/fx/grenades.js` — parabolic lobs
- `src/render/units/tank.js`, `jet.js` — procedural merged-primitive vehicles
- `src/render/postfx.js` — UnrealBloom + auto quality degrade (fps-based)
- `src/audio/sound.js` — WebAudio-synthesized gunfire/explosions/jets, no files
- Trauma camera (shake = trauma², rotational noise + roll) in `camera.js`
- Wall-breach detection in `battle.js` → "BUY/SELL WALL BREACHED" banner
- Mech soldiers: merged primitives, walk wobble, still 2 draw calls

## Demo hotkeys

- `1` — inject whale buy (airstrike)
- `2` — inject whale sell
- `3` — liquidation cascade (staggered sells → carpet bomb territory)

Injected trades run through the exact same pipeline as live trades.

## Perf budget (hard caps, preallocated pools)

tracers 128/side · fireballs 12 · rings 12 · debris 400 · smoke 64 ·
scorch 24 · grenades 24 · tanks 5/side · jets 4 · missiles/bombs 12
