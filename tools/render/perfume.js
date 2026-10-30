// L&R Parfums — "La esencia de Oriente": procedural dusk world of 8-point-star islands.
// window.renderAt(T) renders the film at time T; ?bottle=<handle> renders one product bottle (transparent).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1920, H = +q.get('h') || 1080;
const PORTRAIT = H > W;
const BOTTLE = q.get('bottle');

const DIVE = 7, CONN = 4, FPS = 30, N = 6;
const SEGS = [];
let tAcc = 0;
for (let i = 0; i < N; i++) {
  SEGS.push({ kind: 'dive', i, t0: tAcc, t1: tAcc + DIVE }); tAcc += DIVE;
  if (i < N - 1) { SEGS.push({ kind: 'conn', i, t0: tAcc, t1: tAcc + CONN }); tAcc += CONN; }
}
window.FILM = { SEGS, FPS, TOTAL: tAcc };

const renderer = new THREE.WebGLRenderer({ antialias: !!BOTTLE, alpha: !!BOTTLE, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const BG = 0x1A0A0F;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = BOTTLE ? 0.55 : 0.18;

const camera = new THREE.PerspectiveCamera(PORTRAIT ? 58 : 34, W / H, 0.3, 900);

// ---------- materials & helpers ----------
const anims = [];
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0.02, flatShading: true, ...o });
const E = (c, i = 2.2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });
const GLOW = (c, o = 0.35) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
const GOLD = new THREE.MeshStandardMaterial({ color: 0xD8A84E, metalness: 1, roughness: 0.28 });
const GOLD_F = new THREE.MeshStandardMaterial({ color: 0xD8A84E, metalness: 1, roughness: 0.3, flatShading: true });
function add(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = shadow; parent.add(m); return m;
}
let seed = 4242;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const V2 = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(p => V2(p[0], p[1])), seg);

// ---------- perfume bottle factory ----------
const PROFILES = {
  round: [[0, 0], [0.42, 0], [0.56, 0.08], [0.62, 0.32], [0.58, 0.58], [0.42, 0.74], [0.2, 0.8]],
  drop: [[0, 0], [0.3, 0], [0.5, 0.12], [0.58, 0.34], [0.5, 0.6], [0.3, 0.8], [0.16, 0.9]],
  flask: [[0, 0], [0.5, 0], [0.56, 0.06], [0.56, 0.5], [0.46, 0.66], [0.2, 0.76]],
};
function makeBottle(o, scale = 1) {
  const g = new THREE.Group();
  const liq = new THREE.Color(o.liq), glassC = new THREE.Color(o.glass || '#FFFFFF');
  const glass = new THREE.MeshStandardMaterial({ color: glassC, transparent: true, opacity: o.glass === '#2A1A12' ? 0.62 : 0.16, roughness: 0.02, metalness: 0.3, envMapIntensity: 3.0, depthWrite: false });
  const liquid = new THREE.MeshStandardMaterial({ color: liq, emissive: liq, emissiveIntensity: 0.12, roughness: 0.12, metalness: 0.05 });
  let body, inner, neckY;
  if (PROFILES[o.shape]) {
    const pr = PROFILES[o.shape];
    body = lathe(pr, o.shape === 'flask' ? 8 : 28);
    inner = lathe(pr.map(([x, y]) => [x * 0.86, y * 0.8 + 0.03]), o.shape === 'flask' ? 8 : 28);
    neckY = pr[pr.length - 1][1];
  } else if (o.shape === 'square') {
    body = new THREE.BoxGeometry(1.0, 0.82, 0.52); body.translate(0, 0.41, 0);
    inner = new THREE.BoxGeometry(0.86, 0.66, 0.4); inner.translate(0, 0.38, 0);
    neckY = 0.82;
  } else if (o.shape === 'tall') {
    body = new THREE.CylinderGeometry(0.4, 0.44, 1.05, 6); body.translate(0, 0.525, 0);
    inner = new THREE.CylinderGeometry(0.33, 0.37, 0.85, 6); inner.translate(0, 0.47, 0);
    neckY = 1.05;
  } else {
    body = new THREE.CylinderGeometry(0.5, 0.5, 0.86, 8); body.translate(0, 0.43, 0);
    inner = new THREE.CylinderGeometry(0.42, 0.42, 0.7, 8); inner.translate(0, 0.4, 0);
    neckY = 0.86;
  }
  add(inner, liquid, 0, 0, 0, g, false);
  const lblMat = new THREE.MeshStandardMaterial({ color: 0xF6EBD6, roughness: 0.6 });
  if (o.shape === 'round' || o.shape === 'drop') {
    const bandY = o.shape === 'round' ? 0.32 : 0.34, bandR = o.shape === 'round' ? 0.625 : 0.585;
    add(new THREE.CylinderGeometry(bandR, bandR, 0.05, 28, 1, true), GOLD, 0, bandY, 0, g, false);
  } else {
    const fz = o.shape === 'square' ? 0.27 : o.shape === 'tall' ? 0.37 : o.shape === 'flask' ? 0.56 * Math.cos(Math.PI / 8) + 0.01 : 0.5 * Math.cos(Math.PI / 8) + 0.01;
    add(new THREE.BoxGeometry(0.44, 0.3, 0.012), GOLD, 0, neckY * 0.48, fz, g, false);
    add(new THREE.BoxGeometry(0.4, 0.26, 0.014), lblMat, 0, neckY * 0.48, fz + 0.002, g, false);
  }
  const shell = add(body, glass, 0, 0, 0, g, false); shell.renderOrder = 2;
  add(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 16), GOLD, 0, neckY + 0.06, 0, g, false);
  let cap;
  const cy = neckY + 0.12;
  switch (o.cap) {
    case 'crystal': cap = add(new THREE.OctahedronGeometry(0.3, 0), GOLD_F, 0, cy + 0.3, 0, g); cap.scale.set(0.8, 1.2, 0.8); break;
    case 'cyl': cap = add(new THREE.CylinderGeometry(0.24, 0.24, 0.42, 20), GOLD, 0, cy + 0.21, 0, g); break;
    case 'facet': cap = add(new THREE.DodecahedronGeometry(0.28, 0), GOLD_F, 0, cy + 0.26, 0, g); break;
    case 'crown': cap = add(new THREE.CylinderGeometry(0.08, 0.3, 0.46, 8), GOLD_F, 0, cy + 0.23, 0, g); break;
    case 'sphere': cap = add(new THREE.SphereGeometry(0.25, 24, 16), GOLD, 0, cy + 0.24, 0, g); break;
    default: cap = add(lathe([[0, 0], [0.26, 0], [0.26, 0.12], [0.18, 0.3], [0.05, 0.42], [0, 0.5]], 20), GOLD, 0, cy, 0, g);
  }
  g.scale.setScalar(scale);
  return g;
}

