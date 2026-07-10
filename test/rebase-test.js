// Price-axis mapping test: front tracks price truly, rebase fires past the
// threshold, shifts the world by the exact offset, and resumes cleanly.
import { createBattle, CFG } from '../src/sim/battle.js';

const b = createBattle();
b.setPrice(60000);
b.update(1 / 60); // seeds armies at base

// modest move: front = (60100-60000)*0.4 = 40 < rebaseAt 60 → no rebase
b.setPrice(60100);
b.update(1 / 60);
const frontAt100 = b.front;
const noEarlyRebase = b.rebaseQ.length === 0 && Math.abs(frontAt100 - 40) < 0.01;

// pick a marker unit to verify the shift is applied exactly
const marker = b.units.find((u) => u.alive);
const markerXBefore = marker.x;

// big move: front = 80 > 60 → rebase to 0, world shifts by -80
b.setPrice(60200);
b.update(1 / 60);
const dx = b.rebaseQ[0];
const rebased =
  b.rebaseQ.length === 1 &&
  Math.abs(dx + 80) < 0.01 &&
  Math.abs(b.front) < 0.01 &&
  b.base === 60200;
// marker moved during its update step too — allow its walk speed (< 0.3/frame)
const markerShifted = Math.abs(marker.x - (markerXBefore + dx)) < 0.5;

// resume: small move after rebase maps from the new base
b.setPrice(60225);
b.update(1 / 60);
const resumed = Math.abs(b.front - 10) < 0.01;

let nan = 0;
for (const u of b.units) if (u.alive && !Number.isFinite(u.x)) nan++;

const checks = [
  ['front tracks price truly (no clamp)', noEarlyRebase, frontAt100.toFixed(1)],
  ['rebase fires past threshold, exact offset', rebased, `dx=${dx?.toFixed(1)}`],
  ['units shifted by exact offset', markerShifted, marker.x.toFixed(1)],
  ['clean resume from new base', resumed, b.front.toFixed(1)],
  ['no NaN positions', nan === 0, nan],
  ['rebaseAt configured', CFG.rebaseAt === 60, CFG.rebaseAt],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nREBASE TEST PASSED');
process.exit(failed ? 1 : 0);
