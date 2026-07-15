import { fetchKlines } from '../market/klines.js';

// Chart overlay: real candles in the lower-left, timeframes 1D/1W/1M/1Y,
// live price tick extending the last candle. Collapsible; OPTIONS can hide.
const W = 364, H = 116;

// onData(closes) — fires after each render with the drawn series (live tick
// included), so the in-world holo chart mirrors the panel exactly.
// onTf(tf) — timeframe changed (sync the OPTIONS buttons).
// onVisibility(v) — panel showed/hid itself (sync the OPTIONS row state).
export function createChart(onData, onTf, onVisibility) {
  const el = document.createElement('div');
  el.className = 'chart-panel';
  el.innerHTML = `
    <div class="chart-head" id="chart-head">
      <span>BTC/USD</span>
      <span class="tfs">
        <button class="tf sel" data-tf="1D">1D</button>
        <button class="tf" data-tf="1W">1W</button>
        <button class="tf" data-tf="1M">1M</button>
        <button class="tf" data-tf="1Y">1Y</button>
      </span>
      <span id="chart-arrow">▾</span>
    </div>
    <div class="chart-body"><canvas id="chart-cvs"></canvas></div>`;
  document.getElementById('hud').appendChild(el);

  const cvs = el.querySelector('#chart-cvs');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cvs.width = W * dpr; cvs.height = H * dpr;
  cvs.style.width = `${W}px`; cvs.style.height = `${H}px`;
  const ctx = cvs.getContext('2d');
  ctx.scale(dpr, dpr);

  let tf = '1D', data = null, live = 0, dirty = false, loading = false;

  // auto-hide like the tape: after 30s, slide off the bottom of the screen
  // (interacting with the panel cancels the timer)
  let hideT = setTimeout(() => {
    el.classList.add('offscreen');
    if (onVisibility) onVisibility(false);
  }, 30000);
  const cancelHide = () => clearTimeout(hideT);
  el.addEventListener('pointerenter', cancelHide, { once: true });

  el.querySelector('#chart-head').addEventListener('click', () => {
    cancelHide();
    el.classList.toggle('collapsed');
  });

  function setTf(next) {
    if (next === tf) return;
    tf = next;
    el.querySelectorAll('.tf').forEach((b) => b.classList.toggle('sel', b.dataset.tf === tf));
    if (onTf) onTf(tf);
    load();
  }
  for (const btn of el.querySelectorAll('.tf')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelHide();
      setTf(btn.dataset.tf);
    });
  }

  async function load() {
    if (loading) return;
    loading = true;
    const rows = await fetchKlines(tf);
    loading = false;
    if (rows) { data = rows; draw(); }
  }

  const fmt = (p) => p >= 10000
    ? `${(p / 1000).toFixed(1)}k`
    : p.toLocaleString('en-US', { maximumFractionDigits: 0 });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (!data || !data.length) {
      ctx.fillStyle = '#63636d';
      ctx.font = '11px monospace';
      ctx.fillText('chart data unavailable', 10, H / 2);
      return;
    }
    const rows = data;
    const last = rows[rows.length - 1];
    // only trust the live tick if it's coherent with the candle data —
    // the simulator's price must not distort a real chart
    const liveOk = live && Math.abs(live - last.c) / last.c < 0.15;
    const liveC = liveOk ? live : last.c;
    if (onData) onData(rows.map((r, i) => (i === rows.length - 1 ? liveC : r.c)));
    let lo = Infinity, hi = -Infinity;
    for (const r of rows) { if (r.l < lo) lo = r.l; if (r.h > hi) hi = r.h; }
    lo = Math.min(lo, liveC); hi = Math.max(hi, liveC);
    const pad = (hi - lo) * 0.06 || 1;
    lo -= pad; hi += pad;
    const px = (p) => H - ((p - lo) / (hi - lo)) * H;
    const cw = W / rows.length;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const c = i === rows.length - 1 ? liveC : r.c; // live tick extends last
      const x = i * cw + cw / 2;
      const up = c >= r.o;
      ctx.strokeStyle = ctx.fillStyle = up ? '#2ecc71' : '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(x, px(Math.max(r.h, c)));
      ctx.lineTo(x, px(Math.min(r.l, c)));
      ctx.stroke();
      const yo = px(r.o), yc = px(c);
      ctx.fillRect(x - cw * 0.32, Math.min(yo, yc), cw * 0.64, Math.max(1, Math.abs(yc - yo)));
    }

    // live price line + labels
    ctx.strokeStyle = 'rgba(247,147,26,0.8)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, px(liveC));
    ctx.lineTo(W, px(liveC));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#f7931a';
    ctx.fillText(fmt(liveC), 4, Math.max(10, Math.min(H - 3, px(liveC) - 3)));
    ctx.fillStyle = '#63636d';
    ctx.font = '9px monospace';
    ctx.fillText(fmt(hi), W - 34, 10);
    ctx.fillText(fmt(lo), W - 34, H - 3);
  }

  load();
  setInterval(load, 60000);        // refresh active timeframe
  setInterval(() => { if (dirty) { dirty = false; draw(); } }, 1000);

  return {
    setLive(p) { live = p; dirty = true; },
    setTf,
    // slides off/on the bottom edge (transition in CSS)
    setVisible(v) {
      cancelHide();
      el.classList.toggle('offscreen', !v);
      return v;
    },
    get visible() { return !el.classList.contains('offscreen'); },
  };
}
