// WebAudio-synthesized battle audio — zero audio files.
// Context starts on first user gesture (browser autoplay policy).
export function createAudio() {
  let ctx = null, master = null, muted = false, lastShot = 0;

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  window.addEventListener('pointerdown', ensure);
  window.addEventListener('keydown', ensure);

  let noiseBuf = null;
  const noise = () => {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  };

  const env = (gain, v, decay) => {
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(v, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  };

  return {
    shot() {
      if (!ctx || muted) return;
      const now = performance.now();
      if (now - lastShot < 45) return; // throttle to a crackle
      lastShot = now;
      const src = noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1600 + Math.random() * 1200;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      env(g, 0.08, 0.08);
      src.connect(bp).connect(g).connect(master);
      src.start(); src.stop(ctx.currentTime + 0.1);
    },
    explosion(size = 1) {
      if (!ctx || muted) return;
      const src = noise();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, ctx.currentTime);
      lp.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.7);
      const g = ctx.createGain();
      env(g, Math.min(0.55, 0.28 * size), 0.8);
      src.connect(lp).connect(g).connect(master);
      src.start(); src.stop(ctx.currentTime + 0.9);
      // sub thump
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(64, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.4);
      const og = ctx.createGain();
      env(og, Math.min(0.5, 0.3 * size), 0.5);
      osc.connect(og).connect(master);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    },
    jet() {
      if (!ctx || muted) return;
      const src = noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(350, ctx.currentTime);
      bp.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + 0.7);
      bp.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 1.5);
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      src.connect(bp).connect(g).connect(master);
      src.start(); src.stop(t + 1.7);
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    get muted() { return muted; },
  };
}