// ---------- single-bottle product render ----------
if (BOTTLE) {
  await new Promise(r => { const s = document.createElement('script'); s.src = './catalog.js'; s.onload = r; document.head.appendChild(s); });
  scene.background = null;
  const prod = window.CATALOG.find(p => p.h === BOTTLE);
  camera.fov = 22; camera.aspect = W / H; camera.updateProjectionMatrix();
  camera.position.set(1.0, 1.35, 5.2); camera.lookAt(0, 0.78, 0);
  scene.add(new THREE.HemisphereLight(0xFFF1DE, 0x3A1A20, 0.6));
  const key = new THREE.DirectionalLight(0xFFE6C4, 2.0); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xFFC08A, 1.6); rim.position.set(-4, 2, -3); scene.add(rim);
  if (prod.c === 'mayor') {
    const crate = new THREE.Group(); scene.add(crate);
    add(new THREE.BoxGeometry(2.2, 0.7, 1.3), M(0x8A5A3A), 0, 0.35, 0, crate);
    const cols = ['#E58FA6', '#B9824A', '#4FA7C9', '#8C4A1E', '#8DBA5A', '#D9B54A'];
    for (let a = 0; a < 5; a++) for (let b = 0; b < 3; b++) {
      const bt = makeBottle({ shape: ['round', 'tall', 'oct', 'square', 'drop', 'flask'][(a + b) % 6], cap: 'dome', liq: cols[(a * 3 + b) % 6] }, 0.42);
      bt.position.set(-0.8 + a * 0.4, 0.62, -0.38 + b * 0.38); crate.add(bt);
    }
    crate.position.y = 0.0; crate.rotation.y = -0.3; camera.position.set(2.1, 2.1, 4.8); camera.lookAt(0, 0.5, 0);
  } else {
    const b = makeBottle(prod, 1); b.rotation.y = -0.12; scene.add(b);
  }
  window.renderBottle = () => { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); };
  window.READY = true;
} else {
  buildWorld();
}

