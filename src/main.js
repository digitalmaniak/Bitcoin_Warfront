import * as THREE from 'three';
import { startFeed } from './market/feed.js';
import { startLiquidations } from './market/liquidations.js';
import { createCandles } from './market/candles.js';
import { createNormalizer } from './market/normalize.js';
import { createBattle } from './sim/battle.js';
import { createArsenal, TIERS } from './sim/arsenal.js';
import { createArtillery } from './sim/artillery.js';
import { createBus } from './core/bus.js';
import { createScene } from './render/scene.js';
import { createArmies } from './render/armies.js';
import { createWalls } from './render/walls.js';
import { createEffects } from './render/effects.js';
import { createExplosions } from './render/fx/explosions.js';
import { createTracers } from './render/fx/tracers.js';
import { createGrenades } from './render/fx/grenades.js';
import { createBeams } from './render/fx/beams.js';
import { createTanks } from './render/units/tank.js';
import { createJets } from './render/units/jet.js';
import { createHelis } from './render/units/heli.js';
import { createCameraRig } from './render/camera.js';
import { createRuler } from './render/ruler.js';
import { createHoloChart } from './render/holochart.js';
import { createMarkers } from './render/markers.js';
import { createProfile } from './render/profile.js';
import { createGhosts } from './render/ghosts.js';
import { createChart } from './ui/chart.js';
import { createPostFX } from './render/postfx.js';
import { createAudio } from './audio/sound.js';
import { createHud } from './ui/hud.js';
import { createReport } from './ui/report.js';

const hud = createHud();
const { renderer, scene, camera, setFront, setDayNight } = createScene();
const battle = createBattle();
const bus = createBus();
const norm = createNormalizer();
const arsenal = createArsenal(norm, battle, bus);
const artillery = createArtillery(norm, bus);
const audio = createAudio();

const armies = createArmies(scene, battle);
const walls = createWalls(scene, battle);
const skulls = createEffects(scene);
const explosions = createExplosions(scene);
const beams = createBeams(scene);
const tracers = createTracers(scene, battle);
const grenades = createGrenades(scene, battle, explosions, (s, x) => audio.explosion(s, x));
const tanks = createTanks(scene, battle, explosions, (x) => audio.explosion(0.7, x));
const helis = createHelis(scene, battle, explosions, (x) => audio.explosion(0.6, x));
const rig = createCameraRig(camera, renderer, battle);
const ruler = createRuler(scene);
const holo = createHoloChart(scene);
const markers = createMarkers(scene);
const profile = createProfile(scene);
const ghosts = createGhosts(scene);
const chart = createChart(
  (closes) => holo.setData(closes),
  (tf) => hud.setHoloTf(tf),
  (visible) => hud.setOption('chart', visible),
);
hud.onHoloTf((tf) => chart.setTf(tf));

const report = createReport();
hud.onReport(() => report.open({
  price: lastPrice, open: sessionOpen, hi: sessHi, lo: sessLo,
  kills: battle.kills, poc: profile.poc,
  elapsedMs: Date.now() - sess.start,
  ...sess,
}));
const postfx = createPostFX(renderer, scene, camera);

// slow-mo state (carpet bombs)
let timeScale = 1, slowmoT = 0;
const slowMo = () => { timeScale = 0.3; slowmoT = 0.55; };

const jets = createJets(scene, battle, (x, z, side, kills, size) => {
  if (size >= 4) { // MOAB impact
    explosions.moabBoom(x, z);
    hud.flashScreen();
    rig.addTrauma(1.0);
    timeScale = 0.22;
    slowmoT = 0.9;
  } else {
    explosions.boom(x, z, size);
    rig.addTrauma(0.5);
  }
  battle.blastAt(side, x, z, kills, size); // victims fly from the impact point
  tanks.checkStrike(x, z, side);
  audio.explosion(size);
}, explosions, (ms) => rig.bombCam(ms));

// quiet-period director: never let the front go silent for 45s
let lastHeavy = performance.now();
const heavyNow = () => { lastHeavy = performance.now(); };

