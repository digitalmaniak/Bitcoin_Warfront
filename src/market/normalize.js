// Adaptive volume normalization: quiet Sundays and CPI-print chaos should
// both look like a proper war. Soldiers-per-trade scales against a rolling
// average trade size, on a log curve, hard-capped.
export function createNormalizer() {
  let ema = 0.08; // rolling avg trade size (BTC)
  const whaleQty = () => Math.max(4, ema * 45);
  return {
    add(q) {
      ema += (q - ema) * 0.03;
      if (ema < 1e-4) ema = 1e-4;
    },
    soldiers(q) {
      const r = q / ema;
      return Math.max(1, Math.min(45, Math.round(9 * Math.log10(1 + 3 * r))));
    },
    isWhale(q) { return q >= whaleQty(); },
    skulls(q) {
      const r = q / ema;
      return r > 8 ? Math.min(4, 1 + Math.floor(Math.log10(r))) : 0;
    },
    get whaleQty() { return whaleQty(); },
    get ref() { return ema; },
  };
}
