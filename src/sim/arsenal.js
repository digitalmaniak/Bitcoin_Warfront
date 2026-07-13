// Escalation ladder: normalized trade size → weapon class, with escalation
// dice — trades near a tier boundary get a proportional chance of rolling
// one rung up. Long-run hardware frequency still tracks real flow.
// rng is injectable so tests can be deterministic.
export const TIERS = { GRENADE: 5, TANK: 12, CARPET_X: 2.5, MOAB_X: 6 };
export const DICE = 0.35; // max escalation probability at the boundary

export function createArsenal(norm, battle, bus, rng = Math.random) {
  return {
    process(trade) {
      const side = trade.side === 'buy' ? 0 : 1;
      const n = norm.soldiers(trade.qty);
      const r = trade.qty / norm.ref;
      const whaleR = norm.whaleQty / norm.ref;
      const skulls = norm.skulls(trade.qty);

      // tiers: 0 infantry · 1 grenade · 2 tank · 3 airstrike · 4 carpet · 5 moab
      const at = [
        0, TIERS.GRENADE, TIERS.TANK,
        whaleR, TIERS.CARPET_X * whaleR, TIERS.MOAB_X * whaleR,
      ];
      let tier = 0;
      for (let i = 1; i < at.length; i++) if (r >= at[i]) tier = i;

      // escalation dice: progress toward the next boundary → chance to jump
      if (tier < at.length - 1) {
        const lo = at[tier], hi = at[tier + 1];
        const prog = Math.max(0, Math.min(1, (r - lo) / Math.max(1e-9, hi - lo)));
        if (rng() < DICE * prog) tier++;
      }

      const infantry = tier >= 3 ? Math.ceil(n / 3) : n;
      battle.onTrade(side, infantry, { skulls: tier >= 3 ? 0 : skulls });

      if (tier === 1) bus.emit('grenade', { side, count: r > TIERS.GRENADE * 1.8 ? 2 : 1 });
      else if (tier === 2) bus.emit('tank', { side });
      else if (tier === 3) bus.emit('airstrike', { side, kills: Math.ceil(n * 1.2), qty: trade.qty });
      else if (tier === 4) bus.emit('carpet', { side, kills: n * 2, qty: trade.qty });
      else if (tier === 5) bus.emit('moab', { side, kills: n * 3, qty: trade.qty });

      return { n, r, tier, whale: tier >= 3, carpet: tier === 4, moab: tier === 5 };
    },
  };
}
