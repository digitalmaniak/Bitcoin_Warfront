// Arsenal tier mapping test: given a fixed normalizer ref, trades must land
// in the right weapon tier and always deliver infantry.
import { createArsenal } from '../src/sim/arsenal.js';
import { createNormalizer } from '../src/market/normalize.js';

const norm = createNormalizer();
for (let i = 0; i < 200; i++) norm.add(0.1); // settle ema ≈ 0.1

const calls = [];
const events = [];
const battleStub = { onTrade: (side, n, opts) => calls.push({ side, n, opts }) };
const busStub = { emit: (type, d) => events.push({ type, ...d }) };
const arsenal = createArsenal(norm, battleStub, busStub);

const ref = norm.ref;
const cases = [
  // [qty multiplier of ref, expected event or null]
  [1, null],
  [10, 'grenade'],
  [25, 'tank'],
  [70, 'airstrike'],   // > whale threshold (6 BTC floor => 60x when ema small... adaptive)
  [200, 'carpet'],
];

let failed = 0;
for (const [mult, expected] of cases) {
  calls.length = 0; events.length = 0;
  const qty = Math.max(mult * ref, expected === 'airstrike' ? 7 : expected === 'carpet' ? 25 : 0);
  arsenal.process({ side: 'buy', qty, price: 117000, ts: Date.now() });
  const got = events[0]?.type || null;
  const infantry = calls.length === 1 && calls[0].n >= 1;
  const ok = got === expected && infantry;
  console.log(`${ok ? '✅' : '❌'} qty=${qty.toFixed(2)} (r≈${(qty / norm.ref).toFixed(0)}) → ${got || 'infantry only'} (expected ${expected || 'infantry only'}), infantry n=${calls[0]?.n}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nARSENAL TEST PASSED');
process.exit(failed ? 1 : 0);
