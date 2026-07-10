import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

  function update() {
    controls.update();
    const s = battle.shake;
    if (s > 0.02) {
      camera.position.x += (Math.random() - 0.5) * s * 0.9;
      camera.position.y += (Math.random() - 0.5) * s * 0.45;
    }
  }

  return { update, controls };
}
