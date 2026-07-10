import * as THREE from 'three';
import { startFeed } from './market/feed.js';
import { createCandles } from './market/candles.js';
import { createNormalizer } from './market/normalize.js';
import { createBattle } from './sim/battle.js';
import { createScene } from './render/scene.js';
import { createArmies } from './render/armies.js';
import { createWalls } from './render/walls.js';
import { createEffects } from './render/effects.js';
import { createCameraRig } from './render/camera.js';
import { createHud } from './ui/hud.js';

const hud = createHud();
const { renderer, scene, camera, setFront } = createScene();
const battle = createBattle();
const armies = createArmies(scene, battle);
const walls = createWalls(scene, battle);
const fx = createEffects(scene);
const rig = createCameraRig(camera, renderer, battle);
const norm = createNormalizer();

let lastPrice = 0;
let sessionOpen = 0;
let buyV = 0, sellV = 0; // decaying rolling volume
let round = 1;

const candles = createCandles((c) => {
  round = c.round + 1;
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

startFeed((type, d) => {
  if (type === 'trade') {
    if (!Number.isFinite(d.price) || !Number.isFinite(d.qty) || d.qty <= 0) return;
    if (!sessionOpen) sessionOpen = d.price;
    lastPrice = d.price;
    battle.setPrice(d.price);
    norm.add(d.qty);
    candles.add(d);

    const n = norm.soldiers(d.qty);
    const whale = norm.isWhale(d.qty);
    const skulls = norm.skulls(d.qty);
    battle.onTrade(d.side === 'buy' ? 0 : 1, n, { whale, skulls });

    if (d.side === 'buy') buyV += d.qty; else sellV += d.qty;
    if (whale) hud.whale(`🐋 ${d.qty.toFixed(1)} BTC MARKET ${d.side.toUpperCase()}`);
  } else if (type === 'depth') {
    battle.onDepth(d);
  } else if (type === 'status') {
    hud.setFeed(d.name, !!d.live);
  }
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());

  battle.update(dt);
  armies.update();
  walls.update(dt);

  for (const s of battle.skullQ.splice(0)) fx.spawn(s.x, s.z, s.n);
  fx.update(dt);

  rig.update();
  setFront(battle.front);

  const decay = Math.exp(-dt / 45);
  buyV *= decay;
  sellV *= decay;

  hud.update({
    price: lastPrice,
    chg: sessionOpen ? (lastPrice / sessionOpen - 1) * 100 : 0,
    buyV, sellV,
    kills: battle.kills,
    round,
  });

  renderer.render(scene, camera);
});
