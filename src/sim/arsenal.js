// Escalation ladder: normalized trade size → weapon class.
// The market decides everything; weapons only dramatize it.
export const TIERS = { GRENADE: 8, TANK: 20, CARPET_X: 3 };

export function createArsenal(norm, battle, bus) {
  return {
    // returns {n, r, whale, carpet} for HUD alerts
    process(trade) {
      const side = trade.side === 'buy' ? 0 : 1;
      const n = norm.soldiers(trade.qty);
      const r = trade.qty / norm.ref;
      const whale = norm.isWhale(trade.qty);
      const whaleQty = Math.max(6, norm.ref * 60);
      const carpet = whale && trade.qty >= TIERS.CARPET_X * whaleQty;
      const skulls = norm.skulls(trade.qty);

      if (carpet) {
        battle.onTrade(side, Math.ceil(n / 3), { skulls: 0 });
        bus.emit('carpet', { side, kills: n * 2, qty: trade.qty });
      } else if (whale) {
        battle.onTrade(side, Math.ceil(n / 3), { skulls: 0 });
        bus.emit('airstrike', { side, kills: Math.ceil(n * 1.2), qty: trade.qty });
      } else if (r >= TIERS.TANK) {
        battle.onTrade(side, n, { skulls });
        bus.emit('tank', { side });
      } else if (r >= TIERS.GRENADE) {
        battle.onTrade(side, n, { skulls });
        bus.emit('grenade', { side, count: r > 14 ? 2 : 1 });
      } else {
        battle.onTrade(side, n, { skulls });
      }
      return { n, r, whale, carpet };
    },
  };
}
