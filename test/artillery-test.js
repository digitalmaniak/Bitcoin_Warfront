// Artillery budget test: pot tips at ~30× rolling average cumulative volume,
// hardware rotates mortar → tankSortie → strafe, level() stays in [0,1].
import { createArtillery, POT_MULT, KINDS } from '../src/sim/artillery.js';
import { createNormalizer } from '../src/market/normalize.js';

const norm = createNormalizer();
for (let i = 0; i < 200; i++) norm.add(0.1); // ema ≈ 0.1 → cap = max(3, 3) = 3 BTC

const events = [];
const bus = { emit: (t, d) => events.push(d) };
const art = createArtillery(norm, bus);

// 20 small buys of 0.5 BTC = 10 BTC cumulative → 3 pot tips at cap 3
for (let i = 0; i < 20; i++) art.add(0, 0.5);
// one big sell tips the bear pot twice at once
art.add(1, Math.max(3, norm.ref * POT_MULT) * 2.2);

const bullEvents = events.filter((e) => e.side === 0);
const bearEvents = events.filter((e) => e.side === 1);
const rotationOk = bullEvents.every((e, i) => e.kind === KINDS[i % KINDS.length]);
const levelOk = art.level(0) >= 0 && art.level(0) <= 1 && art.level(1) >= 0 && art.level(1) <= 1;

const checks = [
  ['bull pot tips from pooled small trades', bullEvents.length === 3, bullEvents.length],
  ['hardware rotates in order', rotationOk, bullEvents.map((e) => e.kind).join(',')],
  ['big trade tips bear pot multiple times', bearEvents.length === 2, bearEvents.length],
  ['charge level bounded 0..1', levelOk, `${art.level(0).toFixed(2)}/${art.level(1).toFixed(2)}`],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nARTILLERY TEST PASSED');
process.exit(failed ? 1 : 0);
