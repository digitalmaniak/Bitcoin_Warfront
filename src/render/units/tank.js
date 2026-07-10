import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function buildTankGeo() {
  const parts = [];
  const box = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts.push(g);
  };
  box(3.4, 0.7, 0.55, 0, 0.35, 0.95);   // track R
  box(3.4, 0.7, 0.55, 0, 0.35, -0.95);  // track L
  box(3.2, 0.7, 1.6, 0, 0.95, 0);       // hull
  box(1.5, 0.6, 1.3, -0.2, 1.6, 0);     // turret
  const barrel = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8);
  barrel.rotateZ(Math.PI / 2);
  barrel.translate(1.4, 1.65, 0);
  parts.push(barrel);
  return mergeGeometries(parts);
}

// Tank tier: rolls up from the rear, shells the enemy line, drives off.
// An enemy airstrike landing nearby destroys it.
export function createTanks(scene, battle, explosions, onFire) {
  const geo = buildTankGeo();
  const mats = [
    new THREE.MeshStandardMaterial({ color: 0x2e8f5c, emissive: 0x0a2e1a, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0xc44536, emissive: 0x30100a, roughness: 0.6 }),
  ];
  const pool = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(geo, mats[side]);
      m.scale.setScalar(2);
      m.visible = false; scene.add(m);
      pool.push({ m, side, active: false, x: 0, z: 0, state: 'in', fireT: 0, life: 0, recoil: 0 });
    }
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dirOf = (side) => (side === 0 ? -1 : 1);

  return {
    deploy(side) {
      const t = pool.find((p) => p.side === side && !p.active);
      if (!t) return;
      const dir = dirOf(side);
      t.active = true; t.state = 'in';
      t.z = rnd(-20, 20);
      t.x = battle.front + dir * 62;
      t.life = 40; t.fireT = 1.5; t.recoil = 0;
      t.m.rotation.y = side === 0 ? 0 : Math.PI; // barrel faces the enemy
      t.m.visible = true;
    },

    shiftX(dx) {
      for (const t of pool) if (t.active) t.x += dx;
    },

    // enemy ordnance landed at (x,z) — destroy tanks caught in the blast
    checkStrike(x, z, strikingSide) {
      for (const t of pool) {
        if (!t.active || t.side === strikingSide) continue;
        if (Math.hypot(t.x - x, t.z - z) < 9) {
          t.active = false; t.m.visible = false;
          explosions.boom(t.x, t.z, 1.6);
        }
      }
    },

    update(dt) {
      const f = battle.front;
      for (const t of pool) {
        if (!t.active) continue;
        const dir = dirOf(t.side);
        if (t.state === 'in') {
          const tx = f + dir * 15;
          t.x += Math.sign(tx - t.x) * Math.min(9 * dt, Math.abs(tx - t.x));
          if (Math.abs(t.x - tx) < 0.6) t.state = 'hold';
        } else if (t.state === 'hold') {
          t.life -= dt;
          t.fireT -= dt;
          // track the frontline while holding
          const tx = f + dir * 15;
          t.x += (tx - t.x) * Math.min(1, dt * 1.5);
          if (t.fireT <= 0) {
            t.fireT = 2.4 + rnd(0, 1.4);
            t.recoil = 0.55;
            const ez = t.z + rnd(-7, 7);
            explosions.boom(f - dir * rnd(3, 10), ez, 1);
            battle.strikeAt(t.side, ez, 3);
            if (onFire) onFire();
          }
          if (t.life <= 0) t.state = 'out';
        } else { // out
          t.x += dir * 9 * dt;
          if (Math.abs(t.x - f) > 70) { t.active = false; t.m.visible = false; }
        }
        t.recoil *= Math.exp(-dt * 6);
        t.m.position.set(t.x + dir * t.recoil * 0.6, 0, t.z);
      }
    },
  };
}
