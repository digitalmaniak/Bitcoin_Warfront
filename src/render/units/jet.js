import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function buildJetGeo() {
  const parts = [];
  const body = new THREE.BoxGeometry(3.4, 0.42, 0.6);
  parts.push(body);
  const nose = new THREE.ConeGeometry(0.28, 1.1, 6);
  nose.rotateZ(-Math.PI / 2);
  nose.translate(2.2, 0, 0);
  parts.push(nose);
  const wing = new THREE.BoxGeometry(1.6, 0.08, 3.2);
  wing.translate(-0.4, 0, 0);
  parts.push(wing);
  const tail = new THREE.BoxGeometry(0.55, 0.85, 0.08);
  tail.translate(-1.5, 0.45, 0);
  parts.push(tail);
  return mergeGeometries(parts);
}

// Whale tier: jet flyby releases a guided missile at the enemy edge.
// Carpet tier: 3-jet squadron drops ballistic bombs along the line.
// onImpact(x, z, side, kills, size) — main wires boom/kills/audio/tanks.
export function createJets(scene, battle, onImpact, explosions) {
  const geo = buildJetGeo();
  const mats = [
    new THREE.MeshStandardMaterial({ color: 0x35d07a, emissive: 0x0b3d22, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0xf05a45, emissive: 0x3d0f0b, roughness: 0.5 }),
  ];
  const jets = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(geo, mats[0]);
    m.scale.setScalar(2);
    m.visible = false; scene.add(m);
    jets.push({
      m, active: false, side: 0, x: 0, z: 0, y: 24,
      released: false, bombs: 0, bombT: 0, kills: 0, trailT: 0,
    });
  }

  const msGeo = new THREE.ConeGeometry(0.16, 1.1, 6);
  const msMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
  const missiles = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(msGeo, msMat);
    m.visible = false; scene.add(m);
    missiles.push({
      m, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      ballistic: false, side: 0, kills: 0, size: 2, trailT: 0,
    });
  }

  const queue = []; // delayed spawns {t, fn}
  const rnd = (a, b) => a + Math.random() * (b - a);

  function spawnJet(side, kills, o = {}) {
    const j = jets.find((x) => !x.active);
    if (!j) return;
    const vdir = side === 0 ? 1 : -1; // bulls fly left→right
    j.active = true; j.side = side;
    j.m.material = mats[side];
    j.x = -vdir * 150;
    j.z = rnd(-16, 16) + (o.zoff || 0);
    j.y = o.y || 24;
    j.speed = o.speed || 95;
    j.small = !!o.small;
    j.moab = !!o.moab;
    j.released = !!o.dry; // dry pass: never releases ordnance
    j.bombs = o.bombs || 0;
    j.bombT = 0;
    j.kills = kills;
    j.trailT = 0;
    j.m.rotation.set(0, side === 0 ? 0 : Math.PI, 0);
    j.m.visible = true;
  }

  function fireMissile(j) {
    const ms = missiles.find((x) => !x.active);
    if (!ms) return;
    const vdir = j.side === 0 ? 1 : -1;
    const ix = battle.front + vdir * rnd(2, 8);
    const iz = j.z + rnd(-2, 2);
    const T = 0.55;
    ms.active = true; ms.ballistic = false; ms.moabSlow = false;
    ms.side = j.side; ms.kills = j.kills; ms.size = 2.1;
    ms.x = j.x; ms.y = j.y; ms.z = j.z;
    ms.vx = (ix - j.x) / T; ms.vy = (0 - j.y) / T; ms.vz = (iz - j.z) / T;
    ms.trailT = 0;
    ms.m.scale.setScalar(1);
    ms.m.visible = true;
  }

  function dropMoab(j) {
    const ms = missiles.find((x) => !x.active);
    if (!ms) return;
    const vdir = j.side === 0 ? 1 : -1;
    ms.active = true; ms.ballistic = true; ms.moabSlow = true;
    ms.side = j.side; ms.kills = j.kills; ms.size = 4.6;
    ms.x = j.x; ms.y = j.y - 1.5; ms.z = j.z;
    ms.vx = vdir * 22; ms.vy = -2; ms.vz = 0;
    ms.trailT = 0;
    ms.m.scale.setScalar(2.5);
    ms.m.visible = true;
  }

  function dropBomb(j) {
    const ms = missiles.find((x) => !x.active);
    if (!ms) return;
    const vdir = j.side === 0 ? 1 : -1;
    ms.active = true; ms.ballistic = true; ms.moabSlow = false;
    ms.side = j.side;
    ms.kills = j.small ? 2 : Math.max(3, Math.ceil(j.kills / 2));
    ms.size = j.small ? 1.2 : 2.3;
    ms.m.scale.setScalar(1);
    ms.x = j.x; ms.y = j.y - 1; ms.z = j.z;
    ms.vx = vdir * 40; ms.vy = -6; ms.vz = 0;
    ms.trailT = 0;
    ms.m.visible = true;
  }

  return {
    strike(side, kills) { spawnJet(side, kills, {}); },
    shiftX(dx) {
      for (const j of jets) if (j.active) j.x += dx;
      for (const ms of missiles) if (ms.active) ms.x += dx;
    },
    // dry flyover — pure theater, no ordnance (intro animation)
    flyover(side, zoff = 0) { spawnJet(side, 0, { dry: true, zoff, y: 17, speed: 115 }); },
    // strafing run — artillery-budget spender, 3 small bombs
    strafe(side) { spawnJet(side, 2, { bombs: 3, y: 15, small: true, speed: 105 }); },
    // the apex event: high-altitude bomber, one massive slow bomb
    moab(side, kills) { spawnJet(side, kills, { moab: true, y: 32, speed: 78 }); },
    carpet(side, kills) {
      for (let k = 0; k < 3; k++) {
        queue.push({
          t: k * 0.3,
          fn: () => spawnJet(side, Math.ceil(kills / 3), { bombs: 2, zoff: (k - 1) * 9 }),
        });
      }
    },
    update(dt) {
      for (let i = queue.length - 1; i >= 0; i--) {
        queue[i].t -= dt;
        if (queue[i].t <= 0) { queue[i].fn(); queue.splice(i, 1); }
      }
      const f = battle.front;
      for (const j of jets) {
        if (!j.active) continue;
        const vdir = j.side === 0 ? 1 : -1;
        j.x += vdir * j.speed * dt;
        j.m.position.set(j.x, j.y, j.z);
        j.m.rotation.x = Math.sin(j.x * 0.05) * 0.15; // gentle bank
        j.trailT += dt;
        if (j.trailT > 0.08) { j.trailT = 0; explosions.puff(j.x - vdir * 2, j.y, j.z, 0.5); }

        if (j.bombs > 0) {
          if (Math.abs(j.x - f) < 20) {
            j.bombT -= dt;
            if (j.bombT <= 0) { j.bombT = 0.14; j.bombs--; dropBomb(j); }
          }
        } else if (j.moab && !j.released && Math.abs(j.x - f) < 8) {
          j.released = true;
          dropMoab(j);
        } else if (!j.moab && !j.released && vdir * (j.x - (f - vdir * 25)) >= 0) {
          j.released = true;
          fireMissile(j);
        }
        if (Math.abs(j.x) > 160) { j.active = false; j.m.visible = false; }
      }
      for (const ms of missiles) {
        if (!ms.active) continue;
        if (ms.ballistic) ms.vy -= (ms.moabSlow ? 26 : 55) * dt;
        ms.x += ms.vx * dt; ms.y += ms.vy * dt; ms.z += ms.vz * dt;
        ms.m.position.set(ms.x, ms.y, ms.z);
        ms.m.lookAt(ms.x + ms.vx, ms.y + ms.vy, ms.z + ms.vz);
        ms.m.rotateX(Math.PI / 2); // cone tip forward
        ms.trailT += dt;
        if (ms.trailT > 0.05) { ms.trailT = 0; explosions.puff(ms.x, ms.y, ms.z, 0.4); }
        if (ms.y <= 0.5) {
          ms.active = false; ms.m.visible = false;
          onImpact(ms.x, ms.z, ms.side, ms.kills, ms.size);
        }
      }
    },
  };
}