// escalation events → weapon systems (+ ladder row pulses)
bus.on('grenade', (d) => {
  for (let i = 0; i < d.count; i++) grenades.spawn(d.side);
  hud.flashTier('grenade');
});
bus.on('tank', (d) => { tanks.deploy(d.side); hud.flashTier('tank'); heavyNow(); });
bus.on('heli', (d) => {
  helis.deploy(d.side); audio.heli(battle.front); hud.flashTier('heli'); heavyNow();
});
bus.on('airstrike', (d) => {
  jets.strike(d.side, d.kills); audio.jet(battle.front); hud.flashTier('air'); heavyNow();
});
bus.on('carpet', (d) => {
  jets.carpet(d.side, d.kills); audio.jet(battle.front); slowMo();
  hud.flashTier('carpet'); heavyNow();
});
bus.on('moab', (d) => {
  jets.moab(d.side, d.kills);
  audio.jet(battle.front);
  hud.whale('💣 MOAB INBOUND');
  hud.flashTier('moab');
  heavyNow();
});

// artillery budget tips → rotating hardware
bus.on('ordnance', (d) => {
  hud.flashTier('pot');
  heavyNow();
  if (d.kind === 'mortar') {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => grenades.spawn(d.side, { mortar: true }), i * 260);
    }
  } else if (d.kind === 'tankSortie') {
    tanks.deploy(d.side);
  } else { // strafe
    jets.strafe(d.side);
    audio.jet();
  }
});

// intro: dry jet flyovers while the infantry populates — nothing fires,
// it just shows newcomers that things can and will happen here
const INTRO = [[600, 0, -8], [1100, 1, 6], [1650, 0, 14], [1650, 1, -14]];
for (const [ms, side, zoff] of INTRO) {
  setTimeout(() => { jets.flyover(side, zoff); rig.addTrauma(0.12); }, ms);
}

audio.setListener(() => rig.controls.target.x);
let dayNightOn = true;
let autoOrbitOn = false;
hud.onOptions((key) => {
  if (key === 'sound') { audio.setMuted(!audio.muted); return !audio.muted; }
  if (key === 'clean') return document.body.classList.toggle('clean');
  if (key === 'daynight') { dayNightOn = !dayNightOn; return dayNightOn; }
  if (key === 'orbit') {
    autoOrbitOn = !autoOrbitOn;
    rig.setAutoOrbit(autoOrbitOn);
    return autoOrbitOn;
  }
  if (key === 'chart') return chart.setVisible(!chart.visible);
  return false;
});

// day/night follows the real clock: trough deep in the Asia overnight
// (02:00 UTC), peak during the US session (14:00 UTC)
const dayCurve = () => {
  const d = new Date();
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  return 0.5 - 0.5 * Math.cos(((h - 2) / 24) * Math.PI * 2);
};

let lastPrice = 0;
let sessionOpen = 0;
let lastFeedName = '';
let feedIsSim = false; // must exist before the first feed status event
let sessHi = 0, sessLo = 0; // session market structure
const sess = { // war-report stats
  start: Date.now(), biggestQty: 0, biggestSide: '',
  buyVol: 0, sellVol: 0, liqLong: 0, liqShort: 0, liqCount: 0,
  bloodV: 0, bloodRound: 0, hist: [],
};
function resetSess() {
  sess.start = Date.now();
  sess.biggestQty = 0; sess.biggestSide = '';
  sess.buyVol = 0; sess.sellVol = 0;
  sess.liqLong = 0; sess.liqShort = 0; sess.liqCount = 0;
  sess.bloodV = 0; sess.bloodRound = 0;
  sess.hist.length = 0;
}
setInterval(() => { // session sparkline samples (every 5s, ~1h window)
  if (!lastPrice) return;
  sess.hist.push(lastPrice);
  if (sess.hist.length > 720) sess.hist.shift();
}, 5000);
let buyV = 0, sellV = 0;
let round = 1;

let bannerLockUntil = 0; // "while you were gone" gets banner priority

