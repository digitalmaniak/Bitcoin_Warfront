// Feed manager: normalizes every source to the same events and auto-falls-back.
//   trade  {side:'buy'|'sell', price, qty, ts}
//   depth  {bids:[[price,qty],...], asks:[[price,qty],...], ts}
//   status {name, live}
import { createBinanceFeed } from './adapters/binance.js';
import { createBitstampFeed } from './adapters/bitstamp.js';
import { createFakeFeed } from './adapters/fake.js';

const FACTORIES = { binance: createBinanceFeed, bitstamp: createBitstampFeed, fake: createFakeFeed };

export function startFeed(onEvent) {
  const want = new URLSearchParams(location.search).get('feed') || 'auto';
  const chain = want === 'auto' ? ['binance', 'bitstamp', 'fake'] : [want];
  let idx = 0, current = null, done = false;

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

  next();
  return { stop() { done = true; current && current.stop && current.stop(); } };
}
