// Simulated market feed — same event shape as the live adapters.
// Regime-switching random walk with poisson trades, persistent walls, whales.

function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const REGIMES = [
  { name: 'calm',     vol: 1.2, drift: 0,    rate: 5  },
  { name: 'grind-up', vol: 2.2, drift: 2.2,  rate: 11 },
  { name: 'grind-dn', vol: 2.2, drift: -2.2, rate: 11 },
  { name: 'violent',  vol: 7.5, drift: 0,    rate: 26 },
  { name: 'squeeze',  vol: 5.5, drift: 5,    rate: 22 },
  { name: 'dump',     vol: 6.5, drift: -5.5, rate: 24 },
];

export function createFakeFeed(emit) {
  let stopped = false;
  let p = 117500 + (Math.random() - 0.5) * 3000;
  let regime = REGIMES[0];
  const walls = []; // { side:'bid'|'ask', off:levelIndex, qty, until }
  const timers = [];
  const iv = (fn, ms) => timers.push(setInterval(fn, ms));

  // regime switching
  iv(() => { regime = REGIMES[Math.floor(Math.random() * REGIMES.length)]; }, 11000);

  // price drift
  iv(() => { p = Math.max(5000, p + regime.drift * 0.6 + gauss() * regime.vol * 2); }, 100);

  // spawn/expire persistent walls
  iv(() => {
    if (Math.random() < 0.4) {
      walls.push({
        side: Math.random() < 0.5 ? 'bid' : 'ask',
        off: 3 + Math.floor(Math.random() * 12),
        qty: 60 + Math.random() * 260,
        until: Date.now() + 8000 + Math.random() * 30000,
      });
    }
  }, 5000);

  // depth snapshots
  iv(() => {
    if (stopped) return;
    const now = Date.now();
    for (let i = walls.length - 1; i >= 0; i--) if (walls[i].until < now) walls.splice(i, 1);
    const step = 8;
    const mk = (sign, sideName) => {
      const out = [];
      for (let i = 1; i <= 20; i++) {
        let q = 1.2 * Math.exp(gauss() * 0.9) + 0.4;
        for (const w of walls) if (w.side === sideName && w.off === i) q += w.qty;
        out.push([p + sign * i * step, q]);
      }
      return out;
    };
    emit('depth', { bids: mk(-1, 'bid'), asks: mk(1, 'ask'), ts: now });
  }, 150);

  // trades (poisson arrivals, variable rate)
  const tradeLoop = () => {
    if (stopped) return;
    const pBuy = 0.5 + Math.max(-0.28, Math.min(0.28, regime.drift * 0.08 + gauss() * 0.05));
    const side = Math.random() < pBuy ? 'buy' : 'sell';
    let qty = Math.exp(gauss() * 1.35 - 2.4);
    if (Math.random() < 0.004) qty = 10 + Math.random() * 55; // whale
    qty = Math.min(qty, 90);
    p += (side === 'buy' ? 1 : -1) * qty * 0.9 * (0.5 + Math.random()); // impact
    emit('trade', { side, price: p + (side === 'buy' ? 3 : -3), qty, ts: Date.now() });
    timers.push(setTimeout(tradeLoop, Math.max(15, -Math.log(Math.random()) * 1000 / regime.rate)));
  };
  timers.push(setTimeout(tradeLoop, 80));

  emit('status', { name: 'SIMULATED BATTLE', live: false });
  return {
    name: 'fake',
    stop() { stopped = true; timers.forEach(t => { clearInterval(t); clearTimeout(t); }); },
  };
}
