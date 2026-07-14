import * as THREE from 'three';

// Liquidation beams: a cold vertical column of light stabs down on each
// executed unit — categorically different from combat FX.
const COLORS = [0x86ffc4, 0xffa694]; // victim side tint (bulls, bears)

export function createBeams(scene) {
  const geo = new THREE.CylinderGeometry(0.55, 0.55, 46, 8, 1, true);
  geo.translate(0, 23, 0);
  const pool = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.visible = false; scene.add(m);
    pool.push({ m, life: Infinity });
  }
  const take = () =>
    pool.find((b) => b.life === Infinity) || pool.reduce((a, b) => (a.life > b.life ? b : a));

  return {
    spawn(x, z, side) {
      const b = take();
      b.life = 0;
      b.m.material.color.setHex(COLORS[side]);
      b.m.position.set(x, 0, z);
      b.m.visible = true;
    },
    shiftX(dx) {
      for (const b of pool) if (b.life !== Infinity) b.m.position.x += dx;
    },
    update(dt) {
      for (const b of pool) {
        if (b.life === Infinity) continue;
        b.life += dt;
        const T = 0.55;
        if (b.life > T) { b.life = Infinity; b.m.visible = false; continue; }
        const k = b.life / T;
        const w = 0.25 + (1 - k) * 1.1; // narrows as it burns out
        b.m.scale.set(w, 1, w);
        b.m.material.opacity = 0.85 * (1 - k * k);
      }
    },
  };
}
