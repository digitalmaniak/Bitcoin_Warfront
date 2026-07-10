// Builds 1-minute candles locally from the trade tape (works for every feed).
export function createCandles(onClose) {
  let cur = null;
  let round = 1;

  const fresh = (m, t) => ({
    m, round,
    o: t.price, h: t.price, l: t.price, c: t.price,
    v: t.qty,
    bv: t.side === 'buy' ? t.qty : 0,
    sv: t.side === 'sell' ? t.qty : 0,
  });

  return {
    add(t) {
      const m = Math.floor(t.ts / 60000);
      if (!cur) { cur = fresh(m, t); return; }
      if (m !== cur.m) {
        onClose(cur);
        round++;
        cur = fresh(m, t);
        return;
      }
      cur.h = Math.max(cur.h, t.price);
      cur.l = Math.min(cur.l, t.price);
      cur.c = t.price;
      cur.v += t.qty;
      if (t.side === 'buy') cur.bv += t.qty; else cur.sv += t.qty;
    },
    get round() { return round; },
    get cur() { return cur; },
  };
}
