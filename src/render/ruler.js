import * as THREE from 'three';
import { CFG } from '../sim/battle.js';

// Price axis on the ground: faint $10 tick lines, $50 numerals lying flat
// like runway markings along both field edges. Rebuilt on every rebase —
// the world doesn't move, the numbers do.
const SPAN = 210;   // world units covered each side of the base point
const MINOR = 10;   // $ per tick line
const MAJOR = 50;   // $ per numeral

export function createRuler(scene) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  let flipped = false;
  const labels = []; // numeral meshes — spun to stay readable while orbiting

  const mkLines = (prices, base, opacity) => {
    const pts = [];
    for (const p of prices) {
      const x = (p - base) * CFG.priceScale;
      pts.push(x, 0.04, -32, x, 0.04, 32);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity, depthWrite: false,
    }));
  };

  const mkLabel = (p) => {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 64;
    const ctx = cvs.getContext('2d');
    ctx.font = 'bold 44px "JetBrains Mono", Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(p.toLocaleString('en-US'), 128, 34);
    const tex = new THREE.CanvasTexture(cvs);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(11, 2.75),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.55, depthWrite: false, // bright white
      }),
    );
  };

  function rebuild(base) {
    labels.length = 0;
    for (const c of [...group.children]) {
      group.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (c.material.map) c.material.map.dispose();
        c.material.dispose();
      }
    }
    const priceSpan = SPAN / CFG.priceScale;
    const minor = [], major = [];
    const start = Math.ceil((base - priceSpan) / MINOR) * MINOR;
    for (let p = start; p <= base + priceSpan; p += MINOR) {
      (p % MAJOR === 0 ? major : minor).push(p);
    }
    group.add(mkLines(minor, base, 0.045));
    group.add(mkLines(major, base, 0.10));
    for (const p of major) {
      const x = (p - base) * CFG.priceScale;
      for (const z of [-36.5, 36.5]) {
        const m = mkLabel(p);
        m.rotation.set(-Math.PI / 2, 0, flipped ? Math.PI : 0);
        m.position.set(x, 0.05, z);
        group.add(m);
        labels.push(m);
      }
    }
    built = true;
  }

  // Keep numerals upright for the viewer: when the camera orbits to the far
  // side of the field, spin the labels 180° in-plane.
  function setFlip(f) {
    if (f === flipped) return;
    flipped = f;
    for (const m of labels) m.rotation.set(-Math.PI / 2, 0, f ? Math.PI : 0);
  }

  return { get built() { return built; }, rebuild, setFlip };
}
