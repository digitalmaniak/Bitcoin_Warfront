// Adaptive volume normalization: quiet Sundays and CPI-print chaos should
// both look like a proper war. Soldiers-per-trade scales against a rolling
// average trade size, on a log curve, hard-capped.
export function createNormalizer() {
  let ema = 0.08; // rolling avg trade size (BTC)
  return {
    add(q) {
      ema += (q - ema) * 0.03;
      if (ema < 1e-4) ema = 1e-4;
    },
    soldiers(q) {
      const r = q / ema;
      return Math.max(1, Math.min(45, Math.round(9 * Math.log10(1 + 3 * r))));
    },
    isWhale(q) { return q >= Math.max(6, ema * 60); },
    skulls(q) {
      const r = q / ema;
      return r > 8 ? Math.min(4, 1 + Math.floor(Math.log10(r))) : 0;
    },
    get ref() { return ema; },
  };
}
