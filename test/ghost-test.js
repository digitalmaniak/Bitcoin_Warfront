// Spoof-ghost test: a big wall pulled while price is far away must emit a
// ghost; a wall consumed near the price must NOT (that's combat, not spoof).
import { createBattle } from '../src/sim/battle.js';

const P = 60000;

function mkDepth(withWall, wallPrice) {
  const bids = [], asks = [];
  for (let i = 1; i <= 20; i++) {
    bids.push([P - i * 8, 2]);
    asks.push([P + i * 8, 2]);
  }
  if (withWall) bids[Math.round((P - wallPrice) / 8) - 1] = [wallPrice, 400];
  return { bids, asks };
}

// case 1: wall $80 below price (far) appears, then vanishes → ghost
const b = createBattle();
b.setPrice(P);
b.onDepth(mkDepth(true, P - 80));
b.onDepth(mkDepth(true, P - 80)); // established in prev snapshot map
const before = b.ghostQ.length;
b.onDepth(mkDepth(false));
const ghosted = b.ghostQ.length > before;
const ghost = b.ghostQ[b.ghostQ.length - 1];
const ghostAtLvl = ghost && Math.abs(ghost.lvl - (P - 80)) <= 10 && ghost.side === 'bid';

// case 2: wall near price vanishes → assumed eaten, NO ghost
const b2 = createBattle();
b2.setPrice(P);
b2.onDepth(mkDepth(true, P - 16));
b2.onDepth(mkDepth(true, P - 16));
const before2 = b2.ghostQ.length;
b2.onDepth(mkDepth(false));
const noGhostNearPrice = b2.ghostQ.length === before2;

const checks = [
  ['pulled far wall emits ghost', ghosted, ghosted],
  ['ghost at the wall level, right side', !!ghostAtLvl, ghost && `${ghost.lvl}/${ghost.side}`],
  ['ghost has height + width', ghost && ghost.h >= 8 && ghost.w > 0, ghost && ghost.h.toFixed(1)],
  ['wall eaten near price → no ghost', noGhostNearPrice, noGhostNearPrice],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} FAILED` : '\nGHOST TEST PASSED');
process.exit(failed ? 1 : 0);