const candles = createCandles((c) => {
  round = c.round + 1;
  if (c.v > sess.bloodV) { sess.bloodV = c.v; sess.bloodRound = c.round; }
  if (Date.now() < bannerLockUntil) return; // don't stomp the return banner
  const d = c.c - c.o;
  if (Math.abs(d) > 1500) return; // feed-switch artifact, not a real candle
  const dir = Math.abs(d) < 1 ? 'flat' : d > 0 ? 'bulls' : 'bears';
  const title =
    dir === 'flat' ? 'STALEMATE'
    : dir === 'bulls' ? 'BULLS TAKE GROUND'
    : 'BEARS TAKE GROUND';
  const sign = d >= 0 ? '+' : '−';
  hud.banner(title, dir,
    `ROUND ${c.round} · ${sign}$${Math.abs(d).toFixed(0)} · VOL ${c.v.toFixed(1)} BTC`);
});

function handleEvent(type, d) {
  if (type === 'trade') {
    if (!Number.isFinite(d.price) || !Number.isFinite(d.qty) || d.qty <= 0) return;
    if (!sessionOpen) { sessionOpen = d.price; sessHi = d.price; sessLo = d.price; }
    lastPrice = d.price;
    profile.add(d.price, d.qty);
    if (d.price > sessHi) sessHi = d.price;
    if (d.price < sessLo) sessLo = d.price;
    if (d.side === 'buy') sess.buyVol += d.qty; else sess.sellVol += d.qty;
    if (d.qty > sess.biggestQty) { sess.biggestQty = d.qty; sess.biggestSide = d.side; }
    battle.setPrice(d.price);
    norm.add(d.qty);
    candles.add(d);

    const res = arsenal.process(d);
    artillery.add(d.side === 'buy' ? 0 : 1, d.qty);
    if (away && document.hidden) { // tally the battle we're missing
      away.v += d.qty;
      if (res.whale) away.whales++;
    }
    if (d.side === 'buy') buyV += d.qty; else sellV += d.qty;
    chart.setLive(d.price);
    hud.tapeTrade(d.side, d.qty, d.price, res.r >= TIERS.GRENADE);
    if (res.moab) {
      // MOAB alert handled by the bus handler
    } else if (res.carpet) {
      hud.whale(`🚨 ${d.qty.toFixed(1)} BTC ${d.side.toUpperCase()} — SQUADRON INBOUND`);
    } else if (res.whale) {
      hud.whale(`🛩 ${d.qty.toFixed(1)} BTC ${d.side.toUpperCase()} — AIRSTRIKE INBOUND`);
    }
  } else if (type === 'depth') {
    battle.onDepth(d);
  } else if (type === 'status') {
    // source changed → re-baseline the session % (prices differ per source,
    // and live↔simulated jumps would otherwise show nonsense like +87%)
    if (!d.name.startsWith('CONNECTING') && d.name !== lastFeedName) {
      if (lastFeedName) { // source changed → re-baseline session structure
        sessionOpen = 0;
        sessHi = 0; sessLo = 0;
        profile.reset();
        resetSess();
      }
      lastFeedName = d.name;
    }
    feedIsSim = !!d.sim;
    hud.setFeed(d.name, !!d.live, !!d.sim);
  }
}

const feed = startFeed(handleEvent);
hud.onFeedSelect((src) => feed.use(src));

// ── liquidations: the market executing its own soldiers ────────────────────
const liqTimes = [];
let cascadeCooldown = 0;

