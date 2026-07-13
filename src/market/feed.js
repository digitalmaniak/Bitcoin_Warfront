// Feed manager: normalizes every source to the same events, auto-falls-back,
// supports runtime switching (feed.use('coinbase')), and — critically —
// RECOVERS: a live feed that drops is retried from the top of the chain, and
// if we're ever stuck on the simulator in auto mode, the live chain is
// re-attempted every 60s. The war should never quietly stay fake.
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
const RECONNECT_DELAY = 1500;   // after a live feed drops
const LIVE_RETRY_EVERY = 60000; // while stuck on the simulator in auto mode

export function startFeed(onEvent) {
  let current = null, done = false, wantMode = 'auto';
  let chain = [], idx = 0, retryTimer = 0;

  const clearRetry = () => { if (retryTimer) { clearTimeout(retryTimer); retryTimer = 0; } };

  const start = (name) => {
    const factory = FACTORIES[name] || createFakeFeed;
    onEvent('status', { name: `CONNECTING ${name.toUpperCase()}…`, live: false });
    current = factory(onEvent, (reason) => {
      current = null;
      if (done) return;
      if (reason === 'dropped') {
        // it worked, then died (idle timeout, sleep, network blip):
        // retry the whole chain from the top after a short pause
        idx = 0;
        clearRetry();
        retryTimer = setTimeout(next, RECONNECT_DELAY);
      } else {
        next(); // never opened → try the next source
      }
    });
  };

  const next = () => {
    if (done) return;
    if (idx >= chain.length) {
      onEvent('status', { name: 'NO FEED AVAILABLE', live: false });
      return;
    }
    const name = chain[idx++];
    if (name === 'fake' && wantMode === 'auto') {
      // simulator is a last resort, not a destination: keep probing live
      clearRetry();
      retryTimer = setTimeout(() => {
        if (done) return;
        if (current) { current.stop(); current = null; }
        idx = 0;
        next();
      }, LIVE_RETRY_EVERY);
    }
    start(name);
  };

  const use = (want) => {
    if (done) return;
    wantMode = want;
    clearRetry();
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
    stop() {
      done = true;
      clearRetry();
      if (current && current.stop) current.stop();
    },
  };
}
