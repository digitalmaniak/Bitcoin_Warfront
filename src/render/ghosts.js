import * as THREE from 'three';
import { CFG } from '../sim/battle.js';

// Depth ghosts: when a big wall gets PULLED (vanishes with price nowhere
// near it — spoofing), a pale wireframe stays where it stood and fades over
// ~7s. Positioned by true price level each frame, so ghosts ride the tween
// and rebases like every other market structure.
const S = CFG.priceScale;
const LIFE = 7;
const COLORS = [0xa8ffd4, 0xffb9a8]; // pulled bid (pale green), pulled ask (pale red)

export function createGhosts(scene) {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, CFG.fieldZ * 2 * 0.95));
  geo.translate(0, 0.5, 0);
  const pool = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.visible = false;
    scene.add(m);
    pool.push({ m, life: Infinity, lvl: 0, h: 1, w: 1 });
  }
  const take = () =>
    pool.find((g) => g.life === Infinity) || pool.reduce((a, b) => (a.life > b.life ? b : a));

  return {
    spawn(g) { // {lvl, h, w, side}
      const slot = take();
      slot.life = 0;
      slot.lvl = g.lvl;
      slot.h = g.h;
      slot.w = g.w;
      slot.m.material.color.setHex(COLORS[g.side === 'bid' ? 0 : 1]);
      slot.m.visible = true;
    },
    update(dt, front, price) {
      for (const g of pool) {
        if (g.life === Infinity) continue;
        g.life += dt;
        if (g.life > LIFE || !price) { g.life = Infinity; g.m.visible = false; continue; }
        const x = front + (g.lvl - price) * S;
        if (Math.abs(x - front) > 80) { g.m.visible = false; continue; }
        g.m.visible = true;
        g.m.position.set(x, 0, 0);
        g.m.scale.set(g.w, g.h, 1);
        g.m.material.opacity = 0.5 * (1 - g.life / LIFE);
      }
    },
  };
}
