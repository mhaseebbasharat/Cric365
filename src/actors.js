// Real animated characters. Put a rigged character with animations at  public/models/player.glb  (see public/models/README.md).
// If the file is missing or broken, loadCharacter() resolves to null and the scenes use the built-in simple players instead.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';

// What the scenes ask for -> words that are looked for in the animation names inside your model.
// You can name them exactly in public/models/clips.json, for example { "swing": "Baseball Swing" }.
const WORDS = {
  idle: /idle|stand|breath|stance/i,
  run: /run|sprint|jog/i,
  walk: /walk/i,
  swing: /swing|batting|bat\b|strike|slash|hit/i,
  bowl: /bowl|pitch|throw|overarm/i,
  cheer: /cheer|victory|celebrat|triumph|happy|win/i,
  clap: /clap|applau/i,
  jump: /jump|hop/i,
  out: /out\b|defeat|sad|disappoint|dead|lose|loss|fall/i,
  signal4: /signal.?(4|four)|four|wave/i,
  signal6: /signal.?(6|six)|six|arms.?up/i,
  signalOut: /signal.?out|finger|point|out.?signal/i
};
// If a clip is missing, try these instead (in order).
const FALLBACK = {
  clap: ['cheer', 'idle'], cheer: ['jump', 'clap', 'idle'], jump: ['cheer', 'idle'], bowl: ['run', 'idle'], swing: ['idle'], out: ['idle'],
  signal4: ['cheer', 'clap', 'idle'], signal6: ['cheer', 'jump', 'idle'], signalOut: ['point', 'cheer', 'idle'], walk: ['run', 'idle'], run: ['walk', 'idle']
};

let pending = null;
export function loadCharacter() {
  if (!pending) {
    pending = (async () => {
      try {
        const gltf = await new GLTFLoader().loadAsync(`${BASE}models/player.glb`);
        const cfg = await fetch(`${BASE}models/clips.json`).then((r) => r.json()).catch(() => ({})); // a missing file may come back as a web page: that simply fails to parse
        const box = new THREE.Box3().setFromObject(gltf.scene), h = box.max.y - box.min.y;
        if (!(h > 0)) throw new Error('empty model');
        const names = gltf.animations.map((a) => a.name);
        console.info('[Cric365] character loaded. Animation names found:', names);
        return { gltf, cfg, scale: 1.8 / h, lift: -box.min.y * (1.8 / h), names };
      } catch (e) {
        console.info('[Cric365] no character model (public/models/player.glb), using the built-in players.', e && e.message);
        return null;
      }
    })();
  }
  return pending;
}

const resolveClip = (char, key, seen = new Set()) => {
  if (seen.has(key)) return null; seen.add(key);
  const clips = char.gltf.animations, want = char.cfg[key];
  let c = want && clips.find((a) => a.name === want);
  if (!c && WORDS[key]) c = clips.find((a) => WORDS[key].test(a.name));
  if (c) return c;
  for (const alt of FALLBACK[key] || []) { c = resolveClip(char, alt, seen); if (c) return c; }
  return null;
};

// One animated person. play('run'), play('swing', { loop: false, duration: 0.8 }) ...
export function createActor(char, { color, bat = false, scale = 1 } = {}) {
  const root = new THREE.Group();
  const model = cloneSkinned(char.gltf.scene);
  model.scale.setScalar(char.scale * scale); model.position.y = char.lift * scale; root.add(model);
  const tint = new RegExp(char.cfg.tint || 'shirt|jersey|top|torso|body|cloth|upper|outfit', 'i');
  const mats = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (color && o.material && tint.test(`${o.material.name} ${o.name}`)) { o.material = o.material.clone(); o.material.color.set(color); mats.push(o.material); }
  });
  if (bat && char.cfg.bat !== false) { // a bat in the right hand; adjust with "batOffset" in clips.json if it sits wrong on your rig
    let hand = null; model.traverse((o) => { if (o.isBone && /right.?hand$/i.test(o.name)) hand = o; });
    if (hand) {
      const g = new THREE.Group(), off = char.cfg.batOffset || {};
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 0.55 })); blade.position.y = 0.28; blade.castShadow = true; g.add(blade);
      const wp = new THREE.Vector3(); hand.getWorldScale(wp); g.scale.setScalar(1 / (wp.x || 1)); // undo the bone's own scale (many rigs use centimetres)
      const [px, py, pz] = off.pos || [0, 0, 0], [rx, ry, rz] = off.rot || [0, 0, 1.2];
      g.position.set(px, py, pz); g.rotation.set(rx, ry, rz); hand.add(g);
    }
  }
  const mixer = new THREE.AnimationMixer(model), actions = {};
  const get = (key) => { if (!(key in actions)) { const c = resolveClip(char, key); actions[key] = c ? mixer.clipAction(c) : null; } return actions[key]; };
  let cur = null;
  const play = (key, { loop = true, fade = 0.25, speed = 1, duration = 0, offset = 0 } = {}) => {
    const a = get(key); if (!a) return false;
    a.reset(); a.enabled = true; a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true;
    a.timeScale = duration ? a.getClip().duration / duration : speed; a.time = offset * a.getClip().duration;
    if (cur && cur !== a) cur.fadeOut(fade);
    a.fadeIn(fade).play(); cur = a; return true;
  };
  return { root, model: true, play, has: (k) => !!get(k), update: (dt) => mixer.update(dt), mats, dispose: () => { mixer.stopAllAction(); mats.forEach((m) => m.dispose()); } };
}
