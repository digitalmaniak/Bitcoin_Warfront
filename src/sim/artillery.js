// Artillery budget: each side's cumulative traded volume fills an ordnance
// pot. When the pot tips (~30× rolling average trade size), it's spent on
// rotating hardware — mortar barrage → tank sortie → strafing run.
// Still exactly proportional to real flow: small trades pool into big booms.
export const POT_MULT = 30;
export const KINDS = ['mortar', 'tankSortie', 'strafe'];

export function createArtillery(norm, bus) {
  const pot = [0, 0];
  const seq = [0, 0];
  const cap = () => Math.max(3, norm.ref * POT_MULT);

  return {
    add(side, qty) {
      pot[side] += qty;
      const c = cap();
      while (pot[side] >= c) {
        pot[side] -= c;
        bus.emit('ordnance', { side, kind: KINDS[seq[side]++ % KINDS.length] });
      }
    },
    // 0..1 charge level for the HUD meters
    level(side) { return Math.min(1, pot[side] / cap()); },
  };
}
