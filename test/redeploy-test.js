// Redeploy-drop test: after a big away-move, snapFront re-centers exactly,
// redeploy puts every living unit in the sky above its correct post, and
// gravity lands everyone (with bounce) without NaN or stragglers.
import { createBattle, CFG } from '../src/sim/battle.js';

const b = createBattle();
b.setPrice(60000);
for (let i = 0; i < 300; i++) b.update(1 / 60); // settle armies

// price moved $300 while "away" (tab hidden: no updates ran)
b.setPrice(60300);
const dx = b.snapFront();
b.redeploy();

const snapExact = Math.abs(dx + 300 * CFG.priceScale) < 0.01 && Math.abs(b.front) < 0.01;

let airborne = 0, misplaced = 0, living = 0;
for (const u of b.units) {
  if (!u.alive || u.state >= 2) continue;
  living++;
  if (u.y >= 20 && u.y <= 44) airborne++;
  const expected = b.front + (u.side === 0 ? -1 : 1) * u.ox;
  if (Math.abs(u.x - expected) > 0.01) misplaced++;
}

// let them fall, bounce, and settle (~3.5s)
let bounced = false;
for (let i = 0; i < 260; i++) {
  b.update(1 / 60);
  for (const u of b.units) if (u.alive && u.state < 2 && u.y === 0 && u.vy > 0.5) bounced = true;
}
for (let i = 0; i < 400; i++) b.update(1 / 60);

let stillAirborne = 0, nan = 0;
for (const u of b.units) {
  if (!u.alive || u.state >= 2) continue;
  if (u.y > 0.5) stillAirborne++;
  if (!Number.isFinite(u.x) || !Number.isFinite(u.y)) nan++;
}

const checks = [
  ['snapFront exact, front = 0', snapExact, `dx=${dx.toFixed(1)}`],
  ['everyone dropped from the sky', living > 500 && airborne === living, `${airborne}/${living}`],
  ['everyone above their correct post', misplaced === 0, misplaced],
  ['bounces observed on landing', bounced, bounced],
  ['everyone settled after the drop', stillAirborne === 0, stillAirborne],
  ['no NaN', nan === 0, nan],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nREDEPLOY TEST PASSED');
process.exit(failed ? 1 : 0);
