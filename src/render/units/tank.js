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
  // neon glow: hardware must pop against walls and infantry (bloom catches these)
  const mats = [
    new THREE.MeshStandardMaterial({
      color: 0x2eff7e, emissive: 0x00ff66, emissiveIntensity: 0.55, roughness: 0.35,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xff4a3a, emissive: 0xff2200, emissiveIntensity: 0.55, roughness: 0.35,
    }),
  ];
  const pool = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(geo, mats[side]);
      m.scale.setScalar(2);
      m.visible = false; scene.add(m);
      pool.push({
        m, side, active: false, x: 0, z: 0, state: 'in',
        fireT: 0, life: 0, recoil: 0, y: 0, vy: 0,
      });
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
      t.life = 40; t.fireT = 1.5; t.recoil = 0; t.y = 0; t.vy = 0;
      t.m.rotation.y = side === 0 ? 0 : Math.PI; // barrel faces the enemy
      t.m.visible = true;
    },

    shiftX(dx) {
      for (const t of pool) if (t.active) t.x += dx;
    },

    // air-drop active tanks onto their correct posts (redeploy)
    redeploy() {
      const f = battle.front;
      for (const t of pool) {
        if (!t.active || t.state === 'out') continue;
        t.x = f + dirOf(t.side) * 15;
        t.state = 'hold';
        t.fireT = Math.max(t.fireT, 1.5);
        t.y = rnd(16, 28);
        t.vy = 0;
      }
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
        if (t.y > 0 || t.vy !== 0) { // dropping in: heavy fall, small bounce
          t.vy -= 26 * dt;
          t.y += t.vy * dt;
          if (t.y <= 0) {
            if (t.vy < -5) { t.y = 0; t.vy = -t.vy * 0.2; }
            else { t.y = 0; t.vy = 0; }
          }
          t.m.position.set(t.x, t.y, t.z);
          continue;
        }
        if (t.state === 'in') {
          const tx = f + dir * 15;
          t.x += Math.sign(tx - t.x) * Math.min(17 * dt, Math.abs(tx - t.x));
          if (Math.abs(t.x - tx) < 0.6) t.state = 'hold';
        } else if (t.state === 'hold') {
          t.life -= dt;
          t.fireT -= dt;
          // track the frontline while holding (fast enough for violent moves)
          const tx = f + dir * 15;
          t.x += (tx - t.x) * Math.min(1, dt * 3);
          if (t.fireT <= 0) {
            t.fireT = 2.4 + rnd(0, 1.4);
            t.recoil = 0.55;
            const ex = f - dir * rnd(3, 10);
            const ez = t.z + rnd(-7, 7);
            explosions.boom(ex, ez, 1);
            battle.blastAt(t.side, ex, ez, 3, 1); // shell blast throws victims
            if (onFire) onFire();
          }
          if (t.life <= 0) t.state = 'out';
        } else { // out
          t.x += dir * 16 * dt;
          if (Math.abs(t.x - f) > 70) { t.active = false; t.m.visible = false; }
        }
        // the price wall shoves tanks too — never stranded on the wrong side
        if (t.side === 0) t.x = Math.min(t.x, f - 6);
        else t.x = Math.max(t.x, f + 6);

        t.recoil *= Math.exp(-dt * 6);
        t.m.position.set(t.x + dir * t.recoil * 0.6, 0, t.z);
        battle.displace(t.x, t.z, 4.6, dt); // plow infantry aside, don't ghost through
      }
    },
  };
}
