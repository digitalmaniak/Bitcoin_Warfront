// Coinbase Advanced Trade public market data WS: trades + level2 book.
// Maintains a local order book from snapshot+updates, emits top 40 levels
// every 200ms. If the endpoint rejects/blocks, the feed manager falls back.
const URL = 'wss://advanced-trade-ws.coinbase.com';

export function createCoinbaseFeed(emit, onFail) {
  let ws = null, opened = false, stopped = false, to = 0, depthTimer = 0;
  const bids = new Map(), asks = new Map();
  let bookDirty = false;

  const fail = (reason) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(to);
    clearInterval(depthTimer);
    try { ws && ws.close(); } catch { /* noop */ }
    onFail(reason);
  };

  try { ws = new WebSocket(URL); }
  catch { setTimeout(() => fail('ctor'), 0); return { name: 'coinbase', stop() { stopped = true; } }; }

  to = setTimeout(() => fail('timeout'), 7000);

  const markOpen = () => {
    if (opened) return;
    opened = true;
    clearTimeout(to);
    emit('status', { name: 'COINBASE · LIVE', live: true });
  };

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'market_trades', product_ids: ['BTC-USD'] }));
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'level2', product_ids: ['BTC-USD'] }));
  };

  depthTimer = setInterval(() => {
    if (stopped || !bookDirty) return;
    bookDirty = false;
    const top = (m, desc) =>
      [...m.entries()].sort((a, b) => (desc ? b[0] - a[0] : a[0] - b[0])).slice(0, 40);
    const B = top(bids, true), A = top(asks, false);
    if (B.length && A.length) emit('depth', { bids: B, asks: A, ts: Date.now() });
  }, 200);

  ws.onmessage = (ev) => {
    if (stopped) return;
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.channel === 'market_trades' && m.events) {
      for (const e of m.events) {
        for (const t of (e.trades || [])) {
          markOpen();
          // NOTE: Coinbase reports the MAKER side (legacy semantics), so the
          // aggressor (taker) is the opposite. If buys/sells ever look
          // inverted vs price movement on this feed, flip this ternary.
          emit('trade', {
            side: t.side === 'BUY' ? 'sell' : 'buy',
            price: +t.price,
            qty: +t.size,
            ts: t.time ? Date.parse(t.time) : Date.now(),
          });
        }
      }
    } else if ((m.channel === 'l2_data' || m.channel === 'level2') && m.events) {
      for (const e of m.events) {
        if (e.type === 'snapshot') { bids.clear(); asks.clear(); }
        for (const u of (e.updates || [])) {
          const map = u.side === 'bid' ? bids : asks;
          const p = +u.price_level, q = +u.new_quantity;
          if (!(p > 0)) continue;
          if (q <= 0) map.delete(p); else map.set(p, q);
        }
        bookDirty = true;
        markOpen();
      }
    } else if (m.type === 'error' && !opened) {
      fail('rejected');
    }
  };
  ws.onerror = () => { if (!opened) fail('error'); };
  ws.onclose = () => fail(opened ? 'dropped' : 'closed');

  return {
    name: 'coinbase',
    stop() { stopped = true; clearTimeout(to); clearInterval(depthTimer); try { ws.close(); } catch { /* noop */ } },
  };
}
