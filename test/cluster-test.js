// Depth-clustering test: a dominant bid wall must attract a disproportionate
// crowd of that side's soldiers at its price offset.
import { createBattle, CFG } from '../src/sim/battle.js';

const b = createBattle();
const P = 60000;
b.setPrice(P);

// one dominant bid wall $40 below price (300 BTC vs 2 BTC noise levels)
const bids = [[P - 10, 2], [P - 20, 2], [P - 30, 2], [P - 40, 300], [P - 50, 2]];
const asks = [[P + 10, 2], [P + 20, 2], [P + 30, 2], [P + 40, 2], [P + 50, 2]];
b.onDepth({ bids, asks });

// let the army spawn and settle against that book
for (let i = 0; i < 600; i++) {
  b.update(1 / 60);
  if (i % 60 === 0) b.onDepth({ bids, asks }); // book persists
}

const wallOff = 40 * CFG.priceScale; // world-unit offset of the big wall
let bulls = 0, nearWall = 0;
for (const u of b.units) {
  if (!u.alive || u.side !== 0 || u.state >= 2) continue;
  bulls++;
  if (Math.abs(u.ox - wallOff) < 5) nearWall++;
}
const share = nearWall / Math.max(1, bulls);

// uniform over ox 3..42 would put ~26% in a ±5 window; weighted sampling
// (70% of picks → dominant wall) should push it well past 45%
const checks = [
  ['bull army populated', bulls > 300, bulls],
  ['crowd clusters at the big wall', share > 0.45, `${(share * 100).toFixed(0)}%`],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nCLUSTER TEST PASSED');
process.exit(failed ? 1 : 0);
