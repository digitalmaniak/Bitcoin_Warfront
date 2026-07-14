// Price-axis mapping test (with front tween): the wall glides toward the
// true price, rebase fires when the DISPLAY front crosses the threshold,
// preserves the remaining glide, and converges cleanly afterward.
import { createBattle, CFG } from '../src/sim/battle.js';

const S = CFG.priceScale;
const smallMove = (CFG.rebaseAt / S) * 0.6;  // stays under the threshold
const bigMove = (CFG.rebaseAt / S) * 1.4;    // crosses it

const b = createBattle();
b.setPrice(60000);
b.update(1 / 60);

// small move: tween must converge to the exact mapped position, no rebase
b.setPrice(60000 + smallMove);
for (let i = 0; i < 500; i++) b.update(1 / 60);
const expectedFront = smallMove * S;
const noEarlyRebase = b.rebaseQ.length === 0 && Math.abs(b.front - expectedFront) < 0.2;
const frontShown = b.front;

// big move: rebase fires as the gliding front crosses rebaseAt
b.setPrice(60000 + bigMove);
let frames = 0;
while (b.rebaseQ.length === 0 && frames++ < 900) b.update(1 / 60);
const dx = b.rebaseQ[0];
const rebased = b.rebaseQ.length === 1
  && dx !== undefined
  && Math.abs(-dx - CFG.rebaseAt) < 2.5 // triggered just past the threshold
  && Math.abs(b.front) < 2.5;

// convergence: after the rebase, front settles to (price - base) * S
for (let i = 0; i < 700; i++) b.update(1 / 60);
const settled = Math.abs(b.front - (60000 + bigMove - b.base) * S) < 0.2;

let nan = 0;
for (const u of b.units) if (u.alive && !Number.isFinite(u.x)) nan++;

const checks = [
  ['tween converges, no early rebase', noEarlyRebase, frontShown.toFixed(1)],
  ['rebase fires at threshold crossing', rebased, `dx=${dx?.toFixed(1)}`],
  ['glide preserved, settles exactly', settled, b.front.toFixed(1)],
  ['no NaN positions', nan === 0, nan],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nREBASE TEST PASSED');
process.exit(failed ? 1 : 0);
