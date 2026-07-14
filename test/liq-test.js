// Liquidation execution test: execute() kills only the wrecked side, behind
// their own lines, with the dissolve flag, WITHOUT touching combat kill
// counters, and reports exact spots for the beams.
import { createBattle } from '../src/sim/battle.js';

const b = createBattle();
b.setPrice(60000);
for (let i = 0; i < 300; i++) b.update(1 / 60); // settle armies

const killsBefore = [...b.kills];
const spots = b.execute(0, 10); // longs liquidated → bulls executed

const execUnits = b.units.filter((u) => u.alive && u.state === 2 && u.exec);
const sideOk = execUnits.every((u) => u.side === 0);
const behindLines = execUnits.every((u) => {
  const off = Math.abs(u.x - b.front);
  return off >= 4 && off <= 44 && u.x < b.front; // bulls own x < front
});
const countersUntouched = b.kills[0] === killsBefore[0] && b.kills[1] === killsBefore[1];
const spotsMatch = spots.length === execUnits.length &&
  spots.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z));

// dissolve completes: they fade out and free within ~1.6s
for (let i = 0; i < 120; i++) b.update(1 / 60);
const dissolved = !b.units.some((u) => u.alive && u.exec);

const checks = [
  ['executes requested count', spots.length === 10, spots.length],
  ['only the wrecked side dies', sideOk, sideOk],
  ['executed behind their own lines', behindLines, behindLines],
  ['combat kill counters untouched', countersUntouched, `${b.kills[0]}/${b.kills[1]}`],
  ['beam spots reported for each', spotsMatch, spotsMatch],
  ['dissolve completes and frees', dissolved, dissolved],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nLIQ TEST PASSED');
process.exit(failed ? 1 : 0);
