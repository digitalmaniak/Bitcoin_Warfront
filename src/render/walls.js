import * as THREE from 'three';
import { CFG } from '../sim/battle.js';

// Order-book depth as translucent ramparts. Heights lerp toward sim targets
// so walls visibly grow, get eaten, and vanish when pulled.
export function createWalls(scene, battle) {
  const geo = new THREE.BoxGeometry(1, 1, CFG.fieldZ * 2 * 0.95);
  geo.translate(0, 0.5, 0); // grow upward from the ground; width via scale.x

  const mk = (color, emissive) => {
    const im = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({
        color, emissive, transparent: true, opacity: 0.30,
        roughness: 0.4, depthWrite: false,
      }),
      CFG.wallCap,
    );
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    return im;
  };

  const meshes = { bid: mk(0x1f9d55, 0x0a3d1f), ask: mk(0xe74c3c, 0x3d0f0b) };
  const cur = { bid: new Float32Array(CFG.wallCap), ask: new Float32Array(CFG.wallCap) };
  const dummy = new THREE.Object3D();

  function update(dt) {
    const k = Math.min(1, dt * 6);
    for (const side of ['bid', 'ask']) {
      const arr = battle.walls[side];
      const im = meshes[side];
      const heights = cur[side];
      for (let i = 0; i < CFG.wallCap; i++) {
        const w = arr[i];
        const target = w ? w.h : 0;
        heights[i] += (target - heights[i]) * k;
        if (w && heights[i] > 0.05) {
          dummy.position.set(w.x, 0, 0);
          dummy.scale.set(w.w || 3.2, heights[i], 1);
        } else {
          dummy.position.set(0, -5, 0);
          dummy.scale.set(0.001, 0.001, 0.001);
        }
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }

  return { update };
}
