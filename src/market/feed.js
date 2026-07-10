// Feed manager: normalizes every source to the same events, auto-falls-back,
// and supports runtime switching (feed.use('coinbase') from the HUD picker).
//   trade  {side:'buy'|'sell', price, qty, ts}
//   depth  {bids:[[price,qty],...], asks:[[price,qty],...], ts}
//   status {name, live, sim?}
import { createBinanceFeed } from './adapters/binance.js';
import { createBitstampFeed } from './adapters/bitstamp.js';
import { createCoinbaseFeed } from './adapters/coinbase.js';
import { createFakeFeed } from './adapters/fake.js';

const FACTORIES = {
  binance: createBinanceFeed,
  bitstamp: createBitstampFeed,
  coinbase: createCoinbaseFeed,
  fake: createFakeFeed,
};
const AUTO_CHAIN = ['binance', 'bitstamp', 'coinbase', 'fake'];

export function startFeed(onEvent) {
  let current = null, done = false;
  let chain = [], idx = 0;

  const next = () => {
    if (done) return;
    if (idx >= chain.length) {
      onEvent('status', { name: 'NO FEED AVAILABLE', live: false });
      return;
    }
    const name = chain[idx++];
    const factory = FACTORIES[name] || createFakeFeed;
    onEvent('status', { name: `CONNECTING ${name.toUpperCase()}…`, live: false });
    current = factory(onEvent, () => next());
  };

  const use = (want) => {
    if (done) return;
    if (current) { current.stop(); current = null; }
    idx = 0;
    chain = want === 'auto' ? [...AUTO_CHAIN]
      : want === 'fake' ? ['fake']
      : [want, 'fake']; // manual pick still falls back so the war never dies
    next();
  };

  use(new URLSearchParams(location.search).get('feed') || 'auto');

  return {
    use,
    stop() { done = true; current && current.stop && current.stop(); },
  };
}
