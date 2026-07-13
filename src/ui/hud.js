export function createHud() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div class="feed" id="feed">
      <div class="dot" id="feed-dot"></div><span id="feed-name">CONNECTING…</span><span id="feed-arrow">▾</span>
      <div class="feed-menu" id="feed-menu">
        <div class="fitem sel" data-src="auto">AUTO</div>
        <div class="fitem" data-src="binance">BINANCE</div>
        <div class="fitem" data-src="bitstamp">BITSTAMP</div>
        <div class="fitem" data-src="coinbase">COINBASE</div>
      </div>
    </div>
    <div id="round">ROUND 1</div>
    <div class="price-wrap">
      <div id="price">—</div>
      <div class="sub">BTC/USD <span id="chg">0.00%</span></div>
    </div>
    <div class="kills" id="kills-bulls"><span class="n" id="kb">0</span>BEARS SLAIN
      <div class="pot" title="ordnance charge"><div id="pot-b"></div></div></div>
    <div class="kills" id="kills-bears"><span class="n" id="kr">0</span>BULLS SLAIN
      <div class="pot pot-right" title="ordnance charge"><div id="pot-r"></div></div></div>
    <div class="ladder" id="ladder">
      <div class="ladder-head" id="ladder-head"><span>ESCALATION LADDER</span><span id="ladder-arrow">▾</span></div>
      <div id="ladder-body">
        <div class="lrow" id="lr-infantry" style="--c:#9a9aa5">
          <svg width="24" height="16" viewBox="0 0 24 16" fill="currentColor"><rect x="3" y="4" width="4" height="10" rx="2"/><rect x="10" y="2" width="4" height="10" rx="2"/><rect x="17" y="4" width="4" height="10" rx="2"/></svg>
          <span class="ln">INFANTRY</span><span class="lt">every trade</span>
        </div>
        <div class="lrow" id="lr-grenade" style="--c:#2dd4bf">
          <svg width="24" height="16" viewBox="0 0 24 16" fill="currentColor"><circle cx="12" cy="10" r="5"/><rect x="9" y="1" width="6" height="4" rx="1"/></svg>
          <span class="ln">GRENADES</span><span class="lt">5× avg</span><span class="lk">1</span>
        </div>
        <div class="lrow" id="lr-tank" style="--c:#a78bfa">
          <svg width="24" height="16" viewBox="0 0 24 16" fill="currentColor"><rect x="1" y="9" width="15" height="5" rx="2"/><rect x="5" y="5" width="7" height="5" rx="1"/><rect x="12" y="6" width="11" height="2"/></svg>
          <span class="ln">TANK</span><span class="lt">12× avg</span><span class="lk">2</span>
        </div>
        <div class="lrow" id="lr-air" style="--c:#f5b043">
          <svg width="24" height="16" viewBox="0 0 24 16" fill="currentColor"><polygon points="23,8 3,2 9,8 3,14"/></svg>
          <span class="ln">AIRSTRIKE</span><span class="lt">whale</span><span class="lk">3</span>
        </div>
        <div class="lrow" id="lr-carpet" style="--c:#ef5340">
          <svg width="24" height="16" viewBox="0 0 24 16" fill="currentColor"><polygon points="12,4 2,1 5,4 2,7"/><polygon points="17,8 7,5 10,8 7,11"/><polygon points="12,12 2,9 5,12 2,15"/></svg>
          <span class="ln">SQUADRON</span><span class="lt">2.5× whale</span><span class="lk">4</span>
        </div>
        <div class="lrow" id="lr-moab" style="--c:#f7e04a">
          <svg width="24" height="16" viewBox="0 0 24 16" fill="currentColor"><circle cx="12" cy="11" r="4"/><rect x="11" y="1" width="2" height="5"/><rect x="5" y="9" width="3" height="2" transform="rotate(-35 6.5 10)"/><rect x="16" y="9" width="3" height="2" transform="rotate(35 17.5 10)"/></svg>
          <span class="ln">MOAB</span><span class="lt">6× whale</span><span class="lk">5</span>
        </div>
        <div class="lrow" id="lr-pot" style="--c:#c9c9d2">
          <svg width="24" height="16" viewBox="0 0 24 16" fill="currentColor"><rect x="4" y="10" width="3" height="5"/><rect x="10" y="7" width="3" height="8"/><rect x="16" y="3" width="3" height="12"/></svg>
          <span class="ln">ARTILLERY</span><span class="lt">pooled flow</span><span class="lk">6</span>
        </div>
      </div>
    </div>
    <div id="whale"></div>
    <div id="banner"></div>
    <div id="flash"></div>
    <div class="tape" id="tape">
      <div class="tape-head" id="tape-head"><span>LIVE TAPE</span><span id="tape-arrow">▾</span></div>
      <div id="tape-body"></div>
    </div>
    <div class="tug">
      <div class="tug-bar"><div id="tug-buy"></div></div>
      <div class="tug-labels"><span id="bv">BUY 0.0</span><span id="sv">SELL 0.0</span></div>
    </div>
    <button id="mute" title="toggle sound">🔇</button>
    <div class="hint">keys 1–6 fire the ladder · drag to orbit · scroll to zoom</div>`;

  const $ = (id) => document.getElementById(id);
  const el = {
    dot: $('feed-dot'), feedName: $('feed-name'), round: $('round'),
    price: $('price'), chg: $('chg'), kb: $('kb'), kr: $('kr'),
    tug: $('tug-buy'), bv: $('bv'), sv: $('sv'),
    banner: $('banner'), whale: $('whale'),
    potB: $('pot-b'), potR: $('pot-r'),
    flash: $('flash'), tapeBody: $('tape-body'),
  };
  let bannerT = 0, whaleT = 0;
  const flashT = {};

  // Ladder opens on load, auto-collapses after 10s (cancelled if the user
  // interacts with it first — they're clearly reading it).
  const ladder = document.getElementById('ladder');
  const autoCollapse = setTimeout(() => ladder.classList.add('collapsed'), 10000);
  document.getElementById('ladder-head').addEventListener('click', () => {
    clearTimeout(autoCollapse);
    ladder.classList.toggle('collapsed');
  });
  ladder.addEventListener('pointerenter', () => clearTimeout(autoCollapse), { once: true });

  // Tape: same open-then-auto-collapse behavior as the ladder
  const tape = document.getElementById('tape');
  const tapeCollapse = setTimeout(() => tape.classList.add('collapsed'), 60000);
  document.getElementById('tape-head').addEventListener('click', () => {
    clearTimeout(tapeCollapse);
    tape.classList.toggle('collapsed');
  });
  tape.addEventListener('pointerenter', () => clearTimeout(tapeCollapse), { once: true });

  const fmtPrice = (p) => p
    ? '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
  const fmtInt = (n) => n.toLocaleString('en-US');

  return {
    setFeed(name, live, sim) {
      el.feedName.textContent = name;
      el.dot.className = 'dot ' + (live ? 'live' : sim ? 'sim' : '');
    },
    update({ price, chg, buyV, sellV, kills, round, pots }) {
      if (pots) {
        el.potB.style.width = `${pots[0] * 100}%`;
        el.potR.style.width = `${pots[1] * 100}%`;
      }
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
    banner(title, cls, sub, dur = 2800) {
      el.banner.innerHTML = `${title}<span class="bsub">${sub}</span>`;
      el.banner.className = `show ${cls}`;
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { el.banner.className = cls; }, dur);
    },
    whale(text) {
      el.whale.textContent = text;
      el.whale.className = 'show';
      clearTimeout(whaleT);
      whaleT = setTimeout(() => { el.whale.className = ''; }, 3200);
    },
    // feed source picker: cb(src) called with 'auto'|'binance'|'bitstamp'|'coinbase'
    onFeedSelect(cb) {
      const feed = document.getElementById('feed');
      feed.addEventListener('click', () => feed.classList.toggle('open'));
      window.addEventListener('click', (e) => {
        if (!feed.contains(e.target)) feed.classList.remove('open');
      });
      for (const item of feed.querySelectorAll('.fitem')) {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          feed.querySelectorAll('.fitem').forEach((i) => i.classList.remove('sel'));
          item.classList.add('sel');
          feed.classList.remove('open');
          cb(item.dataset.src);
        });
      }
    },
    // pulse a ladder row when its tier fires: 'grenade'|'tank'|'air'|'carpet'|'pot'
    flashTier(tier) {
      const row = document.getElementById(`lr-${tier}`);
      if (!row) return;
      row.classList.add('fire');
      clearTimeout(flashT[tier]);
      flashT[tier] = setTimeout(() => row.classList.remove('fire'), 850);
    },
    onMute(cb) {
      const btn = document.getElementById('mute');
      btn.addEventListener('click', () => {
        const muted = cb();
        btn.textContent = muted ? '🔇' : '🔊';
      });
    },
    // high-speed trade tape: newest at the bottom, near the tug bar
    tapeTrade(side, qty, price, big) {
      const row = document.createElement('div');
      row.className = `trow ${side}${big ? ' big' : ''}`;
      const amt = qty < 1 ? qty.toFixed(3) : qty.toFixed(2);
      row.innerHTML = `<span>${side === 'buy' ? '▲' : '▼'} ${amt}</span><span>${
        price.toLocaleString('en-US', { maximumFractionDigits: 1 })}</span>`;
      el.tapeBody.appendChild(row);
      while (el.tapeBody.children.length > 26) el.tapeBody.removeChild(el.tapeBody.firstChild);
    },
    // full-screen white pulse (MOAB)
    flashScreen() {
      el.flash.style.transition = 'none';
      el.flash.style.opacity = '0.5';
      requestAnimationFrame(() => {
        el.flash.style.transition = 'opacity .6s';
        el.flash.style.opacity = '0';
      });
    },
  };
}
