// Forced-liquidation feed: the one data source that literally IS the
// metaphor — real accounts getting killed by the market.
// Chain: Binance futures → Bybit → OKX. All public, no keys. If nothing
// connects, liquidations stay silent on live data; synthetic events are
// generated ONLY while the main feed is the simulator.
//   onLiq({ side:'long'|'short', qty(BTC), price, notional(USD), ts })

function mkWs(url, onFail, setup) {
  let ws = null, opened = false, stopped = false, to = 0;
  const fail = (r) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(to);
    try { ws && ws.close(); } catch { /* noop */ }
    onFail(r, opened);
  };
  try { ws = new WebSocket(url); }
  catch { setTimeout(() => fail('ctor'), 0); return { stop() { stopped = true; } }; }
  to = setTimeout(() => fail('timeout'), 8000);
  ws.onopen = () => { opened = true; clearTimeout(to); setup(ws); };
  ws.onerror = () => { if (!opened) fail('error'); };
  ws.onclose = () => fail(opened ? 'dropped' : 'closed');
  return {
    ws: () => ws,
    onMessage(fn) { ws.onmessage = (ev) => { if (!stopped) fn(ev); }; },
    stop() { stopped = true; clearTimeout(to); try { ws.close(); } catch { /* noop */ } },
  };
}

const CONNECTORS = {
  binance(onLiq, onFail) {
    const c = mkWs('wss://fstream.binance.com/ws/btcusdt@forceOrder', onFail, () => {});
    c.onMessage((ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      const o = m.o;
      if (!o) return;
      const qty = +o.q, price = +o.ap || +o.p;
      if (!(qty > 0) || !(price > 0)) return;
      onLiq({
        side: o.S === 'SELL' ? 'long' : 'short', // forced sell = long wrecked
        qty, price, notional: qty * price, ts: o.T || Date.now(),
      });
    });
    return c;
  },
  bybit(onLiq, onFail) {
    let ping = 0;
    const c = mkWs('wss://stream.bybit.com/v5/public/linear', (r, opened) => {
      clearInterval(ping);
      onFail(r, opened);
    }, (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['allLiquidation.BTCUSDT'] }));
      ping = setInterval(() => { try { ws.send(JSON.stringify({ op: 'ping' })); } catch { /* noop */ } }, 20000);
    });
    c.onMessage((ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (!m.topic || !m.topic.startsWith('allLiquidation') || !m.data) return;
      for (const d of m.data) {
        const qty = +d.v, price = +d.p;
        if (!(qty > 0) || !(price > 0)) continue;
        onLiq({
          side: d.S === 'Buy' ? 'short' : 'long', // forced buy = short wrecked
          qty, price, notional: qty * price, ts: d.T || Date.now(),
        });
      }
    });
    return c;
  },
  okx(onLiq, onFail) {
    const c = mkWs('wss://ws.okx.com:8443/ws/v5/public', onFail, (ws) => {
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [{ channel: 'liquidation-orders', instType: 'SWAP' }],
      }));
    });
    c.onMessage((ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (!m.data) return;
      for (const row of m.data) {
        if (!row.instId || !row.instId.startsWith('BTC-USDT')) continue;
        for (const d of (row.details || [])) {
          const qty = +d.sz * 0.01; // BTC-USDT-SWAP contract = 0.01 BTC
          const price = +d.bkPx;
          if (!(qty > 0) || !(price > 0)) continue;
          onLiq({
            side: d.side === 'buy' ? 'short' : 'long',
            qty, price, notional: qty * price, ts: +d.ts || Date.now(),
          });
        }
      }
    });
    return c;
  },
};

export function startLiquidations(onLiq, { isSim, getPrice }) {
  const chain = ['binance', 'bybit', 'okx'];
  let idx = 0, current = null, done = false, retryT = 0, fakeT = 0;

  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const startFake = () => {
    clearInterval(fakeT);
    fakeT = setInterval(() => {
      if (done || !isSim() || Math.random() > 0.45) return;
      const price = getPrice() || 60000;
      const notional = Math.min(3e6, Math.max(2000, Math.exp(gauss() * 1.6 + 9.8)));
      onLiq({
        side: Math.random() < 0.5 ? 'long' : 'short',
        qty: notional / price, price, notional, ts: Date.now(),
      });
    }, 9000);
  };

  const next = () => {
    if (done) return;
    if (idx >= chain.length) {
      // nothing reachable: synthetic while simulated; re-probe live in 3 min
      startFake();
      retryT = setTimeout(() => { idx = 0; next(); }, 180000);
      return;
    }
    clearInterval(fakeT);
    current = CONNECTORS[chain[idx++]](onLiq, (reason, opened) => {
      current = null;
      if (done) return;
      if (opened) { // was live, then dropped: retry from the top shortly
        idx = 0;
        retryT = setTimeout(next, 3000);
      } else next();
    });
  };

  next();
  return {
    stop() {
      done = true;
      clearTimeout(retryT);
      clearInterval(fakeT);
      current && current.stop();
    },
  };
}
