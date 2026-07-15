// Historical candles from public REST endpoints, no keys.
// Chain: Binance → Coinbase Exchange → Bitstamp (first that answers wins).
// Returns ascending [{t, o, h, l, c}] or null.

const TF = {
  '1D': { binance: ['15m', 96], coinbase: 900, bitstamp: [900, 96] },
  '1W': { binance: ['2h', 84], coinbase: 3600, bitstamp: [7200, 84] },
  '1M': { binance: ['12h', 60], coinbase: 21600, bitstamp: [43200, 60] },
  '1Y': { binance: ['1d', 365], coinbase: 86400, bitstamp: [86400, 365] },
};
const COINBASE_LIMIT = { '1D': 96, '1W': 168, '1M': 120, '1Y': 300 };

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json();
}

const SOURCES = {
  async binance(tf) {
    const [interval, limit] = TF[tf].binance;
    const rows = await getJson(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`,
    );
    return rows.map((r) => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4] }));
  },
  async coinbase(tf) {
    const rows = await getJson(
      `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${TF[tf].coinbase}`,
    );
    // descending [time, low, high, open, close, vol]
    return rows.slice(0, COINBASE_LIMIT[tf]).reverse()
      .map((r) => ({ t: r[0] * 1000, o: +r[3], h: +r[2], l: +r[1], c: +r[4] }));
  },
  async bitstamp(tf) {
    const [step, limit] = TF[tf].bitstamp;
    const json = await getJson(
      `https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=${step}&limit=${limit}`,
    );
    return json.data.ohlc.map((r) => ({
      t: +r.timestamp * 1000, o: +r.open, h: +r.high, l: +r.low, c: +r.close,
    }));
  },
};

// 24h day stats (rolling trading day) — same fallback philosophy
const DAY_SOURCES = {
  async binance() {
    const r = await getJson('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    return { hi: +r.highPrice, lo: +r.lowPrice };
  },
  async coinbase() {
    const r = await getJson('https://api.exchange.coinbase.com/products/BTC-USD/stats');
    return { hi: +r.high, lo: +r.low };
  },
  async bitstamp() {
    const r = await getJson('https://www.bitstamp.net/api/v2/ticker/btcusd/');
    return { hi: +r.high, lo: +r.low };
  },
};

export async function fetchDayStats() {
  for (const name of ['binance', 'coinbase', 'bitstamp']) {
    try {
      const s = await DAY_SOURCES[name]();
      if (s.hi > 0 && s.lo > 0) return s;
    } catch { /* try the next source */ }
  }
  return null;
}

export async function fetchKlines(tf) {
  for (const name of ['binance', 'coinbase', 'bitstamp']) {
    try {
      const rows = await SOURCES[name](tf);
      if (rows && rows.length > 5) return rows;
    } catch { /* try the next source */ }
  }
  return null;
}
