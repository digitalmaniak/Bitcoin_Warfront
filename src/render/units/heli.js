import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function buildBodyGeo() {
  const parts = [];
  const box = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts.push(g);
  };
  box(2.4, 0.9, 1.1, 0, 0, 0);        // fuselage
  box(0.8, 0.6, 0.9, 1.3, 0.05, 0);   // cockpit
  box(2.0, 0.22, 0.22, -2.0, 0.2, 0); // tail boom
  box(0.3, 0.75, 0.08, -2.9, 0.55, 0);// tail fin
  box(2.0, 0.08, 0.12, 0, -0.62, 0.45);  // skid R
  box(2.0, 0.08, 0.12, 0, -0.62, -0.45); // skid L
  return mergeGeometries(parts);
}

// Attack helicopter tier (r ≥ 25): flies in, hovers over the frontline,
// rakes the enemy with rocket volleys, then leaves.
export function createHelis(scene, battle, explosions, onFire) {
  const bodyGeo = buildBodyGeo();
  const rotorGeo = new THREE.BoxGeometry(4.2, 0.06, 0.34);
  const mats = [
    new THREE.MeshStandardMaterial({
      color: 0x2eff7e, emissive: 0x00ff66, emissiveIntensity: 0.65, roughness: 0.3,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xff4a3a, emissive: 0xff2200, emissiveIntensity: 0.65, roughness: 0.3,
    }),
  ];

  const pool = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 2; i++) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, mats[side]);
      const rotor = new THREE.Mesh(rotorGeo, mats[side]);
      rotor.position.y = 0.72;
      grp.add(body, rotor);
      grp.scale.setScalar(2);
      grp.visible = false;
      scene.add(grp);
      pool.push({
        grp, rotor, side, active: false,
        x: 0, z: 0, y: 13, state: 'in', hoverT: 0, fireT: 0, ph: Math.random() * 9,
      });
    }
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dirOf = (side) => (side === 0 ? -1 : 1);

  return {
    deploy(side) {
      const h = pool.find((p) => p.side === side && !p.active);
      if (!h) return;
      const dir = dirOf(side);
      h.active = true; h.state = 'in';
      h.z = rnd(-18, 18);
      h.x = battle.front + dir * 60;
      h.y = 13;
      h.hoverT = 11; h.fireT = 0.8;
      h.grp.rotation.y = side === 0 ? 0 : Math.PI; // nose toward the enemy
      h.grp.visible = true;
    },
    shiftX(dx) {
      for (const h of pool) if (h.active) h.x += dx;
    },
    update(dt) {
      const f = battle.front;
      for (const h of pool) {
        if (!h.active) continue;
        const dir = dirOf(h.side);
        h.rotor.rotation.y += 32 * dt;
        if (h.state === 'in') {
          const tx = f + dir * 10;
          h.x += Math.sign(tx - h.x) * Math.min(24 * dt, Math.abs(tx - h.x));
          if (Math.abs(h.x - tx) < 0.8) h.state = 'hover';
        } else if (h.state === 'hover') {
          h.hoverT -= dt;
          h.fireT -= dt;
          h.x += (f + dir * 10 - h.x) * Math.min(1, dt * 2.4); // track the front
          if (h.fireT <= 0) {
            h.fireT = 1.1;
            const ex = f - dir * rnd(2, 8);
            const ez = h.z + rnd(-5, 5);
            explosions.boom(ex, ez, 0.8);
            battle.blastAt(h.side, ex, ez, 2, 0.8);
            if (onFire) onFire(ex);
          }
          if (h.hoverT <= 0) h.state = 'out';
        } else {
          h.x += dir * 26 * dt;
          h.y += 3 * dt;
          if (Math.abs(h.x - f) > 75) { h.active = false; h.grp.visible = false; }
        }
        h.grp.position.set(h.x, h.y + Math.sin(h.ph + performance.now() / 400) * 0.4, h.z);
      }
    },
  };
}
