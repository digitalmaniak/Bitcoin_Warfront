import * as THREE from 'three';

// Instanced tracer fire across the frontline. Fire rate per side is driven
// by that side's rolling aggression — a heavy tape looks like a heavy tape.
// Purely cosmetic: kills always come from trades.
const CAP = 128;

export function createTracers(scene, battle) {
  const geo = new THREE.BoxGeometry(0.1, 0.1, 2.4);
  const mk = (color) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }), CAP);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    return im;
  };
  const meshes = [mk(0x9dffc8), mk(0xffb3a0)];

  const slots = [[], []];
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < CAP; i++) {
      slots[s].push({ live: false, x: 0, z: 0, dx: 0, dz: 0, t: 0, dist: 0 });
    }
  }
  const acc = [0, 0];
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1.2, 0);

  function findSource(side) {
    const units = battle.units;
    for (let tries = 0; tries < 10; tries++) {
      const u = units[(Math.random() * units.length) | 0];
      if (u.alive && u.state === 1 && u.side === side) return u;
    }
    return null;
  }

  function fireTo(side, tx, tz, speed) {
    const src = findSource(side);
    if (!src) return false;
    const slot = slots[side].find((s) => !s.live);
    if (!slot) return false;
    const dx = tx - src.x, dz = tz - src.z;
    const d = Math.hypot(dx, dz) || 1;
    slot.live = true;
    slot.x = src.x; slot.z = src.z;
    slot.dx = dx / d; slot.dz = dz / d;
    slot.t = 0; slot.dist = d;
    slot.speed = speed || 60;
    return true;
  }

  function fireAmbient(side) {
    const src = findSource(side);
    if (!src) return false;
    const front = battle.front;
    return fireTo(
      side,
      2 * front - src.x + (Math.random() - 0.5) * 4,
      src.z + (Math.random() - 0.5) * 8,
      60,
    );
  }

  // onShot(side) lets audio crackle in sync
  function update(dt, aggression, onShot) {
    // kill-tracers: timed so the round arrives as its victim drops
    for (const s of battle.shotQ.splice(0)) {
      const src = findSource(s.side);
      if (!src) continue;
      const d = Math.hypot(s.x - src.x, s.z - src.z) || 1;
      const speed = Math.max(50, Math.min(150, d / Math.max(0.08, s.t * 0.85)));
      if (fireTo(s.side, s.x, s.z, speed) && onShot) onShot(s.side);
    }
    for (let side = 0; side < 2; side++) {
      const rate = Math.min(24, 1.5 + aggression[side] * 0.08); // ambient misses
      acc[side] += rate * dt;
      while (acc[side] >= 1) {
        acc[side] -= 1;
        if (fireAmbient(side) && onShot) onShot(side);
      }
      let n = 0;
      const im = meshes[side];
      for (const s of slots[side]) {
        if (!s.live) continue;
        s.t += (s.speed || 60) * dt;
        if (s.t >= s.dist) { s.live = false; continue; }
        const px = s.x + s.dx * s.t, pz = s.z + s.dz * s.t;
        dummy.position.set(px, up.y, pz);
        dummy.lookAt(px + s.dx, up.y, pz + s.dz);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        im.setMatrixAt(n++, dummy.matrix);
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
    }
  }

  function shiftX(dx) {
    for (const side of slots) for (const s of side) if (s.live) s.x += dx;
  }

  return { update, shiftX };
}
