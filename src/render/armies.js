import * as THREE from 'three';
import { CFG } from '../sim/battle.js';

// Two InstancedMeshes — the whole war in 2 draw calls.
export function createArmies(scene, battle) {
  const geo = new THREE.CapsuleGeometry(0.32, 0.85, 3, 8);
  geo.translate(0, 0.78, 0); // feet at y=0

  const mats = [
    new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x0b3d22, roughness: 0.55 }),
    new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0x3d0f0b, roughness: 0.55 }),
  ];

  const meshes = mats.map((m) => {
    const im = new THREE.InstancedMesh(geo, m, CFG.meshCap);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    return im;
  });

  const dummy = new THREE.Object3D();

  function update() {
    const counts = [0, 0];
    for (const u of battle.units) {
      if (!u.alive) continue;
      const idx = counts[u.side];
      if (idx >= CFG.meshCap) continue;
      counts[u.side]++;

      dummy.position.set(u.x, 0, u.z);
      if (u.state === 2) { // dying: topple sideways, then sink
        const t = Math.min(1, u.deathT);
        dummy.rotation.set(0, 0, (u.side ? 1 : -1) * Math.min(1, t * 2.2) * (Math.PI / 2));
        dummy.position.y = -1.7 * Math.max(0, (t - 0.45) / 0.55);
      } else {
        dummy.rotation.set(0, 0, 0);
      }
      dummy.scale.setScalar(u.s);
      dummy.updateMatrix();
      meshes[u.side].setMatrixAt(idx, dummy.matrix);
    }
    for (let i = 0; i < 2; i++) {
      meshes[i].count = counts[i];
      meshes[i].instanceMatrix.needsUpdate = true;
    }
  }

  return { update };
}
