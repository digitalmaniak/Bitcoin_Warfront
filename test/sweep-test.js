// Wall-sweep test: after a violent price move, no living non-charging unit
// may remain on the wrong side of the frontline.
import { createBattle, CFG } from '../src/sim/battle.js';

const b = createBattle();
b.setPrice(60000);
for (let i = 0; i < 300; i++) b.update(1 / 60); // settle armies

// violent spike: the wall tweens ~44 units into bear territory; the sweep
// invariant must hold on EVERY frame of the glide
b.setPrice(60000 + 80);
let bullsWrong = 0, bearsWrong = 0, checked = 0;
for (let i = 0; i < 400; i++) {
  b.update(1 / 60);
  for (const u of b.units) {
    if (!u.alive || u.state >= 2 || u.charge) continue; // corpses/doomed/chargers exempt
    checked++;
    if (u.side === 0 && u.x > b.front - 1.19) bullsWrong++;
    if (u.side === 1 && u.x < b.front + 1.19) bearsWrong++;
  }
}

const checks = [
  ['unit-frames checked', checked > 100000, checked],
  ['no bulls past the wall (any frame)', bullsWrong === 0, bullsWrong],
  ['no bears past the wall (any frame)', bearsWrong === 0, bearsWrong],
  ['front glided to target', Math.abs(b.front - 80 * CFG.priceScale) < 0.5, b.front.toFixed(1)],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nSWEEP TEST PASSED');
process.exit(failed ? 1 : 0);
