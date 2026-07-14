// WebAudio-synthesized battle audio — zero audio files.
// Context starts on first user gesture (browser autoplay policy).
export function createAudio() {
  let ctx = null, master = null, muted = true, lastShot = 0;
  let listener = null; // () => world x the camera is watching

  // positional output: stereo pan + distance attenuation from world x
  const out = (x) => {
    const pan = ctx.createStereoPanner();
    let att = 1;
    if (x !== undefined && listener) {
      const dx = x - listener();
      pan.pan.value = Math.max(-0.9, Math.min(0.9, dx / 55));
      att = 1 / (1 + Math.abs(dx) / 90);
    }
    pan.connect(master);
    return { pan, att };
  }; // muted by default

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
    setListener(fn) { listener = fn; },
    shot(x) {
      if (!ctx || muted) return;
      const now = performance.now();
      if (now - lastShot < 45) return; // throttle to a crackle
      lastShot = now;
      const o = out(x);
      const src = noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1600 + Math.random() * 1200;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      env(g, 0.08 * o.att, 0.08);
      src.connect(bp).connect(g).connect(o.pan);
      src.start(); src.stop(ctx.currentTime + 0.1);
    },
    explosion(size = 1, x) {
      if (!ctx || muted) return;
      const o = out(x);
      const src = noise();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, ctx.currentTime);
      lp.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.7);
      const g = ctx.createGain();
      env(g, Math.min(0.55, 0.28 * size) * o.att, 0.8);
      src.connect(lp).connect(g).connect(o.pan);
      src.start(); src.stop(ctx.currentTime + 0.9);
      // sub thump
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(64, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.4);
      const og = ctx.createGain();
      env(og, Math.min(0.5, 0.3 * size) * o.att, 0.5);
      osc.connect(og).connect(o.pan);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    },
    jet(x) {
      if (!ctx || muted) return;
      const o = out(x);
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
      g.gain.exponentialRampToValueAtTime(0.14 * o.att, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      src.connect(bp).connect(g).connect(o.pan);
      src.start(); src.stop(t + 1.7);
    },
    heli(x) {
      if (!ctx || muted) return;
      const o = out(x);
      const src = noise();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 240;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11 * o.att, t + 0.4);
      g.gain.setValueAtTime(0.11 * o.att, t + 2.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      // rotor whomp: LFO chops the gain
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 11;
      const depth = ctx.createGain();
      depth.gain.value = 0.06 * o.att;
      lfo.connect(depth).connect(g.gain);
      src.connect(lp).connect(g).connect(o.pan);
      src.start(); src.stop(t + 2.9);
      lfo.start(); lfo.stop(t + 2.9);
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    get muted() { return muted; },
  };
}
