# Bitcoin Price War

Live BTC/USD market data rendered as a real-time war between buyers (green) and sellers (red), built with Three.js.

**The battlefield is the order book.** The frontline is the live price. Aggressive market orders charge the line, consumed liquidity dies at it, resting depth stands behind it as walls, and every 1-minute candle is a battle round.

## Run it

```bash
npm install
npm run dev        # open the printed localhost URL
```

## Feed selection

Auto mode tries **Binance → Bitstamp → simulated**, falling back if a socket can't connect (e.g. geo-blocking). Force one with a URL param:

```
http://localhost:5173/?feed=fake       # simulated battle (great for demos)
http://localhost:5173/?feed=binance
http://localhost:5173/?feed=bitstamp
```

The dot in the top-left shows what you're watching: green = live exchange feed, orange = simulated.

## Mechanics → market mapping

| Battlefield | Market |
|---|---|
| Frontline position | Live price (drifts, then re-centers) |
| Green/red charges | Market buys / sells from the trade tape |
| Troop count per charge | Trade size, log-scaled vs rolling average |
| Casualties + skulls | Liquidity consumed by aggressive orders |
| Walls behind each army | Order book depth ($10 buckets, height ∝ √size) |
| Giant unit + camera shake | Whale trade (adaptive threshold, ~6+ BTC) |
| Round banner every minute | 1-min candle close: body = ground gained |
| Tug-of-war bar | Rolling buy vs sell volume |

## Architecture

```
src/
  market/    feed.js (auto-fallback), adapters/ (binance, bitstamp, fake),
             candles.js, normalize.js
  sim/       battle.js  — pure JS simulation, no rendering deps (unit-testable)
  render/    scene.js, armies.js (InstancedMesh), walls.js, effects.js, camera.js
  ui/        hud.js
test/        sim-smoke.js  — headless sim test (npm run test:sim)
```

Data flows one way: `feed → normalize/candles → battle sim → renderer`. The sim never touches Three.js, and the renderer never touches WebSockets, so either side can be swapped (new exchange, new art style) independently.

## Controls

Drag to orbit, scroll to zoom. Camera auto-orbits slowly until you grab it. Shakes on whales and violent candles.

## Roadmap

- [x] Phase 1–3: battlefield, live feeds, market mechanics
- [ ] Phase 4: drama pass — sound, tracer particles, kill streaks, liquidation cascades
- [ ] Toy-soldier model skin (swap geometry in `render/armies.js`)
- [ ] Multi-asset: ETH front, second theater of war
