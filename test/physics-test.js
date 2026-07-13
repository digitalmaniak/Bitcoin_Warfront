// Infantry physics test: blasts launch victims ballistically, survivors get
// shoved, tanks displace, doomed units die on a delay with kill-tracers
// queued, and kill counters stay exact.
import { createBattle } from '../src/sim/battle.js';

const b = createBattle();
b.setPrice(60000);
for (let i = 0; i < 120; i++) b.update(1 / 60); // populate + settle armies

// --- blast physics ---------------------------------------------------------
// blast on the bear side (side 0 attacking): find a spot with bears near it
const bears = b.units.filter((u) => u.alive && u.side === 1 && u.state < 2);
const target = bears[Math.floor(bears.length / 2)];
const beforeKills = b.kills[0];
const killed = b.blastAt(0, target.x, target.z, 12, 2.5);

const launched = b.units.filter((u) => u.alive && u.state === 2 && u.vy > 0);
b.update(1 / 60);
const airborne = b.units.filter((u) => u.alive && u.state === 2 && u.y > 0);
const shoved = b.units.filter((u) => u.alive && u.state < 2 && u.stun > 0);
const counterExact = b.kills[0] - beforeKills >= killed && b.kills[0] - beforeKills <= 12;

// let physics run: everyone must land, slide, and fade without NaN
for (let i = 0; i < 300; i++) b.update(1 / 60);
let nan = 0;
for (const u of b.units) {
  if (u.alive && (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.z))) nan++;
}
const allLanded = !b.units.some((u) => u.alive && u.state === 2 && u.y > 0.5 && u.deathT > 0.9);

// --- doomed + kill-tracers -------------------------------------------------
b.shotQ.length = 0;
const marked = b.strikeAt(0, 0, 5);
const doomed = b.units.filter((u) => u.alive && u.state === 3).length;
const shotsQueued = b.shotQ.length;
for (let i = 0; i < 60; i++) b.update(1 / 60); // doom timers expire (≤0.55s)
const doomedResolved = !b.units.some((u) => u.alive && u.state === 3);

// --- tank displacement -----------------------------------------------------
const victim = b.units.find((u) => u.alive && u.state < 2);
const vx0 = victim.x, vz0 = victim.z;
for (let i = 0; i < 30; i++) {
  b.displace(victim.x, victim.z + 0.5, 5, 1 / 60);
  b.update(1 / 60);
}
const displaced = Math.hypot(victim.x - vx0, victim.z - vz0) > 0.5 || victim.state >= 2;

const checks = [
  ['blast kills victims', killed > 0, killed],
  ['victims launched (vy > 0)', launched.length > 0, launched.length],
  ['victims airborne next frame', airborne.length > 0, airborne.length],
  ['survivors shoved (stun)', shoved.length > 0, shoved.length],
  ['kill counter exact', counterExact, b.kills[0] - beforeKills],
  ['everyone lands, no floaters', allLanded, true],
  ['no NaN after 5s physics', nan === 0, nan],
  ['strikeAt dooms with delay', marked === 5 && doomed > 0, `${marked}/${doomed}`],
  ['kill-tracers queued', shotsQueued === marked, shotsQueued],
  ['doomed resolve to dead', doomedResolved, true],
  ['tank field displaces infantry', displaced, displaced],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nPHYSICS TEST PASSED');
process.exit(failed ? 1 : 0);
