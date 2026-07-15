import * as THREE from 'three';

// Holographic price chart floating above the frontline rod: time runs along
// the rod's length (z), price runs vertically (y), in the rod's own plane
// (x = front, follows it every frame). Shows the same series/timeframe as
// the 2D chart panel. Mirrors by viewer side so time always flows left→right.
const Z0 = -32, Z1 = 32;   // spans the rod
const Y0 = 3.4, Y1 = 15;   // altitude band above the curtain
const MAX = 400;

export function createHoloChart(scene) {
  const group = new THREE.Group();
  scene.add(group);
  group.visible = false;

  // the price line (overdriven orange so bloom halos it)
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(MAX * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setDrawRange(0, 0);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
    transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  line.material.color.setRGB(1.5, 0.95, 0.28);
  line.frustumCulled = false;
  group.add(line);

  // faint area fill down to the base — a glowing mountain silhouette
  const areaGeo = new THREE.BufferGeometry();
  const areaPos = new Float32Array(MAX * 2 * 3);
  const idx = new Uint16Array((MAX - 1) * 6);
  for (let i = 0; i < MAX - 1; i++) {
    const a = i * 2;
    idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
  }
  areaGeo.setAttribute('position', new THREE.BufferAttribute(areaPos, 3));
  areaGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  areaGeo.setDrawRange(0, 0);
  const area = new THREE.Mesh(areaGeo, new THREE.MeshBasicMaterial({
    color: 0xf7931a, transparent: true, opacity: 0.07,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  area.frustumCulled = false;
  group.add(area);

  return {
    // closes: ascending array of close prices (last = live tick)
    setData(closes) {
      if (!closes || closes.length < 2) { group.visible = false; return; }
      group.visible = true;
      const n = Math.min(closes.length, MAX);
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) {
        if (closes[i] < lo) lo = closes[i];
        if (closes[i] > hi) hi = closes[i];
      }
      const pad = (hi - lo) * 0.05 || 1;
      lo -= pad; hi += pad;
      for (let i = 0; i < n; i++) {
        const z = Z0 + (Z1 - Z0) * (i / (n - 1));
        const y = Y0 + (Y1 - Y0) * ((closes[i] - lo) / (hi - lo));
        linePos[i * 3] = 0; linePos[i * 3 + 1] = y; linePos[i * 3 + 2] = z;
        const a = i * 6;
        areaPos[a] = 0; areaPos[a + 1] = y; areaPos[a + 2] = z;
        areaPos[a + 3] = 0; areaPos[a + 4] = Y0; areaPos[a + 5] = z;
      }
      lineGeo.setDrawRange(0, n);
      areaGeo.setDrawRange(0, (n - 1) * 6);
      lineGeo.attributes.position.needsUpdate = true;
      areaGeo.attributes.position.needsUpdate = true;
    },
    // follow the rod; mirror so time reads left→right from either army
    update(front, viewerBehindFront) {
      group.position.x = front;
      group.scale.z = viewerBehindFront ? -1 : 1;
    },
    setVisible(v) { group.visible = v && lineGeo.drawRange.count > 1; },
  };
}
