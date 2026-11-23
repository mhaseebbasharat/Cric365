// 3D celebration scenes (three.js): stadium, pitch, stumps, bowler, side-on batter, fielders, umpire, crowd, fireworks, TV-style cameras.
// Scenes: four, six, wicket (stumps), catch (caught out), runout, milestone, win.
// Loaded lazily, only when a 4, 6, wicket, milestone (50/100/150/200) or win happens.
// Throws if WebGL is unavailable (the caller then uses the 2D version).
import * as THREE from 'three';
import { loadCharacter, createActor } from './actors.js';

// Called early so the character model is downloaded before the first celebration.
export const preload = () => loadCharacter();

const rnd = (a, b) => a + Math.random() * (b - a);
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
// Smooth value between keyframes: keys = [[time, value], ...]
const track = (t, keys) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0)); }
  return keys[keys.length - 1][1];
};
const matCache = new Map();
const std = (c, rough = 0.82, extra = {}) => { const k = `${c}|${rough}|${JSON.stringify(extra)}`; if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, ...extra })); return matCache.get(k); };

// ---------- a person with smooth limbs, shoulders, neck, face, hair, helmet, pads ----------
function makePerson({ shirt = 0xffffff, pants = 0x1d2433, skin = 0xd7a177, hair = 0x15110e, helmet = null, hat = false, pads = false, bat = false, trim = 0xffffff } = {}) {
  const root = new THREE.Group();
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; };
  const shirtM = std(shirt), skinM = std(skin, 0.7), pantsM = std(pants), white = std(0xf4f4f0, 0.6);
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.1, 0.94, 0);
    add(p, new THREE.CapsuleGeometry(0.085, 0.62, 4, 10), pads ? white : pantsM, 0, -0.42, 0);
    if (pads) add(p, new THREE.BoxGeometry(0.17, 0.4, 0.06), white, 0, -0.5, 0.09);
    add(p, new THREE.SphereGeometry(0.1, 10, 8), std(0xf8f8f8, 0.5), 0, -0.9, 0.06, 1, 0.55, 1.9);
    root.add(p); return p;
  });
  const upper = new THREE.Group(); upper.position.y = 0.94; root.add(upper);
  add(upper, new THREE.CapsuleGeometry(0.2, 0.3, 6, 14), shirtM, 0, 0.36, 0, 1.12, 1, 0.66);
  add(upper, new THREE.CylinderGeometry(0.2, 0.2, 0.16, 14), pantsM, 0, 0.02, 0, 1, 1, 0.68);
  add(upper, new THREE.BoxGeometry(0.4, 0.045, 0.2), std(trim, 0.6), 0, 0.5, 0.02); // chest stripe in the kit trim colour
  add(upper, new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), skinM, 0, 0.72, 0);
  const head = new THREE.Group(); head.position.y = 0.76; upper.add(head);
  add(head, new THREE.SphereGeometry(0.125, 18, 14), skinM, 0, 0.14, 0, 1, 1.12, 1.02);
  [-1, 1].forEach((s) => add(head, new THREE.SphereGeometry(0.014, 6, 6), std(0x111111, 0.4), s * 0.045, 0.16, 0.118));
  add(head, new THREE.SphereGeometry(0.02, 6, 6), skinM, 0, 0.13, 0.13);
  let helmetG = null;
  if (hat) {
    add(head, new THREE.CylinderGeometry(0.24, 0.24, 0.015, 24), white, 0, 0.27, 0);
    add(head, new THREE.CylinderGeometry(0.13, 0.15, 0.1, 20), white, 0, 0.32, 0);
  } else {
    add(head, new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), std(hair, 0.9), 0, 0.17, -0.005, 1, 1.05, 1.05);
    if (helmet != null) {
      helmetG = new THREE.Group(); head.add(helmetG);
      add(helmetG, new THREE.SphereGeometry(0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), std(helmet, 0.45), 0, 0.17, 0, 1, 1.05, 1.08);
      add(helmetG, new THREE.BoxGeometry(0.2, 0.025, 0.07), std(helmet, 0.45), 0, 0.2, 0.15); // peak
      [0.06, 0.1, 0.14].forEach((y) => add(helmetG, new THREE.BoxGeometry(0.2, 0.012, 0.012), std(0x2a2a2a, 0.4), 0, y, 0.145)); // face guard bars
    }
  }
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group(); a.position.set(s * 0.3, 0.62, 0); a.rotation.order = 'YXZ';
    add(a, new THREE.SphereGeometry(0.075, 10, 8), shirtM);
    add(a, new THREE.CapsuleGeometry(0.058, 0.2, 4, 8), shirtM, 0, -0.17, 0);
    add(a, new THREE.CapsuleGeometry(0.048, 0.2, 4, 8), skinM, 0, -0.41, 0);
    add(a, new THREE.SphereGeometry(0.052, 8, 8), skinM, 0, -0.58, 0);
    upper.add(a); return a;
  });
  let batG = null;
  if (bat) {
    batG = new THREE.Group(); batG.position.set(0.1, 0.3, 0.3); upper.add(batG);
    add(batG, new THREE.CylinderGeometry(0.022, 0.022, 0.32, 8), std(0x2a2a2a, 0.5), 0, -0.04, 0);
    add(batG, new THREE.BoxGeometry(0.05, 0.62, 0.115), std(0xe8d29a, 0.55), 0, -0.5, 0);   // flat face towards the line of the swing
    add(batG, new THREE.BoxGeometry(0.052, 0.04, 0.117), std(0x16120e, 0.6), 0, -0.84, 0);
  }
  return { root, legs, upper, head, arms, bat: batG, helmetG };
}

function makeStumps(z) {
  const g = new THREE.Group(); g.position.z = z;
  const stumps = [-0.12, 0, 0.12].map((x) => {
    const s = new THREE.Group(); s.position.x = x;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 10), std(0xf1e6c8, 0.5)); m.position.y = 0.36; m.castShadow = true; s.add(m);
    g.add(s); return s;
  });
  const bails = [-0.06, 0.06].map((x) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.11, 8), std(0xc8a45a, 0.4)); b.rotation.z = Math.PI / 2; b.position.set(x, 0.735, 0); g.add(b);
    return { mesh: b, vel: new THREE.Vector3(), spin: 0, flying: false };
  });
  return { group: g, stumps, bails };
}

const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };

