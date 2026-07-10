import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from '../sim/battle.js';

// Low-poly mech troopers built from merged primitives — still one
// InstancedMesh per side (2 draw calls for the whole war).
// Geometry faces +x; bulls yaw 0, bears yaw π, so guns point at the enemy.
function buildMechGeo() {
  const parts = [];
  const box = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    parts.push(g);
  };
  box(0.22, 0.55, 0.22, 0, 0.28, -0.18);  // leg L
  box(0.22, 0.55, 0.22, 0, 0.28, 0.18);   // leg R
  box(0.45, 0.55, 0.62, 0, 0.83, 0);      // torso
  box(0.3, 0.24, 0.3, 0, 1.24, 0);        // head
  box(0.8, 0.15, 0.15, 0.42, 0.95, 0.28); // gun arm (points +x)
  box(0.16, 0.42, 0.16, 0, 0.85, -0.36);  // off arm
  return mergeGeometries(parts);
}

export function createArmies(scene, battle) {
  const geo = buildMechGeo();
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

  function update(t) {
    const counts = [0, 0];
    for (const u of battle.units) {
      if (!u.alive) continue;
      const idx = counts[u.side];
      if (idx >= CFG.meshCap) continue;
      counts[u.side]++;

      const yaw = u.side === 0 ? 0 : Math.PI;
      dummy.position.set(u.x, 0, u.z);

      if (u.state === 2) { // dying: topple, then sink
        const k = Math.min(1, u.deathT);
        dummy.rotation.set(0, yaw, (u.side ? 1 : -1) * Math.min(1, k * 2.2) * (Math.PI / 2));
        dummy.position.y = -1.7 * Math.max(0, (k - 0.45) / 0.55);
      } else if (u.state === 0) { // marching: walk wobble + bob
        const ph = t * 10 + u.i * 1.7;
        dummy.rotation.set(0, yaw, Math.sin(ph) * 0.12);
        dummy.position.y = Math.abs(Math.sin(ph)) * 0.07;
      } else { // fighting: subtle aim jitter
        dummy.rotation.set(0, yaw + Math.sin(t * 3 + u.i) * 0.08, 0);
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
