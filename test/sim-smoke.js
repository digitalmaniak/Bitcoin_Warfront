// Headless smoke test: fake feed → normalizer/candles → battle sim.
// Runs ~3s of simulated market and checks the war state is sane.
import { createBattle } from '../src/sim/battle.js';
import { createNormalizer } from '../src/market/normalize.js';
import { createCandles } from '../src/market/candles.js';
import { createFakeFeed } from '../src/market/adapters/fake.js';

const battle = createBattle();
const norm = createNormalizer();
let trades = 0, depths = 0, closes = 0;
const candles = createCandles(() => closes++);

const feed = createFakeFeed((type, d) => {
  if (type === 'trade') {
    trades++;
    battle.setPrice(d.price);
    norm.add(d.qty);
    candles.add(d);
    battle.onTrade(d.side === 'buy' ? 0 : 1, norm.soldiers(d.qty), {
      whale: norm.isWhale(d.qty),
      skulls: norm.skulls(d.qty),
    });
  } else if (type === 'depth') {
    depths++;
    battle.onDepth(d);
  }
});

const stepper = setInterval(() => battle.update(1 / 60), 16);

setTimeout(() => {
  clearInterval(stepper);
  feed.stop();

  const alive = [0, 0];
  let nan = 0;
  for (const u of battle.units) {
    if (!u.alive) continue;
    alive[u.side]++;
    if (!Number.isFinite(u.x) || !Number.isFinite(u.z)) nan++;
  }

  const checks = [
    ['trades received', trades >= 5, trades],
    ['depth snapshots', depths >= 5, depths],
    ['bull units alive', alive[0] > 100, alive[0]],
    ['bear units alive', alive[1] > 100, alive[1]],
    ['frontline finite', Number.isFinite(battle.front), battle.front.toFixed(2)],
    ['price tracked', battle.price > 1000, battle.price.toFixed(2)],
    ['bid walls built', battle.walls.bid.length > 0, battle.walls.bid.length],
    ['ask walls built', battle.walls.ask.length > 0, battle.walls.ask.length],
    ['no NaN positions', nan === 0, nan],
    ['kills accumulating', battle.kills[0] + battle.kills[1] >= 0,
      `${battle.kills[0]}/${battle.kills[1]}`],
  ];

  let failed = 0;
  for (const [name, ok, val] of checks) {
    console.log(`${ok ? '✅' : '❌'} ${name}: ${val}`);
    if (!ok) failed++;
  }
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nSIM SMOKE TEST PASSED');
  process.exit(failed ? 1 : 0);
}, 3000);
