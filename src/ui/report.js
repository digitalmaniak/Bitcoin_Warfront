// War Report: session stats painted onto a 1200×675 canvas (X-friendly 16:9),
// shown in a modal with one-click PNG download. Pure canvas — the same
// painter drives the preview and the export.
const W = 1200, H = 675;
const MONO = '"JetBrains Mono", Menlo, Consolas, monospace';

const usd = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);
const num = (n) => n.toLocaleString('en-US');

export function createReport() {
  const el = document.createElement('div');
  el.className = 'report-overlay';
  el.innerHTML = `
    <div class="report-box">
      <canvas id="report-cvs" width="${W}" height="${H}"></canvas>
      <div class="report-btns">
        <button class="tf" id="report-dl">DOWNLOAD PNG</button>
        <button class="tf" id="report-x">CLOSE</button>
      </div>
    </div>`;
  document.getElementById('hud').appendChild(el);
  const cvs = el.querySelector('#report-cvs');
  const ctx = cvs.getContext('2d');

  el.querySelector('#report-x').addEventListener('click', () => el.classList.remove('show'));
  el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('show'); });
  el.querySelector('#report-dl').addEventListener('click', () => {
    cvs.toBlob((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `warfront-report-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });

  function text(str, x, y, size, color, align = 'left', weight = 'bold') {
    ctx.font = `${weight} ${size}px ${MONO}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  }

  function paint(s) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    // header
    text('BITCOIN WARFRONT', 44, 66, 34, '#ffffff');
    text('W A R   R E P O R T', 44, 100, 15, '#9a9aa5');
    const chg = s.open ? ((s.price / s.open) - 1) * 100 : 0;
    text(`$${s.price.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`, W - 44, 66, 40, '#ffffff', 'right');
    text(`${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}%  ·  BTC/USD`,
      W - 44, 100, 16, chg >= 0 ? '#2ecc71' : '#e74c3c', 'right');
    ctx.strokeStyle = '#222228';
    ctx.beginPath(); ctx.moveTo(44, 126); ctx.lineTo(W - 44, 126); ctx.stroke();

    // session price sparkline (center band)
    if (s.hist.length > 2) {
      let lo = Infinity, hi = -Infinity;
      for (const p of s.hist) { if (p < lo) lo = p; if (p > hi) hi = p; }
      const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
      const x0 = 380, x1 = 820, y0 = 170, y1 = 330;
      ctx.strokeStyle = chg >= 0 ? '#2ecc71' : '#e74c3c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      s.hist.forEach((p, i) => {
        const x = x0 + (x1 - x0) * (i / (s.hist.length - 1));
        const y = y1 - (y1 - y0) * ((p - lo) / (hi - lo));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.lineWidth = 1;
      text('SESSION', (x0 + x1) / 2, 355, 13, '#63636d', 'center', 'normal');
    }

    // armies
    const col = (x, align, name, color, kills, vol, liq) => {
      text(name, x, 190, 26, color, align);
      text(num(kills), x, 250, 52, color, align);
      text('ENEMIES SLAIN', x, 276, 13, '#9a9aa5', align, 'normal');
      text(`${vol.toFixed(1)} BTC`, x, 322, 26, '#e8e8e8', align);
      text('VOLUME FIRED', x, 344, 13, '#9a9aa5', align, 'normal');
      text(usd(liq), x, 390, 26, '#c084fc', align);
      text('LIQUIDATED', x, 412, 13, '#9a9aa5', align, 'normal');
    };
    col(44, 'left', 'BULLS', '#2ecc71', s.kills[0], s.buyVol, s.liqLong);
    col(W - 44, 'right', 'BEARS', '#e74c3c', s.kills[1], s.sellVol, s.liqShort);

    // battle intel rows
    const rows = [
      ['BIGGEST WHALE', s.biggestQty
        ? `${s.biggestQty.toFixed(1)} BTC ${s.biggestSide.toUpperCase()}`
        : '—'],
      ['BLOODIEST ROUND', s.bloodRound ? `#${s.bloodRound} · ${s.bloodV.toFixed(1)} BTC` : '—'],
      ['POINT OF CONTROL', s.poc ? `$${num(s.poc)}` : '—'],
      ['SESSION RANGE', s.hi ? `$${num(Math.round(s.lo))} — $${num(Math.round(s.hi))}` : '—'],
      ['LIQUIDATIONS', `${s.liqCount} · ${usd(s.liqLong + s.liqShort)} TOTAL`],
    ];
    let y = 468;
    for (const [k, v] of rows) {
      text(k, 340, y, 15, '#9a9aa5', 'left', 'normal');
      text(v, W - 340, y, 17, '#f7931a', 'right');
      y += 34;
    }

    // footer
    ctx.strokeStyle = '#222228';
    ctx.beginPath(); ctx.moveTo(44, 618); ctx.lineTo(W - 44, 618); ctx.stroke();
    const mins = Math.max(1, Math.round(s.elapsedMs / 60000));
    text(`bitcoin-warfront.vercel.app`, 44, 650, 17, '#f7931a');
    text(`live BTC/USD rendered as war · ${mins} min session · ${new Date().toUTCString().slice(5, 22)} UTC`,
      W - 44, 650, 14, '#63636d', 'right', 'normal');
  }

  return {
    open(stats) {
      paint(stats);
      el.classList.add('show');
    },
  };
}
