import * as THREE from 'three';

// Pooled explosion suite: fireball, shockwave ring, debris, smoke, scorch.
// Everything preallocated — a liquidation cascade cannot allocate memory.
export function createExplosions(scene) {
  // --- fireballs -----------------------------------------------------------
  const fbGeo = new THREE.IcosahedronGeometry(1, 1);
  const fireballs = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(fbGeo, new THREE.MeshBasicMaterial({
      color: 0xffaa33, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.visible = false; scene.add(m);
    fireballs.push({ m, life: Infinity, size: 1 });
  }

  // --- shockwave rings -----------------------------------------------------
  const ringGeo = new THREE.RingGeometry(0.75, 1, 26);
  const rings = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffddaa, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.15;
    m.visible = false; scene.add(m);
    rings.push({ m, life: Infinity, size: 1 });
  }

  // --- debris (instanced) --------------------------------------------------
  const DEBRIS = 400;
  const dbMesh = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(0.22),
    new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.9 }),
    DEBRIS,
  );
  dbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dbMesh.frustumCulled = false;
  scene.add(dbMesh);
  const db = [];
  for (let i = 0; i < DEBRIS; i++) db.push({ life: Infinity, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1 });
  const dummy = new THREE.Object3D();

  // --- smoke sprites -------------------------------------------------------
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = 64;
  const ctx = cvs.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200,200,200,0.9)');
  grad.addColorStop(1, 'rgba(200,200,200,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  const smokeTex = new THREE.CanvasTexture(cvs);
  const smoke = [];
  for (let i = 0; i < 64; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, transparent: true, depthWrite: false, color: 0x3a3a40, opacity: 0,
    }));
    sp.visible = false; scene.add(sp);
    smoke.push({ sp, life: Infinity, T: 2.5, s: 1, vy: 1.6 });
  }

  // --- scorch decals -------------------------------------------------------
  const scGeo = new THREE.CircleGeometry(1, 20);
  const scorch = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(scGeo, new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.06 + i * 0.0015; // avoid z-fighting between decals
    m.visible = false; scene.add(m);
    scorch.push({ m, life: Infinity });
  }

  const take = (pool) =>
    pool.find((e) => e.life === Infinity) || pool.reduce((a, b) => (a.life > b.life ? b : a));
  const delayQ = []; // {t, fn} — staged multi-part effects (MOAB column)

  function puff(x, y, z, scale = 1) {
    const s = take(smoke);
    s.life = 0; s.T = 1.6 + scale; s.s = scale; s.vy = 1.2 + scale * 0.5;
    s.sp.position.set(x + (Math.random() - 0.5) * scale, y, z + (Math.random() - 0.5) * scale);
    s.sp.visible = true;
  }

  function boom(x, z, size = 1) {
    const f = take(fireballs);
    f.life = 0; f.size = size;
    f.m.position.set(x, 1 + size, z); f.m.visible = true;

    const r = take(rings);
    r.life = 0; r.size = size;
    r.m.position.x = x; r.m.position.z = z; r.m.visible = true;

    const nDeb = Math.min(Math.floor(18 * size), 60);
    for (let i = 0; i < nDeb; i++) {
      const d = take(db);
      d.life = 0;
      d.x = x; d.y = 1; d.z = z;
      const a = Math.random() * Math.PI * 2;
      const v = (4 + Math.random() * 9) * Math.sqrt(size);
      d.vx = Math.cos(a) * v; d.vz = Math.sin(a) * v;
      d.vy = 6 + Math.random() * 10 * Math.sqrt(size);
      d.s = 0.6 + Math.random() * size;
    }

    const nSmoke = Math.min(3 + Math.floor(2 * size), 8);
    for (let i = 0; i < nSmoke; i++) puff(x, 1.5 + i * 0.7, z, size * 1.8);

    const sc = take(scorch);
    sc.life = 0;
    sc.m.position.x = x; sc.m.position.z = z;
    sc.m.scale.setScalar(3.2 * size);
    sc.m.visible = true;
  }

  // The apex blast: huge boom, double shockwave, rising mushroom column + cap
  function moabBoom(x, z) {
    boom(x, z, 3.2);
    delayQ.push({ t: 0.18, fn: () => {
      const r = take(rings);
      r.life = 0; r.size = 5.5;
      r.m.position.x = x; r.m.position.z = z; r.m.visible = true;
    } });
    for (let i = 0; i < 12; i++) {
      delayQ.push({ t: 0.1 + i * 0.12, fn: () => puff(x, 2 + i * 1.9, z, 3.2) });
    }
    for (let i = 0; i < 7; i++) {
      delayQ.push({ t: 1.5 + i * 0.08, fn: () => puff(
        x + (Math.random() - 0.5) * 10, 22 + Math.random() * 3,
        z + (Math.random() - 0.5) * 10, 4.5,
      ) });
    }
  }

  function update(dt) {
    for (let i = delayQ.length - 1; i >= 0; i--) {
      delayQ[i].t -= dt;
      if (delayQ[i].t <= 0) { delayQ[i].fn(); delayQ.splice(i, 1); }
    }
    for (const f of fireballs) {
      if (f.life === Infinity) continue;
      f.life += dt;
      const T = 0.45;
      if (f.life > T) { f.life = Infinity; f.m.visible = false; continue; }
      const k = f.life / T;
      f.m.scale.setScalar(f.size * (1.5 + 5 * k));
      f.m.material.opacity = 1 - k * k;
      f.m.material.color.setHSL(0.08 - k * 0.06, 1, 0.6 - k * 0.25);
    }
    for (const r of rings) {
      if (r.life === Infinity) continue;
      r.life += dt;
      const T = 0.55;
      if (r.life > T) { r.life = Infinity; r.m.visible = false; continue; }
      const k = r.life / T;
      r.m.scale.setScalar(0.5 + r.size * 11 * k);
      r.m.material.opacity = 0.7 * (1 - k);
    }
    let di = 0;
    for (const d of db) {
      if (d.life !== Infinity) {
        d.life += dt;
        if (d.life > 1.3 || d.y < 0) d.life = Infinity;
        else {
          d.x += d.vx * dt; d.z += d.vz * dt;
          d.vy -= 28 * dt; d.y += d.vy * dt;
          dummy.position.set(d.x, Math.max(0.1, d.y), d.z);
          dummy.rotation.set(d.life * 9, d.life * 7, 0);
          dummy.scale.setScalar(d.s);
          dummy.updateMatrix();
          dbMesh.setMatrixAt(di++, dummy.matrix);
        }
      }
    }
    dbMesh.count = di;
    dbMesh.instanceMatrix.needsUpdate = true;

    for (const s of smoke) {
      if (s.life === Infinity) continue;
      s.life += dt;
      if (s.life > s.T) { s.life = Infinity; s.sp.visible = false; continue; }
      const k = s.life / s.T;
      s.sp.position.y += s.vy * dt;
      s.sp.material.opacity = 0.4 * (1 - k);
      const sc = s.s * (1.5 + k * 3);
      s.sp.scale.set(sc, sc, 1);
    }
    for (const sc of scorch) {
      if (sc.life === Infinity) continue;
      sc.life += dt;
      const T = 12;
      if (sc.life > T) { sc.life = Infinity; sc.m.visible = false; continue; }
      sc.m.material.opacity = 0.5 * (1 - sc.life / T);
    }
  }

  function shiftX(dx) {
    for (const f of fireballs) if (f.life !== Infinity) f.m.position.x += dx;
    for (const r of rings) if (r.life !== Infinity) r.m.position.x += dx;
    for (const d of db) if (d.life !== Infinity) d.x += dx;
    for (const s of smoke) if (s.life !== Infinity) s.sp.position.x += dx;
    for (const sc of scorch) if (sc.life !== Infinity) sc.m.position.x += dx;
  }

  return { boom, puff, moabBoom, update, shiftX };
}
