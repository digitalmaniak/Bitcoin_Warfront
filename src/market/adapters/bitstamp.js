// Bitstamp public WebSocket: live trades + top-100 order book (US-friendly).
const URL = 'wss://ws.bitstamp.net';

export function createBitstampFeed(emit, onFail) {
  let ws = null, opened = false, stopped = false, to = 0;
  const fail = (reason) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(to);
    try { ws && ws.close(); } catch { /* noop */ }
    onFail(reason);
  };

  try { ws = new WebSocket(URL); }
  catch { setTimeout(() => fail('ctor'), 0); return { name: 'bitstamp', stop() { stopped = true; } }; }

  to = setTimeout(() => fail('timeout'), 7000);

  ws.onopen = () => {
    ws.send(JSON.stringify({ event: 'bts:subscribe', data: { channel: 'live_trades_btcusd' } }));
    ws.send(JSON.stringify({ event: 'bts:subscribe', data: { channel: 'order_book_btcusd' } }));
  };

  ws.onmessage = (ev) => {
    if (stopped) return;
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.event === 'trade' && m.data) {
      if (!opened) { opened = true; clearTimeout(to); emit('status', { name: 'BITSTAMP · LIVE', live: true }); }
      const d = m.data;
      emit('trade', {
        side: d.type === 0 ? 'buy' : 'sell',
        price: +d.price,
        qty: +d.amount,
        ts: d.microtimestamp ? +d.microtimestamp / 1000 : Date.now(),
      });
    } else if (m.event === 'data' && m.channel === 'order_book_btcusd' && m.data) {
      if (!opened) { opened = true; clearTimeout(to); emit('status', { name: 'BITSTAMP · LIVE', live: true }); }
      emit('depth', {
        bids: m.data.bids.slice(0, 60).map(x => [+x[0], +x[1]]),
        asks: m.data.asks.slice(0, 60).map(x => [+x[0], +x[1]]),
        ts: Date.now(),
      });
    }
  };
  ws.onerror = () => { if (!opened) fail('error'); };
  ws.onclose = () => fail(opened ? 'dropped' : 'closed');

  return {
    name: 'bitstamp',
    stop() { stopped = true; clearTimeout(to); try { ws.close(); } catch { /* noop */ } },
  };
}