function onLiq(liq) {
  const vSide = liq.side === 'long' ? 0 : 1; // longs die on the bull side
  const N = liq.notional;
  const count =
    N < 10000 ? 1
    : N < 100000 ? Math.min(8, 3 + Math.floor(N / 25000))
    : N < 1e6 ? Math.min(18, 10 + Math.floor(N / 150000))
    : Math.min(30, 20 + Math.floor(N / 500000));

  const spots = battle.execute(vSide, count);
  for (const p of spots) beams.spawn(p.x, p.z, vSide);
  audio.zap(battle.front, N >= 100000);
  hud.tapeLiq(liq.side, liq.qty, N);
  sess.liqCount++;
  if (liq.side === 'long') sess.liqLong += N; else sess.liqShort += N;

  if (N >= 100000 && Date.now() >= bannerLockUntil) {
    hud.banner(
      liq.side === 'long' ? 'LONGS LIQUIDATED' : 'SHORTS LIQUIDATED',
      liq.side === 'long' ? 'bears' : 'bulls',
      `$${N >= 1e6 ? `${(N / 1e6).toFixed(1)}M` : `${Math.round(N / 1000)}K`} FORCED OUT`,
    );
    rig.addTrauma(N >= 1e6 ? 0.8 : 0.4);
    if (N >= 1e6) { timeScale = 0.35; slowmoT = 0.4; }
  }

  // cascade: 3+ liquidations inside 5s → the market is eating itself
  const now = Date.now();
  liqTimes.push(now);
  while (liqTimes.length && now - liqTimes[0] > 5000) liqTimes.shift();
  if (liqTimes.length >= 3 && now > cascadeCooldown) {
    cascadeCooldown = now + 25000;
    hud.banner('LIQUIDATION CASCADE', liq.side === 'long' ? 'bears' : 'bulls',
      'STOPS TRIGGERING STOPS', 3400);
    rig.addTrauma(0.9);
  }
}

startLiquidations(onLiq, {
  isSim: () => feedIsSim,
  getPrice: () => lastPrice,
});

// "WHILE YOU WERE GONE" — the backlog of frozen attacks bursts on return;
// this banner explains it with what the market did in the meantime.
let away = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    away = { t: Date.now(), price: lastPrice, v: 0, whales: 0 };
    return;
  }
  if (!away) return;
  const secs = (Date.now() - away.t) / 1000;
  const snap = away;
  away = null;
  if (secs < 5 || !snap.price || !lastPrice) return;
  const d = lastPrice - snap.price;
  const cls = Math.abs(d) < 1 ? 'flat' : d > 0 ? 'bulls' : 'bears';
  const parts = [`${d >= 0 ? '+' : '−'}$${Math.abs(d).toFixed(0)}`];
  if (snap.v > 0) parts.push(`${snap.v.toFixed(1)} BTC TRADED`);
  if (snap.whales) parts.push(`${snap.whales} WHALE STRIKE${snap.whales > 1 ? 'S' : ''}`);
  parts.push(secs > 90 ? `${Math.round(secs / 60)}m AWAY` : `${Math.round(secs)}s AWAY`);
  bannerLockUntil = Date.now() + 5200;
  setTimeout(() => {
    hud.banner('WHILE YOU WERE GONE', cls, parts.join(' · '), 4500);
    rig.addTrauma(0.25);
  }, 450); // let the resume burst start first, then explain it
});

// Demo hotkeys 1–6: fire each ladder tier directly (bypasses the trade
// pipeline — injected trades inflate the rolling average and demote
// themselves). Keys are shown on the escalation ladder rows.
window.addEventListener('keydown', (e) => {
  const side = Math.random() < 0.5 ? 0 : 1;
  if (e.key === '1') bus.emit('grenade', { side, count: 2 });
  if (e.key === '2') bus.emit('tank', { side });
  if (e.key === '3') bus.emit('heli', { side });
  if (e.key === '4') bus.emit('airstrike', { side, kills: 30 });
  if (e.key === '5') bus.emit('carpet', { side, kills: 60 });
  if (e.key === '6') bus.emit('moab', { side, kills: 80 });
  if (e.key === '8') { // demo liquidation, random tier
    const notional = [8000, 60000, 400000, 1600000][(Math.random() * 4) | 0];
    const price = lastPrice || 60000;
    onLiq({
      side: Math.random() < 0.5 ? 'long' : 'short',
      qty: notional / price, price, notional, ts: Date.now(),
    });
  }
});