function buildWorld() {
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 70, 220);
  if (PORTRAIT) camera.setViewOffset(W, H * 1.32, 0, H * 0.32, W, H);
  else camera.setViewOffset(W * 1.26, H, 0, 0, W, H);
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.45, 0.93));
  composer.addPass(new OutputPass());

  scene.add(new THREE.HemisphereLight(0xFFCFA8, 0x2A0F18, 0.55));
  const sun = new THREE.DirectionalLight(0xFFD7A6, 1.7);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const rimL = new THREE.DirectionalLight(0xC96A8A, 1.0); scene.add(rimL, rimL.target);

  // 8-point star (Rub el Hizb) island
  function starShape(r) {
    const s = new THREE.Shape();
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8 + Math.PI / 16, rr = k % 2 ? r * 0.84 : r;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      k ? s.lineTo(x, y) : s.moveTo(x, y);
    }
    return s;
  }
  function makeIsland(C, r, accent) {
    const g = new THREE.Group(); g.position.copy(C); scene.add(g);
    const geo = new THREE.ExtrudeGeometry(starShape(r), { depth: 1.6, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    const slab = new THREE.Mesh(geo, [M(0xC9AE86), M(0x6A2E26)]);
    slab.castShadow = slab.receiveShadow = true; g.add(slab);
    const inGeo = new THREE.ExtrudeGeometry(starShape(r * 0.8), { depth: 0.05, bevelEnabled: false }); inGeo.rotateX(Math.PI / 2);
    add(inGeo, M(0xBDA07A), 0, 0.05, 0, g).castShadow = false;
    const rim = starShape(r + 0.08); rim.holes.push(new THREE.Path(starShape(r - 0.06).getPoints()));
    const rg = new THREE.ExtrudeGeometry(rim, { depth: 0.16, bevelEnabled: false }); rg.rotateX(Math.PI / 2);
    add(rg, E(accent, 1.3), 0, 0.06, 0, g, false);
    const rock = add(new THREE.ConeGeometry(r * 0.82, r * 1.1, 8, 2), M(0x3A1820), 0, -1.6 - r * 0.55, 0, g, false);
    rock.rotation.x = Math.PI;
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + 0.4, rr = r * (0.4 + 0.25 * rnd());
      add(new THREE.DodecahedronGeometry(0.6 + rnd() * 0.9, 0), M(0x4A2028), Math.cos(a) * rr, -3 - rnd() * 4, Math.sin(a) * rr, g, false);
    }
    return g;
  }
  function palm(g, x, z, h = 4, lean = 0.15) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.z = lean; g.add(p);
    for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(0.16, 0.2, h / 6, 6), M(0x8A6240), Math.sin(k * 0.3) * 0.1, h / 12 + k * h / 6, 0, p);
    for (let k = 0; k < 7; k++) {
      const leaf = add(new THREE.ConeGeometry(0.35, 2.4, 4), M(0x3F7A55), 0, h, 0, p);
      leaf.rotation.set(Math.PI / 2 - 0.5, k * Math.PI * 2 / 7, 0, 'YXZ'); leaf.translateY(1.0); leaf.scale.set(1, 1, 0.25);
    }
  }
  function lantern(g, x, y, z, c = 0xFFB55A) {
    const l = new THREE.Group(); l.position.set(x, y, z); g.add(l);
    add(new THREE.CylinderGeometry(0.2, 0.28, 0.5, 6), E(c, 2.4), 0, 0, 0, l, false);
    add(new THREE.ConeGeometry(0.3, 0.3, 6), GOLD_F, 0, 0.4, 0, l, false);
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 6), GOLD_F, 0, -0.27, 0, l, false);
    return l;
  }
  const onion = (r) => lathe([[0, 0], [r, 0], [r * 1.12, r * 0.45], [r * 0.9, r * 0.95], [r * 0.4, r * 1.35], [r * 0.08, r * 1.7], [0, 1.85 * r]], 20);

  const C = [
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(48, 5, -16), new THREE.Vector3(96, -2, 6),
    new THREE.Vector3(144, 4, -14), new THREE.Vector3(192, 0, 8), new THREE.Vector3(240, 5, -10),
  ];
  const ACC = [0xD8A84E, 0xE8A07A, 0xE58FA6, 0xF0B45A, 0x5FC3D9, 0xD8A84E];
  const R = [12.5, 11.5, 12, 12.5, 12, 12.5];
  const FOCAL_Y = [4.2, 2.6, 2.6, 3.4, 2.4, 2.4];
  const isl = C.map((c, i) => makeIsland(c, R[i], ACC[i]));

  // ===== 0 · palace =====
  {
    const g = isl[0];
    add(new THREE.CylinderGeometry(4.2, 4.4, 0.6, 8), M(0xE9D9BE), 0, 0.3, -1, g);
    add(new THREE.CylinderGeometry(3.3, 3.3, 3.2, 8), M(0xF3E6CF), 0, 2.2, -1, g);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8;
      const ar = add(new THREE.BoxGeometry(1.0, 1.8, 0.2), M(0x5A2430), Math.cos(a) * 3.12, 1.9, -1 + Math.sin(a) * 3.12, g, false);
      ar.rotation.y = -a + Math.PI / 2;
      const top = add(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 12, 1, false, 0, Math.PI), M(0x5A2430), Math.cos(a) * 3.12, 2.8, -1 + Math.sin(a) * 3.12, g, false);
      top.rotation.set(Math.PI / 2, 0, -a);
    }
    add(new THREE.CylinderGeometry(3.45, 3.45, 0.3, 8), GOLD_F, 0, 3.9, -1, g);
    add(onion(2.7), GOLD, 0, 4.0, -1, g);
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), GOLD, 0, 9.6, -1, g);
    const cres = add(new THREE.TorusGeometry(0.35, 0.07, 6, 16, Math.PI * 1.4), GOLD, 0, 10.4, -1, g, false); cres.rotation.z = 0.8;
    [[-6, -5], [6, -5], [-6.5, 3], [6.5, 3]].forEach(([x, z]) => {
      add(new THREE.CylinderGeometry(0.5, 0.6, 7, 8), M(0xF3E6CF), x, 3.5, z, g);
      add(new THREE.CylinderGeometry(0.8, 0.8, 0.25, 8), GOLD_F, x, 5.6, z, g);
      add(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 8), M(0xF3E6CF), x, 6.6, z, g);
      add(onion(0.55), GOLD, x, 7.1, z, g);
    });
    add(new THREE.BoxGeometry(3.2, 0.12, 6.5), M(0x2E8C8A, { roughness: 0.15, metalness: 0.3, flatShading: false }), 0, 0.07, 6.2, g, false);
    for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.35, 0.25, 0.12, 8), M(0xF0B3C3), -0.7 + (k % 2) * 1.4, 0.16, 4.2 + k * 1.3, g, false);
    const hero = makeBottle({ shape: 'round', cap: 'crystal', liq: '#E0A24A' }, 3.2);
    hero.position.set(4.6, 0.4, 4.4); g.add(hero);
    add(new THREE.CylinderGeometry(2.0, 2.2, 0.4, 8), GOLD_F, 4.6, 0.2, 4.4, g);
    anims.push(T => { hero.rotation.y = T * 0.35; });
    [[-9, 2, 4.4, 0.18], [-8, -7, 3.8, -0.12], [9, -4, 4.6, -0.15], [-3, 9, 3.6, 0.2], [2.5, -8.5, 3.4, 0.1]].forEach(p => palm(g, ...p));
    const ls = [[-2.4, 3.6, 3.2], [2.4, 3.6, 3.2], [-4.5, 1.4, 6.5], [-4.5, 1.4, 9]].map(p => lantern(g, ...p));
    anims.push(T => ls.forEach((l, k) => { l.children[0].material.emissiveIntensity = 1.8 + 0.6 * Math.sin(T * 3 + k); }));
  }

  // ===== 1 · gourmand patisserie =====
  {
    const g = isl[1];
    const mac = (x, y, z, c, s = 1, parent = g) => {
      const m = new THREE.Group(); m.position.set(x, y, z); m.scale.setScalar(s); parent.add(m);
      const sh = new THREE.SphereGeometry(0.7, 20, 10); sh.scale(1, 0.38, 1);
      add(sh, M(c, { flatShading: false, roughness: 0.7 }), 0, 0.42, 0, m); add(sh, M(c, { flatShading: false, roughness: 0.7 }), 0, 0.06, 0, m);
      add(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 20), M(0xFFF3E0, { flatShading: false }), 0, 0.24, 0, m);
      return m;
    };
    const tower = new THREE.Group(); tower.position.set(-2.5, 0, -2); g.add(tower);
    add(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), GOLD, 0, 3.6, 0, tower);
    const mcol = [0x9CCB6B, 0xF2A7B8, 0x7A4A2E, 0xF3D27A, 0xC9A6E0];
    for (let lvl = 0; lvl < 6; lvl++) {
      const r = 2.4 - lvl * 0.36, n = Math.max(4, Math.round(r * 4));
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + lvl * 0.3; mac(Math.cos(a) * r, 0.3 + lvl * 1.0, Math.sin(a) * r, mcol[(k + lvl) % 5], 0.75, tower); }
    }
    anims.push(T => { tower.rotation.y = T * 0.25; });
    const ecl = new THREE.Group(); ecl.position.set(3.5, 0.9, 4.5); ecl.rotation.y = 0.5; g.add(ecl);
    const cap = new THREE.CapsuleGeometry(0.75, 3.6, 8, 16); cap.rotateZ(Math.PI / 2);
    add(cap, M(0xD9A35B, { flatShading: false }), 0, 0, 0, ecl);
    const top = new THREE.CapsuleGeometry(0.62, 3.4, 8, 16); top.rotateZ(Math.PI / 2); top.scale(1, 0.45, 1.05);
    add(top, M(0x8DBA5A, { flatShading: false, roughness: 0.35 }), 0, 0.5, 0, ecl);
    for (let k = 0; k < 6; k++) add(new THREE.TetrahedronGeometry(0.1, 0), M(0x5E8C3A), -1.6 + k * 0.6, 0.8, (k % 2 - 0.5) * 0.3, ecl, false);
    add(new THREE.CylinderGeometry(2.6, 2.8, 0.2, 24), M(0xF7EFE4, { flatShading: false }), 3.5, 0.1, 4.5, g);
    const cup = new THREE.Group(); cup.position.set(5.8, 0, -3.5); g.add(cup);
    add(new THREE.CylinderGeometry(2.0, 1.7, 0.18, 28), M(0xF4ECE0, { flatShading: false }), 0, 0.09, 0, cup);
    add(lathe([[0, 0.18], [1.0, 0.2], [1.35, 0.8], [1.5, 2.0], [1.4, 2.0], [1.25, 0.9], [0, 0.4]], 28), M(0xF4ECE0, { flatShading: false, side: THREE.DoubleSide }), 0, 0, 0, cup);
    add(new THREE.CylinderGeometry(1.36, 1.36, 0.05, 28), M(0x4A2614, { roughness: 0.2, flatShading: false }), 0, 1.8, 0, cup, false);
    const handle = add(new THREE.TorusGeometry(0.5, 0.12, 8, 16, Math.PI * 1.3), M(0xF4ECE0, { flatShading: false }), 1.55, 1.15, 0, cup); handle.rotation.z = -0.6 - Math.PI / 2;
    const steam = [];
    for (let k = 0; k < 6; k++) steam.push(add(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.2, depthWrite: false }), 0, 2, 0, cup, false));
    anims.push(T => steam.forEach((s, k) => { const u = (T * 0.3 + k / 6) % 1; s.position.set(Math.sin(u * 6 + k) * 0.3, 2 + u * 3.2, Math.cos(u * 5 + k) * 0.2); s.scale.setScalar(0.6 + u * 1.2); s.material.opacity = 0.22 * (1 - u); }));
    const stall = new THREE.Group(); stall.position.set(-6, 0, 4); stall.rotation.y = 0.6; g.add(stall);
    add(new THREE.BoxGeometry(4.2, 1.2, 1.6), M(0xF3E6CF), 0, 0.6, 0, stall);
    [[-1.9, 0.6], [1.9, 0.6], [-1.9, -0.6], [1.9, -0.6]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.07, 0.07, 3, 6), GOLD, x, 1.5, z, stall));
    for (let k = 0; k < 7; k++) { const st = add(new THREE.BoxGeometry(0.62, 0.1, 2.1), M(k % 2 ? 0xF7EFE4 : 0xC9505E), -1.86 + k * 0.62, 3.05, 0.1, stall); st.rotation.x = -0.25; }
    [['#D9A35B', 'round', 'dome'], ['#8DBA5A', 'tall', 'crystal'], ['#6B3E22', 'square', 'facet']].forEach(([liq, shape, capT], k) => {
      const b = makeBottle({ liq, shape, cap: capT }, 1.1); b.position.set(-1.2 + k * 1.2, 1.2, 0); stall.add(b);
    });
    [[8.6, 3.5], [-8, -4]].forEach(([x, z]) => palm(g, x, z, 3.6, 0.12));
    mac(-6, 0, -5.5, 0xF2A7B8, 1.4); mac(1.5, 0, -7.5, 0x9CCB6B, 1.3); mac(8.5, 0, -0.5, 0x7A4A2E, 1.2);
  }

  // ===== 2 · rose garden =====
  {
    const g = isl[2];
    const ft = new THREE.Group(); g.add(ft);
    add(new THREE.CylinderGeometry(3.6, 3.8, 0.7, 16), M(0xF1E4CF), 0, 0.35, 0, ft);
    add(new THREE.CylinderGeometry(3.3, 3.3, 0.1, 16), M(0x5FC3D9, { roughness: 0.1, metalness: 0.2, flatShading: false }), 0, 0.68, 0, ft, false);
    add(lathe([[0, 0], [0.5, 0], [0.35, 1.4], [1.7, 1.6], [1.8, 1.9], [0.3, 1.9], [0.25, 3], [1.0, 3.1], [1.05, 3.35], [0.2, 3.35], [0.15, 4.2], [0, 4.3]], 16), M(0xF7EEE0), 0, 0.6, 0, ft);
    const jets = [];
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      jets.push(add(new THREE.SphereGeometry(0.12, 6, 6), GLOW(0xBFF3FF, 0.6), Math.cos(a) * 1.7, 2.4, Math.sin(a) * 1.7, ft, false));
    }
    anims.push(T => jets.forEach((j, k) => { const u = (T * 0.8 + k / 8) % 1, a = k * Math.PI / 4; j.position.set(Math.cos(a) * (1.8 + u * 1.2), 2.4 - u * u * 1.7, Math.sin(a) * (1.8 + u * 1.2)); }));
    const rose = (x, z, s = 1, col = 0xE5738F) => {
      add(new THREE.SphereGeometry(0.9 * s, 8, 6), M(0x3F7A55), x, 0.75 * s, z, g);
      for (let k = 0; k < 9; k++) add(new THREE.IcosahedronGeometry(0.34 * s, 0), M(k % 2 ? col : 0xF2A7B8), x + Math.cos(k * 0.7) * 0.62 * s, 1.0 * s + (k % 3) * 0.32 * s, z + Math.sin(k * 0.7) * 0.62 * s, g);
    };
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; rose(Math.cos(a) * 6, Math.sin(a) * 6, 1, [0xE5738F, 0xC9505E, 0xF7C6D0][k % 3]); }
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 8.6, z = Math.sin(a) * 8.6;
      const ar = new THREE.Group(); ar.position.set(x, 0, z); ar.rotation.y = -a; g.add(ar);
      add(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 6), M(0xF7EEE0), 0, 1.4, -1, ar); add(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 6), M(0xF7EEE0), 0, 1.4, 1, ar);
      const top = add(new THREE.TorusGeometry(1, 0.12, 6, 16, Math.PI), M(0xF7EEE0), 0, 2.8, 0, ar); top.rotation.y = Math.PI / 2;
      for (let f = 0; f < 6; f++) add(new THREE.IcosahedronGeometry(0.22, 0), M(0xF2A7B8), 0, 2.8 + Math.sin(f / 5 * Math.PI) * 1.0, -1 + f * 0.4, ar, false);
    }
    [['#F29BB8', 'drop', 'crystal'], ['#E7889C', 'round', 'sphere'], ['#F0B3C3', 'oct', 'dome']].forEach(([liq, shape, cap], k) => {
      const x = 4.5 + k * 1.9, z = 4.5 - k * 1.4;
      add(new THREE.CylinderGeometry(0.75, 0.85, 0.9, 8), M(0xF7EEE0), x, 0.45, z, g);
      const b = makeBottle({ liq, shape, cap }, 1.3); b.position.set(x, 0.9, z); g.add(b);
      anims.push(T => { b.rotation.y = T * 0.4 + k; });
    });
    const petals = [];
    for (let k = 0; k < 18; k++) petals.push(add(new THREE.CircleGeometry(0.16, 5), new THREE.MeshStandardMaterial({ color: 0xF2A7B8, side: THREE.DoubleSide }), 0, 0, 0, g, false));
    anims.push(T => petals.forEach((p, k) => { const u = (T * 0.12 + k / 18) % 1; p.position.set(-8 + (k * 7.3) % 16 + Math.sin(T + k) * 0.8, 9 - u * 9, -6 + (k * 3.7) % 12); p.rotation.set(T * 2 + k, T + k, 0); }));
  }

  // ===== 3 · oud night oasis =====
  {
    const g = isl[3];
    for (let k = 0; k < 5; k++) { const d = add(new THREE.SphereGeometry(3 + rnd() * 2, 10, 6), M(0xD9B98C), -7 + k * 3.6, -1.2, -6.5 + (k % 2) * 1.5, g); d.scale.set(1, 0.35, 0.7); }
    const tent = new THREE.Group(); tent.position.set(-2.5, 0, -1); g.add(tent);
    add(new THREE.ConeGeometry(4, 3.6, 8, 1, true), M(0x7A2E3A, { side: THREE.DoubleSide }), 0, 3.4, 0, tent);
    add(new THREE.CylinderGeometry(4, 4, 1.6, 8, 1, true), M(0x8A3A44, { side: THREE.DoubleSide }), 0, 0.8, 0, tent);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; add(new THREE.BoxGeometry(0.1, 1.62, 0.1), GOLD_F, Math.cos(a) * 4.02, 0.8, Math.sin(a) * 4.02, tent, false); }
    const tl = new THREE.PointLight(0xFFAA55, 30, 12, 2); tl.position.set(0, 1.4, 0); tent.add(tl);
    add(new THREE.SphereGeometry(0.5, 12, 10), E(0xFFB55A, 2.6), 0, 1.0, 0, tent, false);
    const moon = new THREE.Group(); moon.position.set(4, 9.5, -7); g.add(moon);
    const ms = new THREE.Shape(); ms.absarc(0, 0, 2.4, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(1.0, 0.5, 2.1, 0, Math.PI * 2, true); ms.holes.push(hole);
    add(new THREE.ExtrudeGeometry(ms, { depth: 0.6, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2, curveSegments: 40 }), E(0xFFE2A8, 1.5), 0, 0, 0, moon, false);
    anims.push(T => { moon.rotation.y = Math.sin(T * 0.4) * 0.35; moon.position.y = 9.5 + Math.sin(T * 0.8) * 0.3; });
    const stars = [[-6, 9, -4], [-4, 10.5, -5], [-2, 9.5, -3.5], [-5, 7.5, -2], [0.5, 12, -5], [2, 8.5, -2.5]];
    const sm = stars.map(p => add(new THREE.OctahedronGeometry(0.22, 0), E(0xFFF2C4, 3), ...p, g, false));
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([0, 1, 2, 3, 0, 2, 5, 4].map(k => new THREE.Vector3(...stars[k]))), new THREE.LineBasicMaterial({ color: 0xFFE2A8, transparent: true, opacity: 0.35 }));
    g.add(ln);
    anims.push(T => sm.forEach((s, k) => { s.material.emissiveIntensity = 1.5 + 1.5 * (0.5 + 0.5 * Math.sin(T * 2.5 + k * 1.9)); s.rotation.y = T; }));
    const burner = new THREE.Group(); burner.position.set(3.5, 0, 3.5); g.add(burner);
    add(lathe([[0, 0], [0.9, 0], [0.4, 0.6], [0.4, 1.2], [1.1, 1.5], [1.2, 2.0], [0, 2.0]], 8), GOLD_F, 0, 0, 0, burner);
    add(new THREE.ConeGeometry(0.9, 1.2, 8), GOLD_F, 0, 2.6, 0, burner);
    add(new THREE.SphereGeometry(0.15, 8, 6), GOLD, 0, 3.3, 0, burner);
    const smoke = [];
    for (let k = 0; k < 8; k++) smoke.push(add(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xE8D6C4, transparent: true, opacity: 0.18, depthWrite: false }), 0, 3, 0, burner, false));
    anims.push(T => smoke.forEach((s, k) => { const u = (T * 0.22 + k / 8) % 1; s.position.set(Math.sin(u * 7 + k) * (0.3 + u), 3.3 + u * 6, Math.cos(u * 5 + k) * 0.4 * u); s.scale.setScalar(0.5 + u * 2); s.material.opacity = 0.2 * (1 - u); }));
    for (let k = 0; k < 7; k++) { const w = add(new THREE.BoxGeometry(0.9, 0.25, 0.3), M(0x5A2E1A), 5.5 + (k % 3) * 0.5, 0.15 + Math.floor(k / 3) * 0.26, 1 + (k % 2) * 0.4, g); w.rotation.y = k; }
    [['#7A3514', 'square', 'crown', '#2A1A12'], ['#B8862E', 'oct', 'facet', '#FFFFFF'], ['#D9DCEB', 'drop', 'crystal', '#FFFFFF'], ['#3E4FA3', 'tall', 'cyl', '#FFFFFF']].forEach(([liq, shape, cap, glass], k) => {
      const x = 0.5 + k * 1.6, z = 6.5 - k * 0.5;
      add(new THREE.CylinderGeometry(0.7, 0.8, 0.5, 8), M(0x5A2430), x, 0.25, z, g);
      const b = makeBottle({ liq, shape, cap, glass }, 1.25); b.position.set(x, 0.5, z); b.rotation.y = k; g.add(b);
    });
    [[-7.5, 4], [-5, 7], [8, -3.5]].forEach(([x, z], k) => { const l = lantern(g, x, 0.3, z); l.scale.setScalar(1.6); });
    [[-9, -1.5, 4.2, 0.15], [9.2, 2.5, 3.8, -0.18]].forEach(p => palm(g, ...p));
  }

  // ===== 4 · citrus terrace =====
  {
    const g = isl[4];
    add(new THREE.BoxGeometry(9, 0.14, 4.6), M(0x3FB6CC, { roughness: 0.1, metalness: 0.25, flatShading: false }), 1, 0.08, 4.6, g, false);
    add(new THREE.BoxGeometry(9.6, 0.4, 0.3), M(0xF7EEE0), 1, 0.2, 2.15, g); add(new THREE.BoxGeometry(9.6, 0.4, 0.3), M(0xF7EEE0), 1, 0.2, 7.05, g);
    const ripples = [0, 1, 2].map(k => { const r = add(new THREE.RingGeometry(0.5, 0.6, 32), GLOW(0xE0FBFF, 0.4), 1 + k * 2 - 2, 0.17, 4.6, g, false); r.rotation.x = -Math.PI / 2; return r; });
    anims.push(T => ripples.forEach((r, k) => { const u = (T * 0.35 + k / 3) % 1; r.scale.setScalar(1 + u * 3); r.material.opacity = 0.4 * (1 - u); }));
    const citrus = (x, z, fc) => {
      add(new THREE.CylinderGeometry(0.9, 0.7, 1, 8), M(0xC9653E), x, 0.5, z, g);
      add(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6), M(0x7A5A3A), x, 1.8, z, g);
      add(new THREE.IcosahedronGeometry(1.5, 1), M(0x4E8F50), x, 3.4, z, g);
      for (let k = 0; k < 9; k++) add(new THREE.SphereGeometry(0.22, 10, 8), M(fc, { flatShading: false, roughness: 0.5 }), x + Math.cos(k * 2.4) * 1.35, 3.3 + Math.sin(k * 1.7) * 0.8, z + Math.sin(k * 2.4) * 1.35, g, false);
    };
    citrus(-6, -3.5, 0xF2D33A); citrus(-1.5, -6.5, 0xF2984A); citrus(4, -6, 0xF2D33A); citrus(7.5, -1.5, 0xF2984A);
    const cab = new THREE.Group(); cab.position.set(-6.5, 0, 3.5); g.add(cab);
    for (let k = 0; k < 5; k++) { const s = add(new THREE.BoxGeometry(0.7, 0.1, 3.2), M(k % 2 ? 0xF7EEE0 : 0x3D7BD9), -1.4 + k * 0.7, 2.9, 0, cab); s.rotation.z = 0.08; }
    [[-1.6, -1.4], [1.6, -1.4], [-1.6, 1.4], [1.6, 1.4]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.07, 0.07, 2.9, 6), M(0xF7EEE0), x, 1.45, z, cab));
    add(new THREE.BoxGeometry(2.8, 0.9, 1.0), M(0xF7EEE0), 0, 0.45, 0, cab);
    [['#E9D45A', 'tall', 'cyl'], ['#F2984A', 'flask', 'dome'], ['#3D7BD9', 'square', 'crystal'], ['#8E5BC9', 'oct', 'sphere']].forEach(([liq, shape, cap], k) => {
      const b = makeBottle({ liq, shape, cap }, 0.85); b.position.set(-1.05 + k * 0.7, 0.9, 0); cab.add(b);
    });
    const sail = new THREE.Group(); sail.position.set(4, 0.2, 4.6); g.add(sail);
    add(new THREE.BoxGeometry(2.4, 0.4, 0.9), M(0xF7EEE0), 0, 0.2, 0, sail);
    add(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), M(0x7A5A3A), 0, 1.9, 0, sail);
    const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.05, 0.6, 0), new THREE.Vector3(0.05, 3.3, 0), new THREE.Vector3(1.3, 0.6, 0)]); sg.computeVertexNormals();
    add(sg, new THREE.MeshStandardMaterial({ color: 0xF7EEE0, side: THREE.DoubleSide }), 0, 0, 0, sail);
    anims.push(T => { sail.position.x = 4 + Math.sin(T * 0.5) * 2.2; sail.rotation.z = Math.sin(T * 1.2) * 0.04; });
    const hero = makeBottle({ liq: '#4FA7C9', shape: 'drop', cap: 'crystal' }, 2.2); hero.position.set(5.5, 0, 0.2); g.add(hero);
    add(new THREE.CylinderGeometry(1.4, 1.5, 0.3, 8), M(0xF7EEE0), 5.5, 0.15, 0.2, g);
    anims.push(T => { hero.rotation.y = T * 0.5; });
  }

  // ===== 5 · wholesale =====
  {
    const g = isl[5];
    const crate = new THREE.Group(); crate.position.set(-1.5, 0, 1.5); crate.rotation.y = 0.2; g.add(crate);
    const wood = M(0x9A6A44);
    add(new THREE.BoxGeometry(6.4, 0.3, 3.4), wood, 0, 0.15, 0, crate);
    [[0, 1.6], [0, -1.6]].forEach(([x, z]) => add(new THREE.BoxGeometry(6.4, 1.4, 0.2), wood, x, 0.85, z, crate));
    [[3.1, 0], [-3.1, 0]].forEach(([x, z]) => add(new THREE.BoxGeometry(0.2, 1.4, 3.4), wood, x, 0.85, z, crate));
    const lid = add(new THREE.BoxGeometry(6.4, 0.2, 3.4), wood, 0, 3.4, -2.6, crate); lid.rotation.x = -1.0;
    const cols = ['#E58FA6', '#B9824A', '#4FA7C9', '#8C4A1E', '#8DBA5A', '#D9B54A', '#8E5BC9', '#F2984A'];
    const shapes = ['round', 'tall', 'oct', 'square', 'drop', 'flask'], caps = ['dome', 'crystal', 'cyl', 'facet', 'crown', 'sphere'];
    for (let a = 0; a < 10; a++) for (let b = 0; b < 5; b++) {
      const bt = makeBottle({ liq: cols[(a + b * 3) % 8], shape: shapes[(a * 5 + b) % 6], cap: caps[(a + b) % 6] }, 0.5);
      bt.scale.setScalar(0.6); bt.position.set(-2.7 + a * 0.6, 0.75, -1.25 + b * 0.62); crate.add(bt);
    }
    const sparks = [];
    for (let k = 0; k < 14; k++) sparks.push(add(new THREE.OctahedronGeometry(0.12, 0), E(0xFFD27A, 3), 0, 0, 0, crate, false));
    anims.push(T => sparks.forEach((s, k) => { const u = (T * 0.25 + k / 14) % 1; s.position.set(-2.8 + (k * 0.43) % 5.6, 1.2 + u * 4, -1 + (k * 0.37) % 2); s.scale.setScalar(1 - u); s.rotation.y = T * 2; }));
    const gift = (x, z, s, c) => {
      const b = new THREE.Group(); b.position.set(x, 0, z); g.add(b);
      add(new THREE.BoxGeometry(s, s, s), M(c), 0, s / 2, 0, b);
      add(new THREE.BoxGeometry(s * 1.02, s * 1.02, s * 0.14), GOLD, 0, s / 2, 0, b, false);
      add(new THREE.BoxGeometry(s * 0.14, s * 1.02, s * 1.02), GOLD, 0, s / 2, 0, b, false);
      const bow = add(new THREE.TorusGeometry(s * 0.18, s * 0.05, 6, 12), GOLD, -s * 0.15, s + s * 0.12, 0, b, false); bow.rotation.y = Math.PI / 2;
      const bow2 = add(new THREE.TorusGeometry(s * 0.18, s * 0.05, 6, 12), GOLD, s * 0.15, s + s * 0.12, 0, b, false); bow2.rotation.y = Math.PI / 2;
      return b;
    };
    gift(6.2, -2.0, 2.0, 0x7A2E3A); gift(7.6, 0.6, 1.4, 0xF3E6CF); gift(5.4, 0.9, 1.1, 0x2E5C5A); gift(4.8, 5.0, 1.5, 0x7A2E3A);
    const van = new THREE.Group(); van.position.set(1.5, 0, -6.6); van.rotation.y = -0.2; van.scale.setScalar(0.85); g.add(van);
    add(new THREE.BoxGeometry(4.2, 2.2, 2.0), M(0x7A2E3A), -0.4, 1.5, 0, van);
    add(new THREE.BoxGeometry(1.6, 1.5, 2.0), M(0x7A2E3A), 2.4, 1.15, 0, van);
    add(new THREE.BoxGeometry(0.1, 0.8, 1.7), M(0x2A3A4A, { roughness: 0.1, metalness: 0.4 }), 3.2, 1.5, 0, van, false);
    add(new THREE.BoxGeometry(4.22, 0.2, 2.02), GOLD, -0.4, 1.5, 0, van, false);
    [[-1.6, 1], [-1.6, -1], [2.2, 1], [2.2, -1]].forEach(([x, z]) => { const w = add(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 14), M(0x221418), x, 0.45, z, van); w.rotation.x = Math.PI / 2; });
    anims.push(T => { van.position.y = Math.abs(Math.sin(T * 6)) * 0.03; });
    [[-9, -3, 4, 0.15], [9.4, 3, 3.6, -0.15], [-6, 7.5, 3.4, 0.2]].forEach(p => palm(g, ...p));
  }

  // ---------- golden scent trails, floating lanterns, stars ----------
  function trail(a, b, lift, n = 4, col = 0xFFD27A, rad = 0.06) {
    const m = a.clone().add(b).multiplyScalar(0.5); m.y += lift;
    const curve = new THREE.QuadraticBezierCurve3(a, m, b);
    add(new THREE.TubeGeometry(curve, 80, rad, 5, false), E(0xC98A3A, 1.1), 0, 0, 0, scene, false);
    const ps = [];
    for (let k = 0; k < n; k++) ps.push(add(new THREE.OctahedronGeometry(0.22, 0), E(col, 3), 0, 0, 0, scene, false));
    const spd = 0.05 + rnd() * 0.04, off = rnd();
    anims.push(T => ps.forEach((p, k) => { p.position.copy(curve.getPointAt((T * spd + off + k / n) % 1)); p.rotation.y = T * 2; }));
  }
  for (let i = 0; i < N - 1; i++) trail(C[i].clone().add(new THREE.Vector3(R[i] * 0.75, -1, -4)), C[i + 1].clone().add(new THREE.Vector3(-R[i + 1] * 0.75, -1, -4)), 9, 4);
  for (let k = 0; k < 14; k++) {
    const x = -40 + k * 22 + rnd() * 10, side = k % 2 ? 1 : -1;
    const p = new THREE.Vector3(x, -12 + rnd() * 20, side * (36 + rnd() * 40) - 10);
    const r = 2.2 + rnd() * 2;
    const g = makeIsland(p, r, ACC[k % ACC.length]);
    if (k % 3 === 0) palm(g, 0, 0, 2.6, 0.1);
    else { add(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 1.2, 8), M(0xF3E6CF), 0, 0.6, 0, g); add(onion(r * 0.33), GOLD, 0, 1.2, 0, g); }
  }
  const flo = [];
  for (let k = 0; k < 36; k++) {
    const l = new THREE.Group(); scene.add(l);
    add(new THREE.CylinderGeometry(0.3, 0.42, 0.75, 6), E(0xFFA24A, 2.0), 0, 0, 0, l, false);
    flo.push({ l, x: -30 + rnd() * 320, z: -40 + rnd() * 60, y0: -20 + rnd() * 30, sp: 0.4 + rnd() * 0.5, ph: rnd() * 40 });
  }
  anims.push(T => flo.forEach(f => { const y = ((f.y0 + (T + f.ph) * f.sp) % 50) - 10; f.l.position.set(f.x + Math.sin(T * 0.3 + f.ph) * 1.5, y, f.z); }));
  {
    const n = 1800, pos = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { pos[k * 3] = -160 + rnd() * 560; pos[k * 3 + 1] = -60 + rnd() * 200; pos[k * 3 + 2] = -260 + rnd() * 320; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xFFE3C0, size: 0.4, sizeAttenuation: true, transparent: true, opacity: 0.6, fog: false })));
    const dune = add(new THREE.PlaneGeometry(1400, 600, 60, 30), M(0x2A1218), 120, -48, 0, scene, false);
    dune.rotation.x = -Math.PI / 2;
    const pa = dune.geometry.attributes.position;
    for (let k = 0; k < pa.count; k++) pa.setZ(k, Math.sin(pa.getX(k) * 0.03) * 4 + Math.cos(pa.getY(k) * 0.05) * 3);
    dune.geometry.computeVertexNormals();
  }

  // ---------- camera ----------
  const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeS = x => -(Math.cos(Math.PI * x) - 1) / 2;
  function orbitPose(i, d, el, az, lookY) {
    const c = C[i];
    return { pos: new THREE.Vector3(c.x + Math.sin(az) * d * Math.cos(el), c.y + d * Math.sin(el), c.z + Math.cos(az) * d * Math.cos(el)), look: new THREE.Vector3(c.x, c.y + lookY, c.z) };
  }
  const CLOSE_D = [27, 22, 23, 24, 23, 25];
  const DIVE_FROM = i => (i === 0 ? { d: 60, el: 0.45, az: -0.75, ly: 3 } : { d: 46, el: 0.58, az: -0.6, ly: 1.5 });
  const DIVE_TO = i => ({ d: CLOSE_D[i] * (PORTRAIT ? 1.2 : 1), el: 0.28, az: 0.2, ly: FOCAL_Y[i] });
  function divePose(i, u) {
    const a = DIVE_FROM(i), b = DIVE_TO(i), e = ease(u), lerp = (x, y) => x + (y - x) * e;
    return orbitPose(i, lerp(a.d, b.d), a.el + (b.el - a.el) * Math.min(1, e * 1.08), lerp(a.az, b.az), lerp(a.ly, b.ly));
  }
  function connPose(i, u) {
    const A = divePose(i, 1), B = divePose(i + 1, 0), e = easeS(u);
    const outA = A.pos.clone().sub(C[i]).setY(0).normalize();
    const P1 = A.pos.clone().addScaledVector(outA, 10).add(new THREE.Vector3(6, 16, 0));
    const P2 = B.pos.clone().add(new THREE.Vector3(-14, 10, 6));
    return { pos: new THREE.CubicBezierCurve3(A.pos, P1, P2, B.pos).getPoint(e), look: A.look.clone().lerp(B.look, easeS(Math.min(1, u * 1.15))) };
  }
  function poseAt(T) {
    let s = SEGS[SEGS.length - 1];
    for (const sg of SEGS) if (T >= sg.t0 && T <= sg.t1) { s = sg; break; }
    const u = Math.min(1, Math.max(0, (T - s.t0) / (s.t1 - s.t0)));
    return s.kind === 'dive' ? divePose(s.i, u) : connPose(s.i, u);
  }
  window.renderAt = function (T, quality = 0.93) {
    const p = poseAt(T);
    camera.position.copy(p.pos); camera.lookAt(p.look);
    sun.target.position.copy(p.look); sun.position.copy(p.look).add(new THREE.Vector3(-26, 34, 22));
    rimL.target.position.copy(p.look); rimL.position.copy(p.look).add(new THREE.Vector3(30, 10, -30));
    anims.forEach(f => f(T));
    composer.render();
    return renderer.domElement.toDataURL('image/jpeg', quality);
  };
  window.READY = true;
}
