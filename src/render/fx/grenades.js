import * as THREE from 'three';

// Parabolic grenade lobs → small cluster blast at the enemy edge.
export function createGrenades(scene, battle, explosions, onBoom) {
  const geo = new THREE.SphereGeometry(0.28, 8, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7 });
  const pool = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false; scene.add(m);
    pool.push({ m, live: false, t: 0, T: 0.9, h: 4.5, x0: 0, z0: 0, x1: 0, z1: 0, side: 0 });
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  return {
    // opts.mortar: launched from deeper in territory, higher slower arc
    spawn(side, opts = {}) {
      const g = pool.find((p) => !p.live);
      if (!g) return;
      const dir = side === 0 ? -1 : 1;
      const f = battle.front;
      g.live = true; g.t = 0; g.side = side;
      g.T = opts.mortar ? 1.35 : 0.9;
      g.h = opts.mortar ? 9.5 : 4.5;
      g.z0 = rnd(-22, 22);
      g.x0 = f + dir * (opts.mortar ? rnd(18, 30) : rnd(8, 14));
      g.x1 = f - dir * rnd(2, 6);
      g.z1 = g.z0 + rnd(-4, 4);
      g.m.visible = true;
    },
    update(dt) {
      for (const g of pool) {
        if (!g.live) continue;
        g.t += dt;
        const k = g.t / g.T;
        if (k >= 1) {
          g.live = false; g.m.visible = false;
          explosions.boom(g.x1, g.z1, 0.7);
          battle.strikeAt(g.side, g.z1, 4);
          if (onBoom) onBoom(0.7);
          continue;
        }
        g.m.position.set(
          g.x0 + (g.x1 - g.x0) * k,
          g.h * 4 * k * (1 - k) + 0.3,
          g.z0 + (g.z1 - g.z0) * k,
        );
        g.m.rotation.x += dt * 9;
      }
    },
  };
}