// browser tab title = who's winning + live price. setInterval (not the
// render loop) so it keeps ticking while the tab is backgrounded — that's
// when a live title matters most (browsers throttle it to ~1/min hidden).
setInterval(() => {
  if (!lastPrice || !sessionOpen) return;
  const winner = lastPrice >= sessionOpen ? 'Bulls' : 'Bears';
  document.title = `${winner} ${(lastPrice / 1000).toFixed(1)}k`;
}, 5000);

const clock = new THREE.Clock();
let simT = 0;
renderer.setAnimationLoop(() => {
  const rdt = Math.min(0.05, clock.getDelta());
  if (slowmoT > 0) { slowmoT -= rdt; if (slowmoT <= 0) timeScale = 1; }
  const dt = rdt * timeScale;
  simT += dt;

  battle.update(dt);
  armies.update(simT);
  walls.update(dt);
  tracers.update(dt, battle.aggression, (s, x) => audio.shot(x));
  explosions.update(dt);
  beams.update(dt);
  grenades.update(dt);
  tanks.update(dt);
  jets.update(dt);
  helis.update(dt);

  // director: 45s without heavy hardware → spend whatever the pot holds
  if (battle.base && performance.now() - lastHeavy > 45000) {
    heavyNow();
    const side = artillery.level(0) >= artillery.level(1) ? 0 : 1;
    const mag = artillery.drain(side);
    if (mag < 0.05) {
      jets.flyover(side, (Math.random() - 0.5) * 20); // nothing brewing: recon pass
    } else {
      const roll = Math.random();
      if (roll < 0.07) bus.emit('moab', { side, kills: Math.ceil(12 + 30 * mag) });
      else if (roll < 0.35) bus.emit('airstrike', { side, kills: Math.ceil(8 + 22 * mag) });
      else {
        bus.emit('ordnance', {
          side, kind: ['mortar', 'tankSortie', 'strafe'][Math.floor(Math.random() * 3)],
        });
      }
    }
  }

  // first price arrived → draw the ruler; rebases → shift world + renumber
  if (!ruler.built && battle.base) ruler.rebuild(battle.base);
  for (const dx of battle.rebaseQ.splice(0)) {
    explosions.shiftX(dx);
    tracers.shiftX(dx);
    grenades.shiftX(dx);
    tanks.shiftX(dx);
    jets.shiftX(dx);
    helis.shiftX(dx);
    beams.shiftX(dx);
    skulls.shiftX(dx);
    rig.shiftX(dx);
    ruler.rebuild(battle.base);
  }

  for (const g of battle.ghostQ.splice(0)) ghosts.spawn(g);
  for (const s of battle.skullQ.splice(0)) skulls.spawn(s.x, s.z, s.n);
  for (const b of battle.breachQ.splice(0)) {
    hud.banner(
      b.side === 'bid' ? 'BUY WALL BREACHED' : 'SELL WALL BREACHED',
      b.side === 'bid' ? 'bears' : 'bulls',
      'LIQUIDITY CONSUMED',
    );
    rig.addTrauma(0.35);
  }
  skulls.update(dt);

  rig.update(rdt, simT);
  holo.update(battle.front, camera.position.x > battle.front); // time reads L→R
  markers.update({
    front: battle.front,
    price: battle.price,
    hi: sessHi,
    lo: sessLo,
    bid: battle.bestBid,
    ask: battle.bestAsk,
  });
  profile.update(battle.front, battle.price);
  ghosts.update(dt, battle.front, battle.price);
  ruler.setFlip(camera.position.z < rig.controls.target.z); // numerals face the viewer
  setFront(battle.front);
  setDayNight(dayNightOn ? dayCurve() : 0.65);

  const decay = Math.exp(-rdt / 45);
  buyV *= decay;
  sellV *= decay;

  hud.update({
    price: lastPrice,
    chg: sessionOpen ? (lastPrice / sessionOpen - 1) * 100 : 0,
    buyV, sellV,
    kills: battle.kills,
    round,
    pots: [artillery.level(0), artillery.level(1)],
  });

  postfx.render(rdt);
});
