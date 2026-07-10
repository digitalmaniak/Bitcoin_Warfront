// Binance combined stream: aggTrade (taker-side flag) + top-20 depth @100ms.
const URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade/btcusdt@depth20@100ms';

export function createBinanceFeed(emit, onFail) {
  let ws = null, opened = false, stopped = false, to = 0;
  const fail = (reason) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(to);
    try { ws && ws.close(); } catch { /* noop */ }
    onFail(reason);
  };

  try { ws = new WebSocket(URL); }
  catch { setTimeout(() => fail('ctor'), 0); return { name: 'binance', stop() { stopped = true; } }; }

  to = setTimeout(() => fail('timeout'), 6000);

  ws.onmessage = (ev) => {
    if (stopped) return;
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    const d = m.data || m;
    if (!opened) { opened = true; clearTimeout(to); emit('status', { name: 'BINANCE · LIVE', live: true }); }
    if (d.e === 'aggTrade') {
      emit('trade', { side: d.m ? 'sell' : 'buy', price: +d.p, qty: +d.q, ts: d.T });
    } else if (d.bids || d.b) {
      const B = d.bids || d.b, A = d.asks || d.a;
      emit('depth', {
        bids: B.map(x => [+x[0], +x[1]]),
        asks: A.map(x => [+x[0], +x[1]]),
        ts: Date.now(),
      });
    }
  };
  ws.onerror = () => { if (!opened) fail('error'); };
  ws.onclose = () => fail(opened ? 'dropped' : 'closed');

  return {
    name: 'binance',
    stop() { stopped = true; clearTimeout(to); try { ws.close(); } catch { /* noop */ } },
  };
}
