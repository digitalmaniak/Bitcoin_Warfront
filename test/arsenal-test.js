// Arsenal tier mapping test (deterministic rng): trades must land in the
// right weapon tier, always deliver infantry, and escalation dice must fire
// near a boundary when the roll is low.
import { createArsenal, TIERS } from '../src/sim/arsenal.js';
import { createNormalizer } from '../src/market/normalize.js';

const norm = createNormalizer();
for (let i = 0; i < 200; i++) norm.add(0.1); // settle ema ≈ 0.1 → whaleQty 4.5 (r=45)

const calls = [];
const events = [];
const battleStub = { onTrade: (side, n, opts) => calls.push({ side, n, opts }) };
const busStub = { emit: (type, d) => events.push({ type, ...d }) };

// rng → 0.999: dice never escalate (deterministic tier mapping)
const arsenal = createArsenal(norm, battleStub, busStub, () => 0.999);
const whaleR = norm.whaleQty / norm.ref;

const cases = [
  [2, null],
  [7, 'grenade'],            // ≥ 5
  [15, 'tank'],              // ≥ 12
  [30, 'heli'],              // ≥ 25
  [whaleR * 1.2, 'airstrike'],
  [whaleR * TIERS.CARPET_X * 1.1, 'carpet'],
  [whaleR * TIERS.MOAB_X * 1.1, 'moab'],
];

let failed = 0;
for (const [mult, expected] of cases) {
  calls.length = 0; events.length = 0;
  const qty = mult * norm.ref;
  arsenal.process({ side: 'buy', qty, price: 117000, ts: Date.now() });
  const got = events[0]?.type || null;
  const infantry = calls.length === 1 && calls[0].n >= 1;
  const ok = got === expected && infantry;
  console.log(`${ok ? '✅' : '❌'} r≈${mult.toFixed(0)} → ${got || 'infantry only'} (expected ${expected || 'infantry only'}), infantry n=${calls[0]?.n}`);
  if (!ok) failed++;
}

// dice test: rng → 0 escalates a near-boundary trade one rung up
const diceArsenal = createArsenal(norm, battleStub, busStub, () => 0);
events.length = 0; calls.length = 0;
diceArsenal.process({ side: 'sell', qty: 11 * norm.ref, price: 117000, ts: Date.now() }); // r=11, just under tank
const diceOk = events[0]?.type === 'tank';
console.log(`${diceOk ? '✅' : '❌'} dice escalate r=11 grenade→tank on low roll: ${events[0]?.type}`);
if (!diceOk) failed++;

console.log(failed ? `\n${failed} FAILED` : '\nARSENAL TEST PASSED');
process.exit(failed ? 1 : 0);
