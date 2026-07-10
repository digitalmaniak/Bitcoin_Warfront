import * as THREE from 'three';
import { startFeed } from './market/feed.js';
import { createCandles } from './market/candles.js';
import { createNormalizer } from './market/normalize.js';
import { createBattle } from './sim/battle.js';
import { createArsenal } from './sim/arsenal.js';
import { createArtillery } from './sim/artillery.js';
import { createBus } from './core/bus.js';
import { createScene } from './render/scene.js';
import { createArmies } from './render/armies.js';
import { createWalls } from './render/walls.js';
import { createEffects } from './render/effects.js';
import { createExplosions } from './render/fx/explosions.js';
import { createTracers } from './render/fx/tracers.js';
import { createGrenades } from './render/fx/grenades.js';
import { createTanks } from './render/units/tank.js';
import { createJets } from './render/units/jet.js';
import { createCameraRig } from './render/camera.js';
import { createPostFX } from './render/postfx.js';
import { createAudio } from './audio/sound.js';
import { createHud } from './ui/hud.js';

const hud = createHud();
const { renderer, scene, camera, setFront } = createScene();
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
const tracers = createTracers(scene, battle);
const grenades = createGrenades(scene, battle, explosions, (s) => audio.explosion(s));
const tanks = createTanks(scene, battle, explosions, () => audio.explosion(0.7));
const rig = createCameraRig(camera, renderer, battle);
const postfx = createPostFX(renderer, scene, camera);

// slow-mo state (carpet bombs)
let timeScale = 1, slowmoT = 0;
const slowMo = () => { timeScale = 0.3; slowmoT = 0.55; };

const jets = createJets(scene, battle, (x, z, side, kills, size) => {
  explosions.boom(x, z, size);
  battle.strikeAt(side, z, kills);
  tanks.checkStrike(x, z, side);
  audio.explosion(size);
  rig.addTrauma(0.5);
}, explosions);

// escalation events → weapon systems (+ ladder row pulses)
bus.on('grenade', (d) => {
  for (let i = 0; i < d.count; i++) grenades.spawn(d.side);
  hud.flashTier('grenade');
});
bus.on('tank', (d) => { tanks.deploy(d.side); hud.flashTier('tank'); });
bus.on('airstrike', (d) => { jets.strike(d.side, d.kills); audio.jet(); hud.flashTier('air'); });
bus.on('carpet', (d) => {
  jets.carpet(d.side, d.kills); audio.jet(); slowMo(); hud.flashTier('carpet');
});

// artillery budget tips → rotating hardware
bus.on('ordnance', (d) => {
  hud.flashTier('pot');
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

hud.onMute(() => { audio.setMuted(!audio.muted); return audio.muted; });

let lastPrice = 0;
let sessionOpen = 0;
let buyV = 0, sellV = 0;
let round = 1;

let bannerLockUntil = 0; // "while you were gone" gets banner priority

const candles = createCandles((c) => {
  round = c.round + 1;
  if (Date.now() < bannerLockUntil) return; // don't stomp the return banner
  const d = c.c - c.o;
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
    if (!sessionOpen) sessionOpen = d.price;
    lastPrice = d.price;
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
    if (res.carpet) {
      hud.whale(`🚨 ${d.qty.toFixed(1)} BTC ${d.side.toUpperCase()} — SQUADRON INBOUND`);
    } else if (res.whale) {
      hud.whale(`🛩 ${d.qty.toFixed(1)} BTC ${d.side.toUpperCase()} — AIRSTRIKE INBOUND`);
    }
  } else if (type === 'depth') {
    battle.onDepth(d);
  } else if (type === 'status') {
    hud.setFeed(d.name, !!d.live, !!d.sim);
  }
}

startFeed(handleEvent);

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

// Demo hotkeys — synthetic trades through the exact same pipeline.
const inject = (side, qty) => handleEvent('trade', {
  side, qty, price: lastPrice || battle.price || 117000, ts: Date.now(),
});
window.addEventListener('keydown', (e) => {
  const whaleQty = Math.max(6, norm.ref * 60);
  if (e.key === '1') inject('buy', whaleQty * 1.3);
  if (e.key === '2') inject('sell', whaleQty * 1.3);
  if (e.key === '3') {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => inject('sell', norm.ref * (18 + Math.random() * 30)), i * 140);
    }
    setTimeout(() => inject('sell', whaleQty * 3.4), 1200); // the cascade climax
  }
});

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
  tracers.update(dt, battle.aggression, () => audio.shot());
  explosions.update(dt);
  grenades.update(dt);
  tanks.update(dt);
  jets.update(dt);

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
  setFront(battle.front);

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
