import * as THREE from 'three';
import { CFG } from '../sim/battle.js';

// Session volume profile as terrain: every trade deposits volume into its
// $10 price bucket, building a translucent ridge along the back edge of the
// field. Heavily-fought prices literally build mountains. The tallest bucket
// — the point of control — glows Bitcoin orange with a POC flag.
// Bars sit at TRUE prices: x = front + (bucket - price) * scale each frame,
// so the ridge rides the tween and survives rebases for free.
const BUCKET = 10;
const S = CFG.priceScale;
const CAP = 96;          // max bars rendered (± visible range)
const Z = -43;           // behind the far ruler labels
const DEPTH = 8;
const H_MAX = 10;
const RANGE = 84;

export function createProfile(scene) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), CAP);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // POC flag
  const cvs = document.createElement('canvas');
  cvs.width = 128; cvs.height = 48;
  const ctx = cvs.getContext('2d');
  ctx.font = 'bold 30px "JetBrains Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffb84d';
  ctx.fillText('POC', 64, 26);
  const pocLabel = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cvs), transparent: true, opacity: 0.9, depthWrite: false,
  }));
  pocLabel.scale.set(5.2, 1.95, 1);
  pocLabel.visible = false;
  scene.add(pocLabel);

  const vols = new Map(); // bucketPrice → BTC volume
  let maxV = 0, poc = 0;
  const dummy = new THREE.Object3D();

  return {
    add(price, qty) {
      const b = Math.round(price / BUCKET) * BUCKET;
      const v = (vols.get(b) || 0) + qty;
      vols.set(b, v);
      if (v > maxV) { maxV = v; poc = b; }
    },
    reset() {
      vols.clear();
      maxV = 0; poc = 0;
      mesh.count = 0;
      pocLabel.visible = false;
    },
    update(front, price) {
      if (!price || !maxV) { mesh.count = 0; pocLabel.visible = false; return; }
      let n = 0;
      for (const [b, v] of vols) {
        if (n >= CAP) break;
        const x = front + (b - price) * S;
        if (Math.abs(x - front) > RANGE) continue;
        const h = 0.25 + (H_MAX - 0.25) * Math.sqrt(v / maxV);
        dummy.position.set(x, 0, Z);
        dummy.scale.set(BUCKET * S * 0.9, h, DEPTH);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        if (b === poc) {
          mesh.setColorAt(n, new THREE.Color(1.7, 0.95, 0.2)); // overdriven: bloom
          pocLabel.visible = true;
          pocLabel.position.set(x, h + 1.6, Z);
        } else {
          mesh.setColorAt(n, new THREE.Color(0.55, 0.52, 0.46));
        }
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      if (Math.abs(pocLabel.position.x - front) > RANGE) pocLabel.visible = false;
    },
  };
}
