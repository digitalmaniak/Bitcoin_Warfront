// Battle simulation — pure JS, no rendering dependencies (unit-testable).
//
// Side 0 = bulls (own x < front), side 1 = bears (own x > front).
// TRUE PRICE MAPPING: world x IS price. front = (price - base) * priceScale,
// so the war physically advances/retreats as price moves (camera follows).
// When the front drifts past rebaseAt, the whole world + camera shift by the
// same offset in one frame (seamless) and the ground ruler renumbers.

export const CFG = {
  fieldX: 70,        // half-width of the battlefield (world units)
  fieldZ: 28,        // half-depth
  poolSize: 4400,    // total unit pool (both sides)
  meshCap: 3000,     // per-side render capacity
  rebaseAt: 60,      // world units (= $150) of front travel before rebase
  priceScale: 0.4,   // world units per $
  bucket: 10,        // $ per depth-wall bucket
  wallCap: 24,       // max walls rendered per side
};

const rnd = (a, b) => a + Math.random() * (b - a);
const STATE = { MARCH: 0, FIGHT: 1, DEAD: 2, DOOMED: 3 };
const GRAV = 26;

export function createBattle() {
  const units = [];
  const freeStack = [];
  for (let i = 0; i < CFG.poolSize; i++) {
    units.push({
      i, alive: false, side: 0, state: STATE.MARCH,
      x: 0, z: 0, ox: 6, tz: 0, speed: 5, s: 1,
      charge: false, deathT: 0, dur: 1.1,
      // physics: height, vertical velocity, knockback, tumble, stagger, doom
      y: 0, vy: 0, kx: 0, kz: 0, spin: 0, stun: 0, doomT: 0,
    });
    freeStack.push(i);
  }

  let price = 0, base = 0, front = 0;
  const rebaseQ = []; // world-shift offsets, drained by the renderer
  const kills = [0, 0];          // kills[0] = bears slain by bulls
  const volEma = [1, 1];         // rolling aggression per side
  const skullQ = [];             // {x, z, n} drained by effects
  const shotQ = [];              // {side, x, z, t} kill-tracers for the renderer
  const breachQ = [];            // {side:'bid'|'ask'} wall-breach events
  let shake = 0;
  const walls = { bid: [], ask: [] }; // {x, h, q, lvl}
  const prevMax = { bid: null, ask: null };
  let breachCooldown = 0;

  const sideDir = (side) => (side === 0 ? -1 : 1);

  function spawn(side) {
    const i = freeStack.pop();
    if (i === undefined) return null;
    const u = units[i];
    u.alive = true; u.side = side; u.state = STATE.MARCH;
    u.charge = false; u.deathT = 0; u.s = 1; u.dur = 1.1;
    u.y = 0; u.vy = 0; u.kx = 0; u.kz = 0; u.spin = 0; u.stun = 0; u.doomT = 0;
    return u;
  }

  function spawnSoldier(side) {
    const u = spawn(side);
    if (!u) return;
    u.ox = rnd(3, 26);
    u.tz = rnd(-CFG.fieldZ, CFG.fieldZ);
    u.z = rnd(-CFG.fieldZ, CFG.fieldZ);
    u.x = front + sideDir(side) * rnd(30, CFG.fieldX);
    u.speed = rnd(4, 7);
  }

  // Mark victims DOOMED: they die a beat later, and shotQ lets the renderer
  // fire a visible tracer timed to arrive as they drop. Every falling soldier
  // corresponds to a real counted kill.
  function killNear(side, z, count) {
    let k = 0;
    // pass 1: tight radius at the frontline; pass 2: widen
    for (const [dx, dz] of [[9, 12], [20, 26]]) {
      for (let i = 0; i < units.length && k < count; i++) {
        const u = units[i];
        if (!u.alive || u.side !== side || u.s > 2) continue;
        if (u.state !== STATE.MARCH && u.state !== STATE.FIGHT) continue;
        if (Math.abs(u.x - front) < dx && Math.abs(u.z - z) < dz) {
          u.state = STATE.DOOMED;
          u.doomT = 0.1 + Math.random() * 0.45;
          if (shotQ.length < 140) shotQ.push({ side: 1 - side, x: u.x, z: u.z, t: u.doomT });
          k++;
        }
      }
      if (k >= count) break;
    }
    return k;
  }

  function dieShot(u) {
    u.state = STATE.DEAD;
    u.deathT = 0; u.dur = 1.0;
    u.kx = sideDir(u.side) * rnd(1, 3); // knocked back toward own side
    u.kz = rnd(-1, 1);
    u.vy = 0; u.y = 0; u.spin = 0;
  }

  function resolveCharge(u) {
    const enemy = 1 - u.side;
    if (u.s > 2) { // whale unit
      kills[u.side] += killNear(enemy, u.z, 24);
      shake = Math.max(shake, 1.2);
      u.charge = false; u.ox = rnd(2, 5); u.state = STATE.FIGHT;
      return;
    }
    if (Math.random() < 0.85) kills[u.side] += killNear(enemy, u.z, 1);
    if (Math.random() < 0.25) { u.state = STATE.DEAD; u.deathT = 0; }
    else { u.charge = false; u.ox = rnd(1.5, 7); u.state = STATE.FIGHT; }
  }

  return {
    units, walls, skullQ, breachQ, rebaseQ, shotQ, CFG,
    get front() { return front; },
    get base() { return base; },
    get price() { return price; },
    get kills() { return kills; },
    get shake() { return shake; },
    get aggression() { return volEma; },

    // Delayed/area kills at the frontline (no known impact point).
    strikeAt(side, z, count) {
      const k = killNear(1 - side, z, count);
      kills[side] += k;
      if (count >= 8) skullQ.push({ x: front, z, n: Math.min(4, 1 + Math.ceil(count / 12)) });
      shake = Math.max(shake, Math.min(1.6, count / 18));
      return k;
    },

    // Blast with a real impact point: victims inside the radius are LAUNCHED
    // ballistically away (bigger power → higher and farther), survivors
    // nearby stagger from the shockwave. Kill counts stay flow-honest —
    // any deaths the blast couldn't find locally fall at the front instead.
    blastAt(side, bx, bz, count, power) {
      const r = 4 + power * 4.5;
      const r2 = r * r;
      const shoveR = r * 1.7;
      const shoveR2 = shoveR * shoveR;
      let killed = 0;
      for (const u of units) {
        if (!u.alive || u.state === STATE.DEAD) continue;
        const dx = u.x - bx, dz = u.z - bz;
        const d2 = dx * dx + dz * dz;
        if (d2 > shoveR2) continue;
        const d = Math.sqrt(d2) || 0.5;
        if (d2 < r2 && killed < count && u.side !== side && u.s <= 2
            && u.state !== STATE.DOOMED) {
          killed++;
          const fall = 1 - (d / r) * 0.6; // closer to center → thrown harder
          const sp = Math.min(34, (5 + power * 5) * fall * rnd(0.7, 1.3));
          u.state = STATE.DEAD;
          u.deathT = 0;
          u.dur = Math.min(2.2, 1.3 + power * 0.15);
          u.kx = (dx / d) * sp;
          u.kz = (dz / d) * sp;
          u.vy = Math.min(16, (3.5 + power * 2.8) * fall);
          u.y = 0.01;
          u.spin = rnd(-8, 8);
        } else { // shockwave shove (both sides, non-lethal)
          const sp = (3 + power * 2.5) * (1 - d / shoveR);
          u.kx += (dx / d) * sp;
          u.kz += (dz / d) * sp;
          u.stun = Math.max(u.stun, 0.35);
        }
      }
      kills[side] += killed;
      if (killed < count) kills[side] += killNear(1 - side, bz, count - killed);
      if (count >= 8) skullQ.push({ x: bx, z: bz, n: Math.min(4, 1 + Math.ceil(count / 12)) });
      shake = Math.max(shake, Math.min(1.6, count / 18 + power * 0.15));
      return killed;
    },

    // Continuous push field (tanks plowing through the ranks).
    displace(bx, bz, r, dt) {
      const r2 = r * r;
      for (const u of units) {
        if (!u.alive || u.state === STATE.DEAD || u.s > 2) continue;
        const dx = u.x - bx, dz = u.z - bz;
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        const d = Math.sqrt(d2) || 0.4;
        const f = 46 * dt * (1 - d / r);
        u.kx += (dx / d) * f;
        u.kz += (dz / d) * f;
        u.stun = Math.max(u.stun, 0.2);
      }
    },

    setPrice(p) {
      if (!p || !Number.isFinite(p)) return;
      if (!base) base = p;
      price = p;
    },

    // side: 0 buy / 1 sell. n: soldier count. opts: {whale, skulls}
    onTrade(side, n, opts = {}) {
      const zc = rnd(-CFG.fieldZ + 6, CFG.fieldZ - 6);
      volEma[side] += n;
      if (opts.whale) {
        const u = spawn(side);
        if (u) {
          u.charge = true; u.s = 3.2; u.speed = 6;
          u.ox = 1; u.tz = zc;
          u.z = zc; u.x = front + sideDir(side) * rnd(50, 62);
        }
      }
      for (let k = 0; k < n; k++) {
        const u = spawn(side);
        if (!u) break;
        u.charge = true;
        u.ox = rnd(0.5, 2.5);
        u.tz = zc + rnd(-5, 5);
        u.z = zc + rnd(-10, 10);
        u.x = front + sideDir(side) * rnd(18, 42);
        u.speed = rnd(9, 14);
      }
      if (opts.skulls) skullQ.push({ x: front, z: zc, n: opts.skulls });
      shake = Math.max(shake, Math.min(1.5, n / 45 + (opts.whale ? 1 : 0)));
    },

    onDepth({ bids, asks }) {
      const mid = bids?.length && asks?.length ? (bids[0][0] + asks[0][0]) / 2 : 0;
      if (!price && mid) this.setPrice(mid);
      if (!price) return;
      // Adaptive bucketing: live books are tight ($ spans vary wildly by
      // exchange), so size buckets from the actual span and floor the visual
      // spacing so walls stay readable instead of clumping at the frontline.
      const span = Math.max(
        bids?.length ? Math.abs(price - bids[bids.length - 1][0]) : 0,
        asks?.length ? Math.abs(asks[asks.length - 1][0] - price) : 0,
        4,
      );
      const bucket = Math.max(1, Math.min(25, span / 10));
      // HONEST placement: walls stand at their true price on the ground ruler.
      // Width tracks the bucket so tight books get slim adjacent ramparts.
      const wWidth = Math.max(0.9, bucket * CFG.priceScale * 0.9);
      const bucketize = (levels) => {
        const map = new Map();
        for (const [lp, q] of levels) {
          const key = Math.round((lp - price) / bucket);
          map.set(key, (map.get(key) || 0) + q);
        }
        const out = [];
        for (const [key, q] of map) {
          const x = front + key * bucket * CFG.priceScale;
          if (Math.abs(x - front) > 55) continue;
          out.push({
            x, h: Math.min(16, 1.9 * Math.sqrt(q)), q, w: wWidth,
            lvl: price + key * bucket,
          });
        }
        out.sort((a, b) => a.x - b.x);
        return out.slice(0, CFG.wallCap);
      };
      walls.bid = bucketize(bids || []);
      walls.ask = bucketize(asks || []);

      // Wall-breach detection: a big wall got eaten while price crossed it.
      for (const side of ['bid', 'ask']) {
        const arr = walls[side];
        let mx = null;
        for (const w of arr) if (!mx || w.h > mx.h) mx = w;
        const prev = prevMax[side];
        if (prev && prev.h >= 11 && Date.now() > breachCooldown) {
          const match = arr.find((w) => Math.abs(w.lvl - prev.lvl) <= bucket);
          const crushed = !match || match.h < prev.h * 0.35;
          const crossed = side === 'ask' ? price > prev.lvl : price < prev.lvl;
          if (crushed && crossed) {
            breachQ.push({ side });
            breachCooldown = Date.now() + 30000;
          }
        }
        prevMax[side] = mx;
      }
    },

    update(dt) {
      // true price mapping: the front travels as price moves
      front = (price - base) * CFG.priceScale;
      if (Math.abs(front) > CFG.rebaseAt) {
        const dx = -front;
        base = price;
        front = 0;
        for (const u of units) if (u.alive) u.x += dx;
        for (const side of ['bid', 'ask']) for (const w of walls[side]) w.x += dx;
        for (const s of skullQ) s.x += dx;
        rebaseQ.push(dx);
      }

      volEma[0] *= Math.exp(-dt / 30);
      volEma[1] *= Math.exp(-dt / 30);
      const share = volEma[0] / (volEma[0] + volEma[1] + 1e-9);
      const targets = [Math.round(500 + 600 * share), Math.round(500 + 600 * (1 - share))];

      const alive = [0, 0];
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (!u.alive) continue;

        if (u.state === STATE.DEAD) {
          if (u.y > 0 || u.vy > 0) { // airborne: ballistic arc
            u.vy -= GRAV * dt;
            u.y += u.vy * dt;
            u.x += u.kx * dt;
            u.z += u.kz * dt;
            if (u.y <= 0) { u.y = 0; u.vy = 0; u.kx *= 0.25; u.kz *= 0.25; }
          } else if (u.kx || u.kz) { // sliding to rest
            u.x += u.kx * dt;
            u.z += u.kz * dt;
            const dk = Math.exp(-dt * 6);
            u.kx *= dk; u.kz *= dk;
          }
          u.deathT += dt / u.dur;
          if (u.deathT >= 1) { u.alive = false; freeStack.push(i); }
          else alive[u.side]++;
          continue;
        }
        alive[u.side]++;

        if (u.state === STATE.DOOMED) { // hit registered, falls when shot lands
          u.doomT -= dt;
          if (u.doomT <= 0) dieShot(u);
          continue;
        }

        if (u.stun > 0) { // shockwave stagger: shoved, can't act
          u.stun -= dt;
          u.x += u.kx * dt;
          u.z += u.kz * dt;
          const dk = Math.exp(-dt * 5);
          u.kx *= dk; u.kz *= dk;
          continue;
        }

        const dir = sideDir(u.side);
        const tx = u.charge ? front - dir * 1.5 : front + dir * u.ox;
        const dx = tx - u.x, dz = u.tz - u.z;
        const d = Math.hypot(dx, dz);

        if (d < 0.8) {
          if (u.charge) resolveCharge(u);
          else {
            u.state = STATE.FIGHT;
            if (Math.random() < dt * 0.5) {
              u.tz = Math.max(-CFG.fieldZ, Math.min(CFG.fieldZ, u.tz + rnd(-3, 3)));
            }
          }
        } else {
          const v = u.speed * (u.charge ? 1 : 0.6) * dt;
          u.x += (dx / d) * v;
          u.z += (dz / d) * v;
        }
      }

      // reinforcement drip toward target populations
      for (let side = 0; side < 2; side++) {
        let deficit = Math.min(targets[side] - alive[side], Math.ceil(400 * dt));
        while (deficit-- > 0) spawnSoldier(side);
      }

      shake *= Math.exp(-dt * 3);
    },
  };
}
