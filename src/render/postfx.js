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

  // Degrade only on SUSTAINED low fps (3s continuous), after a 10s warmup —
  // startup jank (shader compile, army spawn, intro jets) must not dim the
  // war. Pixel ratio goes first; bloom (the glow) is sacrificed last.
  let fps = 60, warmup = 10, tier = 0, lowT = 0;
  return {
    render(dt) {
      if (dt > 0.0001) fps += (1 / dt - fps) * 0.04;
      if (warmup > 0) {
        warmup -= dt;
      } else {
        const threshold = tier === 0 ? 40 : 26;
        lowT = fps < threshold ? lowT + dt : 0;
        if (lowT > 3) {
          lowT = 0;
          tier++;
          if (tier === 1) renderer.setPixelRatio(1);
          else if (tier === 2) bloom.enabled = false;
        }
      }
      composer.render();
    },
  };
}