function buildStadium(scene) {
  // a floodlit evening match: deep blue sky with stars, bright pitch
  scene.background = canvasTex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#040a1c'); g.addColorStop(0.5, '#10224a'); g.addColorStop(0.85, '#2c3a7a'); g.addColorStop(1, '#8a5a8c'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`; const r = Math.random() * 1.4 + 0.4; x.fillRect(Math.random() * w, Math.random() * h * 0.7, r, r); }
  });
  scene.fog = new THREE.Fog(0x1b2750, 130, 330);
  scene.add(new THREE.HemisphereLight(0xb9ccff, 0x27402a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff3dc, 3.6); sun.position.set(-18, 32, 24); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 100 }); sun.shadow.bias = -0.0004; sun.shadow.radius = 3; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7fa8ff, 1.3); rim.position.set(20, 12, -30); scene.add(rim);

  const grass = canvasTex(512, 512, (x, w, h) => {
    for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? '#2c8443' : '#379650'; x.fillRect((i * w) / 10, 0, w / 10, h); }
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '10,60,20' : '120,200,110'},${Math.random() * 0.12})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(66, 80), std(0xffffff, 0.95, { map: grass })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const outer = new THREE.Mesh(new THREE.CircleGeometry(400, 32), std(0x244d2e, 1)); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; scene.add(outer);
  const dirt = canvasTex(64, 512, (x, w, h) => { x.fillStyle = '#cbb68a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(110,85,50,${Math.random() * 0.2})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } });
  const pitch = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.03, 20.12), std(0xffffff, 0.95, { map: dirt })); pitch.position.y = 0.02; pitch.receiveShadow = true; scene.add(pitch);
  const line = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d), std(0xffffff, 0.6)); m.position.set(x, 0.045, z); scene.add(m); };
  [-1, 1].forEach((s) => { line(2.7, 0.06, 0, s * 8.84); line(0.06, 1.2, -1.3, s * 9.44); line(0.06, 1.2, 1.3, s * 9.44); });

  const rope = new THREE.Mesh(new THREE.TorusGeometry(63.5, 0.14, 6, 140), std(0xffffff, 0.5)); rope.rotation.x = Math.PI / 2; rope.position.y = 0.12; scene.add(rope);
  const ads = canvasTex(1024, 64, (x, w, h) => { x.fillStyle = '#10231b'; x.fillRect(0, 0, w, h); x.fillStyle = '#c8a45a'; x.font = '800 40px Arial'; x.textBaseline = 'middle'; x.fillText('CRIC365   *   LIVE SCORING   *   CRIC365   *   ', 20, h / 2); });
  ads.wrapS = THREE.RepeatWrapping; ads.repeat.set(26, 1);
  const board = new THREE.Mesh(new THREE.CylinderGeometry(64.5, 64.5, 1, 96, 1, true), new THREE.MeshBasicMaterial({ map: ads, side: THREE.DoubleSide })); board.position.y = 0.5; scene.add(board);

  const profile = [[64.5, 0], [64.5, 1.5], [68, 1.5], [68, 3], [72, 3], [72, 4.5], [76, 4.5], [76, 6], [80, 6], [80, 14], [86, 22]].map(([r, y]) => new THREE.Vector2(r, y));
  scene.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 96), new THREE.MeshStandardMaterial({ color: 0x4b5568, roughness: 0.9, side: THREE.DoubleSide })));
  for (let i = 0; i < 4; i++) { // floodlights with glow
    const a = Math.PI / 4 + (i * Math.PI) / 2, x = Math.cos(a) * 90, z = Math.sin(a) * 90;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 48, 8), std(0x8a93a0, 0.6)); pole.position.set(x, 24, z); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(12, 6.5, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff6dc })); lamp.position.set(x, 49, z); lamp.lookAt(0, 20, 0); scene.add(lamp);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(34, 20), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,246,220,.85)'); g.addColorStop(1, 'rgba(255,246,220,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.position.set(x * 0.98, 49, z * 0.98); glow.lookAt(0, 30, 0); scene.add(glow);
  }
  // visible beams of light from the floodlights
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, g = new THREE.Group(); g.position.set(Math.cos(a) * 89, 48, Math.sin(a) * 89);
    const cg = new THREE.ConeGeometry(20, 80, 24, 1, true); cg.translate(0, -40, 0); cg.rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })));
    scene.add(g); g.lookAt(0, 0, 0);
  }
  // the big screen above the stands
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 340; const sx = sc.getContext('2d');
  const scTex = new THREE.CanvasTexture(sc); scTex.colorSpace = THREE.SRGBColorSpace;
  const screen = { draw(word, line) {
    const g = sx.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, '#0a1f17'); g.addColorStop(1, '#12402f'); sx.fillStyle = g; sx.fillRect(0, 0, 1024, 340);
    sx.strokeStyle = '#c8a45a'; sx.lineWidth = 10; sx.strokeRect(8, 8, 1008, 324);
    sx.textAlign = 'center'; sx.fillStyle = '#ffd76a'; sx.font = '800 170px Arial Black, Arial'; sx.fillText(word, 512, 200);
    sx.fillStyle = '#ffffff'; sx.font = '700 52px Arial'; sx.fillText(line, 512, 290); scTex.needsUpdate = true;
  } };
  screen.draw('CRIC365', 'LIVE CRICKET SCORING');
  const board2 = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.MeshBasicMaterial({ map: scTex, toneMapped: false, fog: false })); board2.position.set(0, 10.5, -77); scene.add(board2);
  // crowd (instanced): bodies and heads, jumping when the crowd cheers
  const N = 760, palette = [0xe5484d, 0x3a6fd8, 0xf2c230, 0xffffff, 0x3fb67b, 0xff8e3c, 0x9a63d6, 0x222222];
  const skins = [0xd7a177, 0xb98058, 0x8d5a3c, 0xf0c7a0];
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 0.45, 3, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), N);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), N);
  const spec = [], c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const tier = i % 4 === 3 ? 2 : i % 4, a = Math.random() * Math.PI * 2, r = 66 + tier * 4 + rnd(-1, 1);
    spec.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 1.5 * (tier + 1) + 0.5, ph: rnd(0, 6.28), ang: a });
    bodies.setColorAt(i, c.setHex(palette[Math.floor(Math.random() * palette.length)]));
    heads.setColorAt(i, c.setHex(skins[i % skins.length]));
  }
  scene.add(bodies, heads);
  // camera flashes in the stands
  const FN = 90, fpos = new Float32Array(FN * 3), fcol = new Float32Array(FN * 3);
  for (let i = 0; i < FN; i++) { const s = spec[i * 8]; fpos.set([s.x, s.y + 1.2, s.z], i * 3); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fg.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  const flashes = new THREE.Points(fg, new THREE.PointsMaterial({ size: 2.4, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); flashes.frustumCulled = false; scene.add(flashes);
  const flash = (dt, rate) => { for (let i = 0; i < FN * 3; i++) fcol[i] *= 0.82; if (Math.random() < rate * dt * 60) { const k = Math.floor(Math.random() * FN) * 3; fcol[k] = fcol[k + 1] = fcol[k + 2] = 1; } fg.attributes.color.needsUpdate = true; };
  return { spec, bodies, heads, flash, screen };
}

function makeFireworks(scene, count, area) {
  const per = 80, N = count * per, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); pts.frustumCulled = false; scene.add(pts);
  const bursts = Array.from({ length: count }, (_, i) => {
    const color = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
    const vel = Array.from({ length: per }, () => { const a = Math.random() * 6.283, b = Math.acos(rnd(-1, 1)), s = rnd(9, 17); return [Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s]; });
    return { t0: 0.5 + i * 0.6 + Math.random() * 0.3, color, vel, cx: rnd(-area.x, area.x), cy: rnd(area.y0, area.y1), cz: rnd(area.z0, area.z1) };
  });
  return (t) => {
    bursts.forEach((b, i) => b.vel.forEach((v, j) => {
      const k = t - b.t0, o = (i * per + j) * 3;
      if (k < 0 || k > 2.6) { col[o] = col[o + 1] = col[o + 2] = 0; return; }
      pos[o] = b.cx + v[0] * k * (1 - k * 0.14); pos[o + 1] = b.cy + v[1] * k * (1 - k * 0.14) - 3.5 * k * k; pos[o + 2] = b.cz + v[2] * k * (1 - k * 0.14);
      const f = (1 - k / 2.6) * (k < 0.08 ? 1.6 : 1); col[o] = b.color.r * f; col[o + 1] = b.color.g * f; col[o + 2] = b.color.b * f;
    }));
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  };
}

// 3D confetti that falls around the point the camera is looking at
function makeConfetti(scene, n, colors) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.36), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }), n);
  const c = new THREE.Color(), p = Array.from({ length: n }, (_, i) => { mesh.setColorAt(i, c.set(colors[i % colors.length])); return { x: rnd(-12, 12), z: rnd(-12, 12), y0: rnd(0, 16), v: rnd(1.4, 3), s: rnd(2, 7), ph: rnd(0, 6.28) }; });
  mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  const d = new THREE.Object3D();
  return (t, t0, center) => {
    mesh.visible = t >= t0; if (t < t0) return;
    const k = t - t0;
    for (let i = 0; i < n; i++) {
      const q = p[i], y = 16 - ((q.y0 + q.v * k) % 16);
      d.position.set(center.x + q.x + Math.sin(k * 0.8 + q.ph) * 1.2, center.y - 6 + y, center.z + q.z); d.rotation.set(k * q.s, k * q.s * 0.7 + q.ph, 0); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
}
// A burst of sparks and an expanding ring where the bat meets the ball
function makeImpact(scene) {
  const N = 50, pos = new Float32Array(N * 3), vel = Array.from({ length: N }, () => new THREE.Vector3()), col = new Float32Array(N * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); pts.frustumCulled = false; scene.add(pts);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 40), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); scene.add(ring);
  let age = 99;
  return {
    fire(p) { age = 0; ring.position.copy(p); for (let i = 0; i < N; i++) { pos.set([p.x, p.y, p.z], i * 3); vel[i].set(rnd(-6, 6), rnd(-1, 7), rnd(-6, 6)); } },
    update(dt, camera) {
      age += dt; ring.visible = age < 0.6; ring.lookAt(camera.position); ring.scale.setScalar(1 + age * 22); ring.material.opacity = Math.max(0, 0.9 - age * 1.6);
      for (let i = 0; i < N; i++) { vel[i].y -= 12 * dt; pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt; const f = Math.max(0, 1 - age * 1.5); col[i * 3] = 1 * f; col[i * 3 + 1] = 0.75 * f; col[i * 3 + 2] = 0.3 * f; }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    }
  };
}

