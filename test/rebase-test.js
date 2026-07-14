// Price-axis mapping test: front tracks price truly, rebase fires past the
// threshold, shifts the world by the exact offset, and resumes cleanly.
// Derives all expectations from CFG so scale tuning doesn't break it.
import { createBattle, CFG } from '../src/sim/battle.js';

const S = CFG.priceScale;
const smallMove = (CFG.rebaseAt / S) * 0.6;  // stays under the threshold
const bigMove = (CFG.rebaseAt / S) * 1.4;    // crosses it

const b = createBattle();
b.setPrice(60000);
b.update(1 / 60); // seeds armies at base

b.setPrice(60000 + smallMove);
b.update(1 / 60);
const expectedFront = smallMove * S;
const noEarlyRebase = b.rebaseQ.length === 0 && Math.abs(b.front - expectedFront) < 0.01;
const frontShown = b.front;

// pick a marker unit to verify the shift is applied exactly
const marker = b.units.find((u) => u.alive);
const markerXBefore = marker.x;

b.setPrice(60000 + bigMove);
b.update(1 / 60);
const dx = b.rebaseQ[0];
const rebased =
  b.rebaseQ.length === 1 &&
  Math.abs(dx + bigMove * S) < 0.01 &&
  Math.abs(b.front) < 0.01 &&
  b.base === 60000 + bigMove;
// marker moved during its update step too — allow its walk speed
const markerShifted = Math.abs(marker.x - (markerXBefore + dx)) < 0.5;

// resume: small move after rebase maps from the new base
b.setPrice(60000 + bigMove + 10);
b.update(1 / 60);
const resumed = Math.abs(b.front - 10 * S) < 0.01;

let nan = 0;
for (const u of b.units) if (u.alive && !Number.isFinite(u.x)) nan++;

const checks = [
  ['front tracks price truly (no clamp)', noEarlyRebase, frontShown.toFixed(1)],
  ['rebase fires past threshold, exact offset', rebased, `dx=${dx?.toFixed(1)}`],
  ['units shifted by exact offset', markerShifted, marker.x.toFixed(1)],
  ['clean resume from new base', resumed, b.front.toFixed(1)],
  ['no NaN positions', nan === 0, nan],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nREBASE TEST PASSED');
process.exit(failed ? 1 : 0);
