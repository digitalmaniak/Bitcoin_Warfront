import * as THREE from 'three';

// Floating skulls over heavy casualties (the image1 moment).
export function createEffects(scene) {
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = 128;
  const ctx = cvs.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '104px serif';
  ctx.fillText('💀', 64, 72);
  const tex = new THREE.CanvasTexture(cvs);

  const POOL = 24;
  const sprites = [];
  for (let i = 0; i < POOL; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0,
    }));
    sp.visible = false;
    scene.add(sp);
    sprites.push({ sp, life: Infinity, size: 4 });
  }

  function spawnOne(x, z, size) {
    const s = sprites.find((e) => e.life === Infinity) ||
      sprites.reduce((a, b) => (a.life > b.life ? b : a));
    s.life = 0;
    s.size = size;
    s.sp.position.set(x + (Math.random() - 0.5) * 6, 2.5, z + (Math.random() - 0.5) * 6);
    s.sp.visible = true;
  }

  return {
    spawn(x, z, n) {
      const size = 3.5 + n * 1.1;
      for (let i = 0; i < Math.min(n, 4); i++) spawnOne(x, z, size);
    },
    shiftX(dx) {
      for (const s of sprites) if (s.life !== Infinity) s.sp.position.x += dx;
    },
    update(dt) {
      for (const s of sprites) {
        if (s.life === Infinity) continue;
        s.life += dt;
        if (s.life > 2.2) { s.life = Infinity; s.sp.visible = false; continue; }
        s.sp.position.y += dt * 3.2;
        const fade = Math.max(0, 1 - s.life / 2.2);
        s.sp.material.opacity = fade;
        const sc = s.size * (0.8 + s.life * 0.25);
        s.sp.scale.set(sc, sc, 1);
      }
    },
  };
}
