import * as THREE from 'three';
import { CFG } from '../sim/battle.js';

// Market structure drawn onto the battlefield at true prices:
//   VWAP  — session volume-weighted average price (cyan)
//   OPEN  — session open (pale)
//   HIGH/LOW — session extremes (green/red, dim)
//   bid/ask — best book prices flanking the rod: the gap IS the spread
// Positions derive from (value - price) * scale + front each frame, so they
// ride the tween and survive rebases with zero extra bookkeeping.
const S = CFG.priceScale;
const RANGE = 78; // hide markers beyond the visible field

function mkLine(scene, color, r, opacity) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 64, 10),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  m.rotation.x = Math.PI / 2; // lie along z, like the rod
  m.position.y = r;
  m.visible = false;
  scene.add(m);
  return m;
}

function mkLabel(scene, text, color) {
  const cvs = document.createElement('canvas');
  cvs.width = 160; cvs.height = 48;
  const ctx = cvs.getContext('2d');
  ctx.font = 'bold 30px "JetBrains Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 80, 26);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cvs), transparent: true,
    opacity: 0.85, depthWrite: false,
  }));
  sp.scale.set(6.6, 2, 1);
  sp.visible = false;
  scene.add(sp);
  return sp;
}

export function createMarkers(scene) {
  // kept minimal on purpose: HIGH/LOW flags plus the unlabeled spread lines
  // (when hi/lo are beyond the field, the HUD shows screen-edge chips)
  const M = {
    hi: { line: mkLine(scene, 0x2ecc71, 0.08, 0.28), label: mkLabel(scene, 'HIGH', '#5fe89e') },
    lo: { line: mkLine(scene, 0xe74c3c, 0.08, 0.28), label: mkLabel(scene, 'LOW', '#ff8a75') },
    bid: { line: mkLine(scene, 0x2ecc71, 0.07, 0.5) },  // best bid — no label,
    ask: { line: mkLine(scene, 0xe74c3c, 0.07, 0.5) },  // the gap speaks for itself
  };

  function place(key, value, s) {
    const m = M[key];
    if (!value || !Number.isFinite(value) || !s.price) {
      m.line.visible = false;
      if (m.label) m.label.visible = false;
      return;
    }
    const x = s.front + (value - s.price) * S;
    const on = Math.abs(x - s.front) <= RANGE;
    m.line.visible = on;
    m.line.position.x = x;
    if (m.label) {
      m.label.visible = on;
      m.label.position.set(x, 2.7, 33.5);
    }
  }

  return {
    // s = {front, price, hi, lo, bid, ask}
    update(s) {
      place('hi', s.hi, s);
      place('lo', s.lo, s);
      place('bid', s.bid, s);
      place('ask', s.ask, s);
    },
  };
}
