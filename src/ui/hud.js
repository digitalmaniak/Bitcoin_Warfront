export function createHud() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div class="feed"><div class="dot" id="feed-dot"></div><span id="feed-name">CONNECTING…</span></div>
    <div id="round">ROUND 1</div>
    <div class="price-wrap">
      <div id="price">—</div>
      <div class="sub">BTC/USD <span id="chg">0.00%</span></div>
    </div>
    <div class="kills" id="kills-bulls"><span class="n" id="kb">0</span>BEARS SLAIN</div>
    <div class="kills" id="kills-bears"><span class="n" id="kr">0</span>BULLS SLAIN</div>
    <div id="whale"></div>
    <div id="banner"></div>
    <div class="tug">
      <div class="tug-bar"><div id="tug-buy"></div></div>
      <div class="tug-labels"><span id="bv">BUY 0.0</span><span id="sv">SELL 0.0</span></div>
    </div>
    <button id="mute" title="toggle sound">🔊</button>
    <div class="hint">1 whale buy · 2 whale sell · 3 cascade · drag to orbit · ?feed=fake</div>`;

  const $ = (id) => document.getElementById(id);
  const el = {
    dot: $('feed-dot'), feedName: $('feed-name'), round: $('round'),
    price: $('price'), chg: $('chg'), kb: $('kb'), kr: $('kr'),
    tug: $('tug-buy'), bv: $('bv'), sv: $('sv'),
    banner: $('banner'), whale: $('whale'),
  };
  let bannerT = 0, whaleT = 0;

  const fmtPrice = (p) => p
    ? '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
  const fmtInt = (n) => n.toLocaleString('en-US');

  return {
    setFeed(name, live) {
      el.feedName.textContent = name;
      el.dot.className = 'dot ' + (live ? 'live' : name.startsWith('SIMULATED') ? 'sim' : '');
    },
    update({ price, chg, buyV, sellV, kills, round }) {
      el.price.textContent = fmtPrice(price);
      const up = chg >= 0;
      el.chg.textContent = `${up ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}%`;
      el.chg.className = up ? 'up' : 'down';
      el.kb.textContent = fmtInt(kills[0]);
      el.kr.textContent = fmtInt(kills[1]);
      el.round.textContent = `ROUND ${round}`;
      const total = buyV + sellV;
      el.tug.style.width = `${total > 0 ? (buyV / total) * 100 : 50}%`;
      el.bv.textContent = `BUY ${buyV.toFixed(1)}`;
      el.sv.textContent = `SELL ${sellV.toFixed(1)}`;
    },
    banner(title, cls, sub) {
      el.banner.innerHTML = `${title}<span class="bsub">${sub}</span>`;
      el.banner.className = `show ${cls}`;
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { el.banner.className = cls; }, 2800);
    },
    whale(text) {
      el.whale.textContent = text;
      el.whale.className = 'show';
      clearTimeout(whaleT);
      whaleT = setTimeout(() => { el.whale.className = ''; }, 3200);
    },
    onMute(cb) {
      const btn = document.getElementById('mute');
      btn.addEventListener('click', () => {
        const muted = cb();
        btn.textContent = muted ? '🔇' : '🔊';
      });
    },
  };
}