const MATCH_END = { four: 62, six: 70 };
const T = 1.75, T_REL = 1.02;                  // simulated seconds: contact with the ball, release of the ball
const T_CATCH = 2.6;                           // catch: how long the ball is in the air (it is caught at T + T_CATCH)
const T_RUN = 2.2, T_PICK = T + 1.75, T_THROW = T_PICK + 0.55, T_BREAK = T_THROW + 0.85;   // run out: batters set off, fielder picks up, throws, the stumps are hit
const STANCE = Math.PI / 2 + 0.22;             // the striker stands side-on: left shoulder towards the bowler, a little open
const BAT_X = -0.55;                           // and a little to the leg side of the stumps
// slow motion around the impact (for a run out: around the stumps being hit)
const SLOW = (s, kind) => { const c = kind === 'runout' ? T_BREAK : T + 0.065, w0 = kind === 'runout' ? 0.2 : 0.185, w1 = kind === 'runout' ? 0.3 : 0.185; return s > c - w0 && s < c + w1 ? 0.3 : 1; };

export async function start(el, opts) {
  const { kind, bat = '#1f4fa8', bowl = '#b3261e', team = '#c8a45a', onFail, onCut, label = {}, outStriker = true } = opts;
  const char = await loadCharacter();           // null = use the built-in players
  const M = !!char;
  const actors = [];
  const mk = (o) => { const p = M ? createActor(char, { color: o.shirt, bat: o.bat }) : makePerson(o); actors.push(p); return p; };
  const done = new Set(), once = (k, f) => { if (!done.has(k)) { done.add(k); f(); } };
  const W = el.clientWidth || 960, H = el.clientHeight || 540;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 600);
  const { spec, bodies, heads, flash, screen } = buildStadium(scene);
  const impact = makeImpact(scene);
  const confetti = makeConfetti(scene, kind === 'four' ? 160 : 320, kind === 'wicket' ? ['#ffffff'] : ['#ffd76a', '#ffffff', '#3fb67b', '#e5484d', '#4a8cff']);
  let punch0 = 99;
  const dummy = new THREE.Object3D();
  let cheer = 0.15, wall = 0, update;
  const isMatch = ['four', 'six', 'wicket', 'catch', 'runout'].includes(kind);

  // ball with a seam, a ground shadow and a short trail
  const seam = canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#b5241d'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e9d8'; x.lineWidth = 3; x.setLineDash([6, 4]); x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); });
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshStandardMaterial({ map: seam, roughness: 0.35 })); ballMesh.castShadow = true; scene.add(ballMesh);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })); blob.rotation.x = -Math.PI / 2; scene.add(blob);
  const trail = Array.from({ length: 12 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12 * (1 - i / 14), 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd0c8, transparent: true, opacity: 0.5 * (1 - i / 12) })); scene.add(m); return m; });
  const hist = [];

  if (isMatch) {
    // ================= four / six / wicket / catch / runout =================
    const isWk = kind === 'wicket', isCatch = kind === 'catch', isRun = kind === 'runout', isBound = kind === 'four' || kind === 'six';
    const batCol = new THREE.Color(bat).getHex(), bowlCol = new THREE.Color(bowl).getHex();
    const sA = makeStumps(10.06), sB = makeStumps(-10.06); scene.add(sA.group, sB.group);
    // The striker stands side-on to the bowler: front shoulder points down the pitch, feet either side of the crease, head turned to watch the ball.
    const batter = mk({ shirt: batCol, helmet: batCol, pads: true, bat: true, pants: 0xf2f2ee }); batter.root.rotation.order = 'YXZ'; batter.root.position.set(BAT_X, 0, 9.0); batter.root.rotation.y = STANCE; scene.add(batter.root);
    const nonStriker = mk({ shirt: batCol, helmet: batCol, pads: true, bat: true, pants: 0xf2f2ee }); nonStriker.root.rotation.order = 'YXZ'; nonStriker.root.position.set(-2.4, 0, -9.0); nonStriker.root.rotation.y = 0.35; scene.add(nonStriker.root);
    const bowler = mk({ shirt: bowlCol, pants: 0xf2f2ee }); scene.add(bowler.root);
    const umpire = mk({ shirt: 0xf3f3ee, pants: 0x20242e, hat: true }); umpire.root.position.set(-0.9, 0, -11.6); scene.add(umpire.root);
    const spots = [[-22, -6], [21, -9], [-30, -30], [30, -28], [0, -48], [-14, 22], [17, 12], [10, -22], [-8, -34]];
    const fielders = spots.map(([x, z]) => { const f = mk({ shirt: bowlCol, pants: 0xf2f2ee, skin: [0xd7a177, 0xb98058, 0x8d5a3c][Math.floor(Math.random() * 3)] }); f.root.position.set(x, 0, z); scene.add(f.root); return { ...f, home: new THREE.Vector2(x, z) }; });

    const hitPt = new THREE.Vector3(-0.28, 0.95, 8.7);   // where the bat meets the ball
    const pickF = (list) => fielders[list[Math.floor(Math.random() * list.length)]];
    // catch: this fielder runs a few steps in and takes the ball above his head.  run out: this fielder runs in, picks up and throws at the stumps.
    const key = isCatch ? pickF([0, 1, 2, 3, 4, 7, 8]) : isRun ? pickF([0, 1]) : null;
    const keyPt = key ? new THREE.Vector3(key.home.x + rnd(-2.2, 2.2), isCatch ? 2.0 : 0.14, key.home.y + (isCatch ? rnd(0.5, 3.5) : rnd(1.5, 4))) : null;
    const phi = key ? Math.atan2(keyPt.x - hitPt.x, -(keyPt.z - hitPt.z)) : rnd(-0.55, 0.55);   // the ball goes where the fielder is
    const dir = new THREE.Vector3(Math.sin(phi), 0, -Math.cos(phi));
    const tCatchAt = T + T_CATCH;
    const outEnd = outStriker ? -1 : 1;                                   // run out: the batter who is short runs to this end (-1 = the bowler's end)
    const runner = outStriker ? batter : nonStriker;
    const tgt = isRun && outEnd > 0 ? sA : isRun ? sB : sA, ss = tgt === sA ? 1 : -1;
    const throwHit = new THREE.Vector3(0.02, 0.45, outEnd * 10.0);
    const psi = key && isRun ? Math.atan2(throwHit.x - keyPt.x, throwHit.z - keyPt.z) : 0;       // the fielder turns to the stumps to throw
    const rel = key && isRun ? new THREE.Vector3(keyPt.x + Math.sin(psi) * 0.3, 1.9, keyPt.z + Math.cos(psi) * 0.3) : new THREE.Vector3();
    const bailDir = new THREE.Vector3(throwHit.x - rel.x, 0, throwHit.z - rel.z).normalize();
    const ball = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), p0: new THREE.Vector3(), free: false, done: false };
    let tEnd = Infinity, broken = 0, camCut = '', chaser = null, shakeT = -9, trailOn = true;
    const endPos = isWk ? new THREE.Vector3(0.02, 0.42, 10.0) : hitPt.clone();

    const delivery = (s, out) => {
      const sx = 0.9, sy = 2.2, sz = -9.6, bs = isWk ? 0.55 : 0.6;
      out.x = sx + (endPos.x - sx) * s; out.z = sz + (endPos.z - sz) * s;
      out.y = s < bs ? 0.14 + (sy - 0.14) * (1 - (s / bs) ** 2) : 0.14 + (endPos.y - 0.14) * ((s - bs) / (1 - bs)) ** 0.75;
    };
    const camPos = new THREE.Vector3(2.6, 3.0, 17.5), look = new THREE.Vector3(0, 1.2, -3);
    const swingShift = isWk ? -0.24 : 0;    // on a wicket the batter is early and misses
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const face = (p, x, z) => { p.root.rotation.y = Math.atan2(x - p.root.position.x, z - p.root.position.z); };
    const turnTo = (p, yaw, k) => { let d = yaw - p.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); p.root.rotation.y += d * k; };
    const holdBall = (p, y, fwd = 0.3) => ball.pos.set(p.root.position.x + Math.sin(p.root.rotation.y) * fwd, p.root.position.y + y, p.root.position.z + Math.cos(p.root.rotation.y) * fwd);
    const runLegs = (p, t, mv) => { const s = Math.sin(t * 14) * 0.95 * mv; p.legs[0].rotation.set(s, 0, 0); p.legs[1].rotation.set(-s, 0, 0); };
    const cheerPose = (p, t, ph) => {
      const j = Math.abs(Math.sin(t * 5 + ph)); p.root.position.y = j * 0.4;
      p.arms[0].rotation.set(0, 0, -2.75 + Math.sin(t * 9 + ph) * 0.2); p.arms[1].rotation.set(0, 0, 2.75 - Math.sin(t * 9 + ph) * 0.2);
      p.upper.rotation.set(0, 0, 0); p.legs[0].rotation.set(j * 0.4, 0, 0); p.legs[1].rotation.set(-j * 0.4, 0, 0);
    };
    // run out: where a batter is at time t. dest = -1 for the striker (runs to the bowler's end), +1 for the non-striker.
    const runZ = (z0, dest, out, t, t0) => {
      if (out) {
        const u = clamp((t - t0) / (T_BREAK - t0), 0, 1); let z = z0 + (dest * 7.84 - z0) * u ** 1.25;
        if (t > T_BREAK) z += dest * 0.5 * (1 - Math.exp(-5 * (t - T_BREAK)));   // slides on after the dive, still short of the line
        return z;
      }
      const u = clamp((t - t0) / (T_BREAK - 0.1 - t0), 0, 1); return z0 + (dest * 9.09 - z0) * u ** 1.25;
    };

    update = (t, dt) => {
      const run = Math.min(1, t / T_REL), bz = t < T_REL ? -26 + 16.2 * run : -9.8 + Math.min(3.6, (t - T_REL) * 4);
      bowler.root.position.set(1.6 - 0.8 * run - Math.max(0, t - T_REL) * 0.3, Math.abs(Math.sin(t * 13)) * 0.08 * (t < 1.6 ? 1 : 0), bz);
      if (!M) {
        const stride = t < 1.7 ? 1 : Math.max(0, 1 - (t - 1.7) * 2);
        bowler.legs[0].rotation.x = Math.sin(t * 13) * 0.9 * stride; bowler.legs[1].rotation.x = -Math.sin(t * 13) * 0.9 * stride;
        bowler.arms[0].rotation.x = -Math.sin(t * 13) * 0.7 * stride;
        bowler.arms[1].rotation.x = t < 0.8 ? Math.sin(t * 13) * 0.7 : track(t, [[0.8, 0], [T_REL, Math.PI * 1.55], [1.3, Math.PI * 2]]);
        bowler.upper.rotation.x = 0.15 + (t > T_REL - 0.1 && t < 1.4 ? 0.35 : 0);
      } else {
        once('b0', () => bowler.play('run'));
        if (t >= 0.74) once('b1', () => bowler.play('bowl', { loop: false, duration: 0.9 }));
        if (t >= 2.2) once('b2', () => bowler.play('idle'));
      }

      // ---------- the two batters ----------
      const ct = T + swingShift, tRunS = T_RUN, tRunN = T_RUN - 0.25;
      const striking = !isRun || t < tRunS - 0.05;       // on a run out the striker sets off once the shot is played
      if (striking) {
        if (!M) {
          // side-on: shoulders turn from closed to open through the shot, bat swings in the line of the pitch, head stays on the ball
          const uImp = clamp(-phi - 0.22, -1.1, 1.1), uCoil = clamp(Math.min(-0.3, uImp - 0.3), -0.9, -0.3);
          const u = track(t, [[0, -0.05], [ct - 0.55, -0.05], [ct - 0.28, uCoil], [ct, uImp], [ct + 0.4, uImp + 0.75]]);
          const a = track(t, [[0, -0.05], [ct - 0.6, -0.05], [ct - 0.3, -2.0], [ct, 0.35], [ct + 0.4, 2.4]]);   // + swings the bat towards the bowler, - takes it back over the stumps
          const lift = Math.max(0, -a / 2) + Math.max(0, (a - 1.2) / 1.2);
          const lean = 0.25 + (isWk && t > T ? Math.min(0.5, (t - T) * 0.6) : 0) + (isCatch && t > tCatchAt ? Math.min(0.35, (t - tCatchAt) * 0.7) : 0);
          batter.upper.rotation.set(lean, u, 0);
          batter.head.rotation.y = clamp(1.2 - u, -1.1, 1.35);
          batter.bat.rotation.set(0, 0, a); batter.bat.position.set(0.1, 0.3 + 0.16 * Math.max(0, -a / 2), 0.3);
          batter.arms.forEach((ar) => { ar.rotation.x = -0.45 - 0.55 * lift; });
          batter.arms[0].rotation.z = 0.16; batter.arms[1].rotation.z = -0.16;
          batter.legs[0].rotation.set(0, 0, -0.15); batter.legs[1].rotation.set(0, 0, 0.15);   // feet apart, one either side of the crease (the sign matters: the other way crosses the legs)
        } else {
          once('idle', () => { batter.play('idle'); nonStriker.play('idle'); umpire.play('idle'); fielders.forEach((f) => f.play('idle', { offset: Math.random() })); });
          if (t >= ct - 0.42) once('swing', () => batter.play('swing', { loop: false, duration: 0.85 }));
          if (isWk && t >= T + 0.6) once('out', () => batter.play('out', { loop: false }));
          if (isCatch && t >= tCatchAt + 0.3) once('out', () => batter.play('out', { loop: false }));
        }
        if (isCatch && t > tCatchAt + 0.5) {   // out: walks off with his head down
          const w = t - (tCatchAt + 0.5), dx = -7 - BAT_X, dz = 18 - 9, d = Math.hypot(dx, dz);
          batter.root.position.set(BAT_X + (dx / d) * 1.5 * w, 0, 9 + (dz / d) * 1.5 * w);
          turnTo(batter, Math.atan2(dx, dz), Math.min(1, dt * 4));
          if (!M) { const s = Math.sin(t * 6) * 0.5; batter.legs[0].rotation.set(s, 0, 0); batter.legs[1].rotation.set(-s, 0, 0); batter.arms[0].rotation.set(0.05, 0, 0.1); batter.arms[1].rotation.set(-0.05, 0, -0.1); batter.upper.rotation.set(0.4, 0, 0); batter.head.rotation.y = 0; batter.bat.rotation.set(0.3, 0, 0.1); }
        }
      }
      if (!M && !isRun) { nonStriker.bat.rotation.x = 0.05; nonStriker.arms.forEach((a) => (a.rotation.x = -0.45)); nonStriker.arms[0].rotation.z = 0.16; nonStriker.arms[1].rotation.z = -0.16; nonStriker.upper.rotation.x = 0.15; }
      if (!M && isRun && t < tRunN) { nonStriker.bat.rotation.x = 0.05; nonStriker.arms.forEach((a) => (a.rotation.x = -0.45)); nonStriker.arms[0].rotation.z = 0.16; nonStriker.arms[1].rotation.z = -0.16; nonStriker.upper.rotation.x = 0.15; }

      if (isRun) {
        // both batters run: the striker towards the bowler's end (faces -z), the non-striker towards the striker's end (faces +z)
        [[batter, 9.0, BAT_X, -1, outStriker, tRunS], [nonStriker, -9.0, -2.4, 1, !outStriker, tRunN]].forEach(([p, z0, x0, dest, out, t0]) => {
          if (t < t0 - 0.05) return;
          const u = clamp((t - t0) / (T_BREAK - t0), 0, 1), xEnd = out ? 0.25 : -0.45;
          p.root.position.x = x0 + (xEnd - x0) * ease(clamp((t - t0) / 1.4, 0, 1));
          p.root.position.z = runZ(z0, dest, out, t, t0);
          turnTo(p, dest < 0 ? Math.PI : 0, Math.min(1, dt * 9));
          const dive = out ? ease((t - (T_BREAK - 0.5)) / 0.4) : 0;     // the batter who is short throws himself at the line
          const arrived = !out && t > T_BREAK - 0.1;
          const mv = (out ? (t < T_BREAK - 0.5 ? 1 : 0) : arrived ? 0 : 1);
          if (!M) {
            runLegs(p, t, mv);
            p.arms[0].rotation.set(-Math.sin(t * 14) * 0.8 * mv, 0, 0); p.arms[1].rotation.set(Math.sin(t * 14) * 0.8 * mv, 0, 0);
            p.upper.rotation.set(0.2 + 0.1 * mv, 0, 0); p.head.rotation.y = 0;
            p.bat.rotation.set(0.9, 0, 0); p.bat.position.set(0.1, 0.3, 0.3);
            if (out && dive > 0) { p.arms[0].rotation.set(-2.9, 0, 0.1); p.arms[1].rotation.set(-2.9, 0, -0.1); p.bat.rotation.set(-1.2, 0, 0); p.legs[0].rotation.set(-0.5, 0, 0); p.legs[1].rotation.set(-0.3, 0, 0); }
            if (arrived) { p.arms[0].rotation.set(0.05, 0, 0.1); p.arms[1].rotation.set(-0.05, 0, -0.1); p.upper.rotation.set(0.12, 0, 0); p.legs[0].rotation.set(0, 0, 0); p.legs[1].rotation.set(0, 0, 0); }
          } else {
            once(`run${p === batter ? 0 : 1}`, () => p.play('run'));
            if (arrived) once(`stop${p === batter ? 0 : 1}`, () => p.play('idle'));
          }
          // dive: tilt forward along the line of the run, then lie there a moment and sit up, head down
          const lie = out ? dive * (1 - 0.8 * ease((t - (T_BREAK + 0.9)) / 0.9)) : 0;
          p.root.rotation.x = 1.25 * lie; p.root.position.y = 0.1 * lie;
          if (out && M && dive > 0.3) once('rout', () => p.play('out', { loop: false }));
        });
      }

      // ---------- the ball ----------
      if (t < T_REL) ball.pos.set(bowler.root.position.x + 0.25, 1.7 + Math.sin(Math.min(1, t / T_REL) * Math.PI) * 0.4, bowler.root.position.z + 0.2);
      else if (t < T) delivery((t - T_REL) / (T - T_REL), ball.pos);
      else if (!ball.free) {
        ball.free = true; ball.p0.copy(ball.pos); shakeT = t; impact.fire(ball.pos);
        if (!isRun) punch0 = t;
        if (isBound || isWk) screen.draw(label.word || '', label.line || '');
        if (kind === 'four') ball.vel.set(dir.x * 34, 3.5, dir.z * 34);
        else if (kind === 'six') ball.vel.set(dir.x * 24, 17, dir.z * 24);
        else if (isWk) { ball.vel.set(rnd(-0.8, 0.8), 2.2, 4.5); broken = t; sA.bails.forEach((b) => { b.flying = true; b.vel.set(rnd(-1.5, 1.5), rnd(2.6, 3.6), rnd(2, 4)); b.spin = rnd(-9, 9); }); }
        if (isBound) { const ex = dir.x * 62, ez = dir.z * 62; chaser = fielders.reduce((a, f) => (Math.hypot(f.home.x - ex, f.home.y - ez) < Math.hypot(a.home.x - ex, a.home.y - ez) ? f : a)); }
      }
      if (ball.free && isCatch) {
        const s = t - T;
        if (s < T_CATCH) {   // a high, lofted shot that comes down in the fielder's hands
          const k = s / T_CATCH, g = 9.8;
          ball.pos.set(ball.p0.x + (keyPt.x - ball.p0.x) * k, ball.p0.y + ((keyPt.y - ball.p0.y) + 0.5 * g * T_CATCH * T_CATCH) * k - 0.5 * g * s * s, ball.p0.z + (keyPt.z - ball.p0.z) * k);
        } else {
          once('caught', () => { trailOn = false; shakeT = t; punch0 = t; impact.fire(ball.pos); screen.draw(label.word || '', label.line || ''); });
          holdBall(key, 2.05 + 0.5 * ease((t - tCatchAt - 0.15) / 0.4), 0.25);
        }
      } else if (ball.free && isRun) {
        if (t < T_PICK) {    // the push races along the ground to the fielder
          const u = (t - T) / (T_PICK - T), sU = 1 - (1 - u) ** 1.6;
          ball.pos.set(ball.p0.x + (keyPt.x - ball.p0.x) * sU, 0.14 + 0.22 * Math.abs(Math.sin(u * 11)) * (1 - u), ball.p0.z + (keyPt.z - ball.p0.z) * sU);
        } else if (t < T_THROW) { holdBall(key, 0.3 + 1.6 * ease((t - T_PICK - 0.2) / (T_THROW - T_PICK - 0.2)), 0.3); }
        else if (t < T_BREAK) {   // the throw, straight at the stumps
          const u = (t - T_THROW) / (T_BREAK - T_THROW);
          ball.pos.set(rel.x + (throwHit.x - rel.x) * u, rel.y + (throwHit.y - rel.y) * u + 0.5 * Math.sin(Math.PI * u), rel.z + (throwHit.z - rel.z) * u);
        } else {
          const k = t - T_BREAK; ball.pos.set(throwHit.x + bailDir.x * 2.5 * (1 - Math.exp(-3 * k)), Math.max(0.14, 0.45 + 1.2 * k - 4.9 * k * k), throwHit.z + bailDir.z * 2.5 * (1 - Math.exp(-3 * k)));
        }
        if (t >= T_THROW) trailOn = true; else trailOn = false;
        if (t >= T_BREAK) once('brk', () => {
          broken = t; shakeT = t; punch0 = t; impact.fire(throwHit); screen.draw(label.word || '', label.line || '');
          tgt.bails.forEach((b) => { b.flying = true; b.vel.set(bailDir.x * 3 + rnd(-1, 1), rnd(2.6, 3.6), bailDir.z * 3 + rnd(-0.6, 0.6)); b.spin = rnd(-9, 9); });
        });
      } else if (ball.free && !ball.done) {
        const g = kind === 'six' ? 11 : 14, steps = 3, h = dt / steps;
        for (let i = 0; i < steps; i++) {
          ball.pos.addScaledVector(ball.vel, h); ball.vel.y -= g * h;
          if (ball.pos.y < 0.14) { ball.pos.y = 0.14; ball.vel.y = Math.abs(ball.vel.y) > 1 ? -ball.vel.y * 0.5 : 0; ball.vel.x *= 0.99; ball.vel.z *= 0.99; }
        }
        const r = Math.hypot(ball.pos.x, ball.pos.z);
        if (isBound && (r >= MATCH_END[kind] || t - T > 3.6)) { ball.done = true; tEnd = t; ball.vel.set(0, 0, 0); }
        if (isWk && t - T > 1.4) { ball.done = true; ball.vel.set(0, 0, 0); }
      }
      ballMesh.visible = !(kind === 'six' && ball.done);
      ballMesh.position.copy(ball.pos); ballMesh.rotation.x += dt * 12;
      blob.position.set(ball.pos.x, 0.06, ball.pos.z); blob.scale.setScalar(Math.max(0.3, 1.2 - ball.pos.y * 0.07)); blob.visible = ballMesh.visible && ball.pos.y < 6;
      hist.unshift(ball.pos.clone()); hist.length = Math.min(hist.length, 36);
      trail.forEach((m, i) => { const p = hist[Math.min(hist.length - 1, (i + 1) * 3)]; m.visible = !!p && t > T_REL && ballMesh.visible && trailOn; if (p) m.position.copy(p); });

      if (broken) {
        const k = t - broken; tgt.stumps.forEach((s, i) => { s.rotation.x = ss * Math.min(1.35, k * (3 + i)); s.rotation.z = (i - 1) * Math.min(0.5, k); });
        tgt.bails.forEach((b) => { if (!b.flying) return; b.vel.y -= 9.8 * dt; b.mesh.position.addScaledVector(b.vel, dt); b.mesh.rotation.x += b.spin * dt; if (b.mesh.position.y < 0.04) { b.mesh.position.y = 0.04; b.flying = false; } });
      }

      // ---------- fielders ----------
      fielders.forEach((f, idx) => {
        let moving = 0;
        const isKey = f === key;
        f.root.position.y = 0;
        if (isBound) {
          face(f, ball.pos.x, ball.pos.z);
          if (f === chaser && ball.free) { const dx = ball.pos.x - f.root.position.x, dz = ball.pos.z - f.root.position.z, d = Math.hypot(dx, dz); if (d > 1.5) { f.root.position.x += (dx / d) * 8 * dt; f.root.position.z += (dz / d) * 8 * dt; moving = 1; } }
          if (!M) {
            const ph = t * 12; f.legs[0].rotation.x = Math.sin(ph) * 0.8 * moving; f.legs[1].rotation.x = -Math.sin(ph) * 0.8 * moving;
            f.upper.rotation.x = 0.2 + moving * 0.25; f.arms[0].rotation.x = -0.4; f.arms[1].rotation.x = -0.4;
            if (kind === 'six' && !moving) { f.arms[0].rotation.x = Math.PI; f.arms[1].rotation.x = Math.PI; }
          } else if (moving) once(`run${idx}`, () => f.play('run'));
          else if (kind === 'six' && ball.free) once(`ch${idx}`, () => f.play('cheer', { offset: Math.random() }));
        } else if (isCatch) {
          const after = t >= tCatchAt;
          if (isKey) {
            const u = ease((t - (T + 0.25)) / (T_CATCH - 0.25));
            f.root.position.x = key.home.x + (keyPt.x - key.home.x) * u; f.root.position.z = key.home.y + (keyPt.z - key.home.y) * u;
            moving = t > T + 0.25 && !after ? 1 : 0;
            if (!after) face(f, ball.pos.x, ball.pos.z); else turnTo(f, Math.atan2(0 - f.root.position.x, 9 - f.root.position.z), Math.min(1, dt * 5));
            if (!M) {
              if (!after) {
                const up = ease((t - (tCatchAt - 1.0)) / 0.7);    // hands go up and come together under the ball
                runLegs(f, t, moving); f.upper.rotation.set(0.2 + moving * 0.15 * (1 - up), 0, 0);
                f.arms[0].rotation.set(-0.4 + (-2.6 + 0.4) * up, 0, 0.28 * up); f.arms[1].rotation.set(-0.4 + (-2.6 + 0.4) * up, 0, -0.28 * up);
              } else cheerPose(f, t - tCatchAt, 0);
            } else if (moving) once('krun', () => f.play('run')); else if (after) once('kcheer', () => f.play('cheer'));
          } else {
            if (!after) face(f, ball.pos.x, ball.pos.z);
            else {
              const dx = key.root.position.x - f.root.position.x, dz = key.root.position.z - f.root.position.z, d = Math.hypot(dx, dz);
              if (t > tCatchAt + 0.25 && d > 2.4) { f.root.position.x += (dx / d) * 4.8 * dt; f.root.position.z += (dz / d) * 4.8 * dt; moving = 1; }
              turnTo(f, Math.atan2(dx, dz), Math.min(1, dt * 6));
            }
            if (!M) {
              if (after && !moving) cheerPose(f, t - tCatchAt, idx);
              else { runLegs(f, t, moving); f.upper.rotation.set(0.2 + moving * 0.2, 0, 0); f.arms[0].rotation.set(moving ? -0.8 : -0.4, 0, moving ? -2.2 : 0); f.arms[1].rotation.set(moving ? -0.8 : -0.4, 0, moving ? 2.2 : 0); }
            } else if (after && t > tCatchAt + 0.25) { if (moving) once(`run${idx}`, () => f.play('run')); else once(`ch${idx}`, () => f.play('cheer', { offset: Math.random() })); }
          }
        } else if (isRun) {
          const after = t >= T_BREAK;
          if (isKey) {
            const u = ease((t - (T + 0.15)) / (T_PICK - T - 0.15));
            f.root.position.x = key.home.x + (keyPt.x - key.home.x) * u; f.root.position.z = key.home.y + (keyPt.z - key.home.y) * u;
            moving = t > T + 0.15 && t < T_PICK ? 1 : 0;
            if (t < T_PICK - 0.2) face(f, ball.pos.x, ball.pos.z); else turnTo(f, psi, Math.min(1, dt * 8));
            if (!M) {
              if (!after) {
                const bend = ease((t - (T_PICK - 0.35)) / 0.3) * (1 - ease((t - (T_PICK + 0.1)) / 0.45));   // down for the ball, then up to throw
                runLegs(f, t, moving); f.upper.rotation.set(0.2 + moving * 0.2 + bend * 0.9, 0, 0);
                f.arms[0].rotation.set(-0.4 - bend * 0.7, 0, 0);
                f.arms[1].rotation.set(t < T_PICK + 0.1 ? -0.4 - bend * 0.7 : track(t, [[T_PICK + 0.1, 0.6], [T_THROW - 0.2, 2.6], [T_THROW + 0.12, -1.7], [T_THROW + 0.45, -0.6]]), 0, 0);
              } else cheerPose(f, t - T_BREAK, 0);
            } else if (moving) once('krun', () => f.play('run')); else if (after) once('kcheer', () => f.play('cheer'));
          } else {
            face(f, after ? 0 : ball.pos.x, after ? 0 : ball.pos.z);
            if (!M) { if (after) cheerPose(f, t - T_BREAK, idx); else { runLegs(f, t, 0); f.upper.rotation.set(0.2, 0, 0); f.arms[0].rotation.set(-0.4, 0, 0); f.arms[1].rotation.set(-0.4, 0, 0); } }
            else if (after) once(`ch${idx}`, () => f.play('cheer', { offset: Math.random() }));
          }
        } else {   // wicket
          face(f, ball.pos.x, ball.pos.z);
          if (!M) { runLegs(f, t, 0); f.upper.rotation.set(0.2, 0, 0); f.arms[0].rotation.set(-0.4, 0, 0); f.arms[1].rotation.set(-0.4, 0, 0); }
        }
      });

      // ---------- the umpire ----------
      const outKind = isWk || isCatch || isRun;
      const sigT = isWk ? T + 0.9 : isCatch ? tCatchAt + 0.8 : isRun ? T_BREAK + 0.9 : tEnd - 0.7;
      const sig = t >= sigT, k = sig ? t - sigT : 0;
      if (!M) {
        const [a0, a1] = umpire.arms;
        a0.rotation.set(0, 0, 0); a1.rotation.set(0, 0, 0);
        if (sig && kind === 'four') { a1.rotation.x = -Math.PI / 2; a1.rotation.y = Math.sin(k * 9) * 0.75; }
        if (sig && kind === 'six') { a0.rotation.z = -2.7 + Math.sin(k * 10) * 0.05; a1.rotation.z = 2.7 - Math.sin(k * 10) * 0.05; }
        if (sig && outKind) a1.rotation.z = Math.PI - 0.12;   // raised finger
      } else if (sig) once('sig', () => umpire.play(kind === 'four' ? 'signal4' : kind === 'six' ? 'signal6' : 'signalOut'));

      const target = isCatch ? (t >= tCatchAt ? 0.7 : t >= T ? 0.3 : 0.15) : isRun ? (t >= T_BREAK ? 0.7 : t >= T ? 0.35 : 0.15) : t >= T ? (kind === 'six' ? 1 : kind === 'four' ? 0.8 : 0.5) : 0.15;
      cheer += (target - cheer) * Math.min(1, dt * 3);

      // ---------- cameras: delivery, close-up of the shot (slow motion), then the chase / the catch / the run and the throw, and the umpire ----------
      const tUmp = isWk ? T + 1.5 : isCatch ? tCatchAt + 1.5 : isRun ? T_BREAK + 1.5 : Number.isFinite(tEnd) ? tEnd + 0.35 : Infinity;
      const tp = new THREE.Vector3(), tl = new THREE.Vector3(); let kPos = 3.5, kLook = 6;
      const set = (phase, snap) => { if (camCut !== phase) { if (camCut) onCut && onCut(); camCut = phase; if (snap) { camPos.copy(tp); look.copy(tl); } } };
      if (t >= tUmp) { tp.set(2.0, 1.75, -6.9); tl.set(-0.9, 1.55, -11.6); set('u', true); }
      else if (isWk && t >= T - 0.7) { tp.set(1.7, 0.9, 13.6); tl.set(0, 0.55, 9.4); set('s', true); }
      else if (isCatch && t >= tCatchAt - 0.9) { tp.set(keyPt.x + 4.2, 2.1, keyPt.z + 6.0); tl.set(keyPt.x, 1.9, keyPt.z); set('k', true); }   // close on the fielder as the ball drops in
      else if (isRun && t >= T_THROW - 0.3) { tp.set(3.0, 1.3, outEnd * 15.2); tl.set(0, 0.7, outEnd * 9.0); set('s2', true); }               // from behind the stumps: the throw, the dive
      else if (!isWk && t >= T - 0.45 && t < T + 0.3) { tp.set(3.4, 1.35, 11.0); tl.set(-0.15, 1.0, 8.7); set('h', true); }                    // front-on to the side-on batter, bat swinging across the screen
      else if (isRun && t >= T + 0.3) { const sd = key.home.x < 0 ? 1 : -1; tp.set(sd * 13, 5.0, 14); tl.set(-sd * 6, 0.8, 0); kPos = 2; kLook = 3; set('r', true); }   // wide: both batters running, the fielder chasing
      else if (ball.free && (isBound || isCatch)) { tp.set(ball.pos.x * 0.45, kind === 'six' || isCatch ? 2.6 : 3.2, ball.pos.z + (kind === 'six' || isCatch ? 16 : 13)); tl.copy(ball.pos); kPos = 3; kLook = 7; set('c', camCut === 'h'); }
      else { tp.set(2.6 - t * 0.15, 3.0, 17.5 - t * 0.5); tl.set(0, 1.2, -3 + t * 0.4); }
      camPos.lerp(tp, 1 - Math.exp(-dt * kPos)); look.lerp(tl, 1 - Math.exp(-dt * kLook));
      const sh = Math.max(0, 1 - (t - shakeT) * 4) * 0.07;
      camera.position.set(camPos.x + rnd(-sh, sh), camPos.y + rnd(-sh, sh), camPos.z + rnd(-sh, sh)); camera.lookAt(look);
      if (t > T + 4.5 && !ball.done && isBound) { ball.done = true; tEnd = t; }
      if (isBound) confetti(t, T + 0.2, look);
    };
  } else {
    // ================= milestone (50/100/150/200) and win share the hero set =================
    ballMesh.visible = false; blob.visible = false; trail.forEach((m) => (m.visible = false));
    if (kind === 'milestone') {
      const batCol = new THREE.Color(bat).getHex(), bowlCol = new THREE.Color(bowl).getHex();
      const sA = makeStumps(10.06), sB = makeStumps(-10.06); scene.add(sA.group, sB.group);
      const hero = mk({ shirt: batCol, helmet: batCol, pads: true, bat: true, pants: 0xf2f2ee }); hero.root.position.set(0.3, 0, 8.0); hero.root.rotation.y = Math.PI; scene.add(hero.root);
      const partner = mk({ shirt: batCol, helmet: batCol, pads: true, bat: true, pants: 0xf2f2ee }); partner.root.position.set(-2.4, 0, -9.0); scene.add(partner.root);
      const umpire = mk({ shirt: 0xf3f3ee, pants: 0x20242e, hat: true }); umpire.root.position.set(-0.9, 0, -11.6); scene.add(umpire.root);
      const bowler = mk({ shirt: bowlCol, pants: 0xf2f2ee }); bowler.root.position.set(1.8, 0, -2.5); scene.add(bowler.root);
      const spots = [[-22, -6], [21, -9], [-30, -30], [30, -28], [0, -48], [-14, 22], [17, 12], [10, -22]];
      const fielders = spots.map(([x, z]) => { const f = mk({ shirt: bowlCol, pants: 0xf2f2ee }); f.root.position.set(x, 0, z); scene.add(f.root); return f; });
      const fire = makeFireworks(scene, 9, { x: 38, y0: 22, y1: 42, z0: -75, z1: -35 }), focus = new THREE.Vector3(0, 4, 6);
      const clap = (p, t, ph = 0) => { const s = Math.sin(t * 11 + ph) * 0.18; p.arms[0].rotation.set(-1.15 + s, 0.45, 0); p.arms[1].rotation.set(-1.15 - s, -0.45, 0); };
      update = (t, dt) => {
        const turn = ease((t - 0.3) / 0.7);                                    // turns to face the crowd and camera
        hero.root.rotation.y = Math.PI * (1 - turn) + Math.sin(t * 0.9) * 0.45 * turn;
        const run = ease((t - 0.7) / 1.6), pz = -9 + run * 14.6;                // the batting partner runs over
        partner.root.position.set(-2.4 + run * 1.2, 0, pz); partner.root.lookAt(0.3, 0, 8);
        const mv = run > 0 && run < 1 ? 1 : 0;
        if (!M) {
          const off = ease((t - 0.5) / 0.4);                                   // helmet comes off
          if (hero.helmetG) hero.helmetG.visible = off < 0.5;
          const up = ease((t - 0.7) / 0.6);                                    // bat raised to the crowd, other arm waving
          hero.arms[1].rotation.set(0, 0, 0.4 + up * 2.5); hero.arms[1].rotation.z = 0.1 + up * 2.8;
          hero.bat.position.set(0.12 + up * 0.32, 0.42 + up * 0.75, 0.28 - up * 0.2); hero.bat.rotation.x = up * Math.PI + (1 - up) * 1.0; hero.bat.rotation.z = up * -0.15;
          hero.arms[0].rotation.set(0, 0, -(0.1 + up * 2.4) + Math.sin(t * 7) * 0.2 * up);
          hero.upper.rotation.set(0.1 - up * 0.12, 0, 0);
          hero.legs[0].rotation.z = -0.08; hero.legs[1].rotation.z = 0.08;
          hero.root.position.y = Math.max(0, Math.sin((t - 2.6) * 6)) * 0.14 * (t > 2.6 && t < 3.4 ? 1 : 0); // a small jump of joy
          partner.legs[0].rotation.x = Math.sin(t * 13) * 0.9 * mv; partner.legs[1].rotation.x = -Math.sin(t * 13) * 0.9 * mv;
          if (run >= 1) clap(partner, t); else { partner.arms[0].rotation.x = -Math.sin(t * 13) * 0.7 * mv; partner.arms[1].rotation.x = Math.sin(t * 13) * 0.7 * mv; }
          partner.bat.rotation.x = 1.0; partner.bat.position.set(0.12, 0.42, 0.28);
          [bowler, umpire, ...fielders].forEach((p, i) => { p.root.lookAt(0.3, 0, 8); if (t > 0.9) clap(p, t, i); p.upper.rotation.x = 0.05; });
        } else {
          once('m0', () => { hero.play('idle'); partner.play('idle'); [bowler, umpire, ...fielders].forEach((p) => p.play('idle', { offset: Math.random() })); screen.draw(label.word || 'MILESTONE', label.line || ''); });
          if (t >= 0.7) once('m1', () => hero.play('cheer'));
          if (t >= 0.7) once('m2', () => partner.play('run'));
          if (run >= 1) once('m3', () => partner.play('clap'));
          if (t >= 0.9) once('m4', () => [bowler, umpire, ...fielders].forEach((p) => { p.root.lookAt(0.3, 0, 8); p.play('clap', { offset: Math.random() }); }));
        }
        const fcol = fire(t);
        confetti(t, 1.2, focus);
        cheer = Math.min(1, 0.3 + t * 0.6);
        const sw = Math.sin(t * 0.55);
        const wide = t < 1.0, k = ease((t - 0.6) / 1.2);
        camera.position.set(0.8 + sw * 1.8, 2.7 - k * 1.0, 17 - k * 4.5);
        camera.lookAt(0, 3.4 - k * 0.6 + (wide ? 0 : 0), 6 - k * -2);
        return fcol;
      };
    } else {
      const col = new THREE.Color(team).getHex();
      const gold = new THREE.MeshStandardMaterial({ color: 0xe0b23a, roughness: 0.28, metalness: 0.75, emissive: 0x3a2600, side: THREE.DoubleSide });
      const trophy = new THREE.Group();
      const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.5, 28), std(0x20242e, 0.5)); podium.position.y = 0.25; trophy.add(podium);
      const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.4, 0], [0.4, 0.1], [0.15, 0.18], [0.12, 0.55], [0.2, 0.68], [0.5, 1.15], [0.62, 1.55], [0.54, 1.55], [0.4, 1.2], [0.001, 0.9]].map(([r, y]) => new THREE.Vector2(r, y)), 32), gold);
      cup.position.y = 0.5; cup.castShadow = true; trophy.add(cup);
      [-1, 1].forEach((s) => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 18, Math.PI), gold); h.position.set(s * 0.6, 1.8, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; trophy.add(h); });
      trophy.scale.setScalar(1.3); scene.add(trophy);
      const squad = Array.from({ length: 11 }, (_, i) => {
        const p = mk({ shirt: col, helmet: i % 3 === 0 ? col : null, pants: 0xf2f2ee, skin: [0xd7a177, 0xb98058, 0x8d5a3c, 0xf0c7a0][i % 4] }); const a = (i / 11) * Math.PI * 2;
        p.root.position.set(Math.cos(a) * 4.2, 0, Math.sin(a) * 4.2); p.root.lookAt(0, 0, 0); p.ph = rnd(0, 6.28); scene.add(p.root); return p;
      });
      const fire = makeFireworks(scene, 10, { x: 30, y0: 18, y1: 36, z0: -40, z1: -10 }), focus = new THREE.Vector3(0, 4, 0);
      screen.draw(label.word || 'CHAMPIONS', label.line || '');
      update = (t) => {
        trophy.rotation.y = t * 0.8; cup.position.y = 0.5 + Math.sin(t * 2) * 0.05;
        squad.forEach((p) => {
          if (M) { once(`w${squad.indexOf(p)}`, () => p.play(squad.indexOf(p) % 2 ? 'cheer' : 'jump', { offset: Math.random() })); return; }
          const j = Math.abs(Math.sin(t * 5 + p.ph)); p.root.position.y = j * 0.55;
          p.arms[0].rotation.z = -2.75 + Math.sin(t * 9 + p.ph) * 0.2; p.arms[1].rotation.z = 2.75 - Math.sin(t * 9 + p.ph) * 0.2;
          p.legs[0].rotation.x = j * 0.4; p.legs[1].rotation.x = -j * 0.4;
        });
        fire(t); confetti(t, 0.6, focus); cheer = 1;
        const a = t * 0.5 + 0.6;
        camera.position.set(Math.cos(a) * 11.5, 3.0 + Math.sin(t * 0.8) * 0.4, Math.sin(a) * 11.5); camera.lookAt(0, 2.2, 0);
      };
    }
  }

  const animateCrowd = (time) => {
    const put = (i, add) => { dummy.position.set(spec[i].x, spec[i].y + add, spec[i].z); dummy.updateMatrix(); };
    for (let i = 0; i < spec.length; i++) {
      const wave = cheer > 0.5 ? Math.max(0, Math.sin(time * 2.6 - spec[i].ang * 3)) * 0.8 : 0;   // a wave runs round the ground
      const up = cheer * Math.abs(Math.sin(time * 7 + spec[i].ph)) * (cheer > 0.5 ? 0.9 : 0.5) + wave;
      put(i, up); bodies.setMatrixAt(i, dummy.matrix);
      put(i, up + 0.62); heads.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  };

  let raf = 0, last = performance.now(), sim = 0, dead = false;
  const dispose = () => {
    if (dead) return; dead = true; cancelAnimationFrame(raf);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { if (x.map) x.map.dispose(); x.dispose(); }); });
    if (scene.background && scene.background.dispose) scene.background.dispose();
    matCache.clear(); actors.forEach((a) => a.dispose && a.dispose());
    renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* ignore */ }
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  };
  const loop = () => {
    raf = requestAnimationFrame(loop);
    try {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      const speed = isMatch ? SLOW(sim, kind) : 1;           // slow motion on impact for 4, 6 and wickets
      sim += dt * speed; wall += dt;
      update(sim, dt * speed);
      actors.forEach((a) => a.update && a.update(dt * speed));
      impact.update(dt, camera);
      camera.fov = 40 - (isMatch ? Math.max(0, 9 * Math.exp(-(sim - punch0) * 4.5)) * (sim >= punch0 ? 1 : 0) : 0); camera.updateProjectionMatrix();   // a quick zoom-in on impact
      animateCrowd(wall); flash(dt, cheer > 0.5 ? 0.9 : 0.15);
      renderer.render(scene, camera);
    } catch (e) { dispose(); onFail && onFail(e); }
  };
  loop();
  return { dispose };
}
