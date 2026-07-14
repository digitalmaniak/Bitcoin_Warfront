import * as THREE from 'three';

export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);
  scene.fog = new THREE.Fog(0x0a0a0f, 100, 220);

  const camera = new THREE.PerspectiveCamera(
    52, window.innerWidth / window.innerHeight, 0.1, 500,
  );
  camera.position.set(0, 48, 88);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0x8899bb, 0x0c0c10, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(30, 60, 20);
  scene.add(dir);

  // day/night: b = 0 (deep night) .. 1 (full day); tints lights + fog + sky
  const nightC = new THREE.Color(0x050509);
  const dayC = new THREE.Color(0x10101a);
  const envC = new THREE.Color();
  function setDayNight(b) {
    hemi.intensity = 0.42 + 0.55 * b;
    dir.intensity = 0.5 + 0.68 * b;
    envC.lerpColors(nightC, dayC, b);
    scene.background.copy(envC);
    scene.fog.color.copy(envC);
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 170),
    new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(440, 88, 0x26262e, 0x1b1b22);
  grid.position.y = 0.02;
  scene.add(grid);

  // territory tint planes (shift with the frontline)
  const mkTint = (color) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 130),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.06, depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    scene.add(m);
    return m;
  };
  const bullTint = mkTint(0x1f9d55);
  const bearTint = mkTint(0xe74c3c);

  // frontline curtain
  const frontLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 3.2, 64),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false,
    }),
  );
  frontLine.position.y = 1.6;
  scene.add(frontLine);

  function setFront(front) {
    frontLine.position.x = front;
    const EDGE = 220;
    bullTint.scale.x = Math.max(0.01, front + EDGE);
    bullTint.position.x = (front - EDGE) / 2;
    bearTint.scale.x = Math.max(0.01, EDGE - front);
    bearTint.position.x = (front + EDGE) / 2;
  }
  setFront(0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, setFront, setDayNight };
}
