import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Trauma camera: shake = trauma², applied as smooth rotational noise + roll,
// with the position offset undone every frame so OrbitControls never drifts.
export function createCameraRig(camera, renderer, battle) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = 1.45;
  controls.minDistance = 30;
  controls.maxDistance = 180;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.25;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  let trauma = 0;
  const off = new THREE.Vector3();
  const noise = (f, ph, t) => Math.sin(t * f + ph) + 0.6 * Math.sin(t * f * 2.7 + ph * 3.1);

  return {
    addTrauma(v) { trauma = Math.min(1.2, trauma + v); },
    // seamless world rebase: move with everything else, no visible jump
    shiftX(dx) {
      camera.position.x += dx;
      controls.target.x += dx;
    },
    update(dt, t) {
      camera.position.sub(off); // undo last frame's shake before controls read it

      // lazy follow: ease the whole rig toward the front (~2s), preserving
      // the user's orbit angle by shifting target and camera together
      const fdx = (battle.front - controls.target.x) * Math.min(1, dt * 0.5);
      controls.target.x += fdx;
      camera.position.x += fdx;

      controls.update();

      trauma *= Math.exp(-dt * 2.2);
      const tr = Math.min(1.2, battle.shake * 0.7 + trauma);
      const s = tr * tr;

      off.set(
        noise(31, 1, t) * s * 0.5,
        noise(37, 2, t) * s * 0.35,
        noise(29, 5, t) * s * 0.5,
      );
      camera.position.add(off);
      camera.rotateZ(noise(41, 3, t) * s * 0.02);  // roll — the cinematic part
      camera.rotateX(noise(43, 7, t) * s * 0.012);
    },
    controls,
  };
}
