import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Bloom makes tracers/fireballs/emissives glow. Auto-degrades on weak GPUs:
// sustained low fps → bloom off + pixel ratio down (one-way, no flip-flop).
export function createPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.45, 0.6,
  );
  composer.addPass(bloom);
  composer.setSize(window.innerWidth, window.innerHeight);

  window.addEventListener('resize', () => {
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  let fps = 60, warmup = 4, tier = 0;
  return {
    render(dt) {
      if (dt > 0.0001) fps += (1 / dt - fps) * 0.04;
      if (warmup > 0) warmup -= dt;
      else if (tier === 0 && fps < 42) { tier = 1; bloom.enabled = false; }
      else if (tier === 1 && fps < 30) { tier = 2; renderer.setPixelRatio(1); }
      composer.render();
    },
  };
}
