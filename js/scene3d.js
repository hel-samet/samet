// 3D scenes: an animated samurai-styled character (waves, blinks, breathes, follows the cursor)
// standing on a rock under a red moon, with drifting smoke, falling maple leaves and rising embers.
// Mount with <div class="scene" data-3d="hero|mini"></div>. Falls back to the CSS orb if WebGL is unavailable.
import * as THREE from "three";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

const cssColor = (name) =>
  new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888");

const smooth = (x) => x * x * (3 - 2 * x);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

function radialTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------------ Character */

const PALETTE = {
  skin: 0xe9b98f,
  hair: 0x4a2a18,
  shirt: 0x1f56e0,
  pants: 0x1f2433,
  shoes: 0xf4f5f8,
  dark: 0x1b1b22,
  lip: 0x9b4a3a,
  red: 0xe11d2e,
  white: 0xffffff,
  blush: 0xf29a8a,
};

function buildPerson() {
  const M = {};
  for (const [k, color] of Object.entries(PALETTE)) {
    M[k] = new THREE.MeshStandardMaterial({ color, roughness: k === "dark" ? 0.25 : 0.6, metalness: 0 });
  }
  M.blush.transparent = true;
  M.blush.opacity = 0.45;

  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  const person = new THREE.Group();
  const body = new THREE.Group();
  person.add(body);

  // Legs and shoes
  for (const s of [-1, 1]) {
    add(body, new THREE.CapsuleGeometry(0.16, 0.55, 8, 16), M.pants, s * 0.2, 0.55, 0);
    add(body, new THREE.SphereGeometry(0.2, 24, 16), M.shoes, s * 0.2, 0.1, 0.07).scale.set(1, 0.6, 1.45);
  }
  add(body, new THREE.SphereGeometry(0.36, 32, 16), M.pants, 0, 0.98, 0).scale.set(1, 0.45, 0.7);

  // Torso (pivot at the hips so breathing scales upward)
  const torso = new THREE.Group();
  torso.position.y = 1.0;
  body.add(torso);
  add(torso, new THREE.CapsuleGeometry(0.4, 0.55, 12, 24), M.shirt, 0, 0.55, 0).scale.z = 0.75;
  const collar = add(torso, new THREE.TorusGeometry(0.17, 0.055, 10, 28), M.shirt, 0, 1.2, 0);
  collar.rotation.x = Math.PI / 2;
  add(torso, new THREE.CylinderGeometry(0.12, 0.13, 0.22, 20), M.skin, 0, 1.26, 0);

  // Lanyard and ID badge
  const lanyard = add(torso, new THREE.TorusGeometry(0.22, 0.022, 8, 32, Math.PI), M.red, 0, 1.08, 0.27);
  lanyard.rotation.set(-0.3, 0, Math.PI);
  lanyard.scale.y = 1.6;
  add(torso, new THREE.BoxGeometry(0.2, 0.26, 0.025), M.white, 0, 0.62, 0.31);
  add(torso, new THREE.BoxGeometry(0.2, 0.06, 0.03), M.red, 0, 0.72, 0.315);

  // Arms: shoulder -> elbow pivots
  const arms = {};
  for (const [side, s] of [["left", -1], ["right", 1]]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.47, 1.0, 0);
    torso.add(shoulder);
    add(shoulder, new THREE.SphereGeometry(0.16, 20, 16), M.shirt);
    add(shoulder, new THREE.CapsuleGeometry(0.135, 0.3, 8, 16), M.shirt, 0, -0.22, 0);
    const elbow = new THREE.Group();
    elbow.position.y = -0.46;
    shoulder.add(elbow);
    add(elbow, new THREE.CapsuleGeometry(0.105, 0.32, 8, 16), M.skin, 0, -0.2, 0);
    add(elbow, new THREE.SphereGeometry(0.13, 20, 16), M.skin, 0, -0.44, 0);
    arms[side] = { shoulder, elbow };
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 1.32;
  torso.add(head);
  const face = new THREE.Group();
  face.position.y = 0.45;
  head.add(face);
  add(face, new THREE.SphereGeometry(0.5, 40, 32), M.skin);
  for (const s of [-1, 1]) add(face, new THREE.SphereGeometry(0.1, 16, 12), M.skin, s * 0.49, -0.02, 0);

  // Hair: cap tilted back, plus a swept side fringe
  const cap = add(face, new THREE.SphereGeometry(0.535, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair, 0, 0.03, -0.02);
  cap.rotation.x = -0.35;
  cap.scale.set(1.04, 1, 1.04);
  // Curtain bangs parted in the middle, sweeping down to each side
  for (const s of [-1, 1]) {
    const bang = add(face, new THREE.SphereGeometry(0.26, 24, 16), M.hair, s * 0.2, 0.27, 0.33);
    bang.scale.set(1.05, 0.42, 0.55);
    bang.rotation.z = s * -0.42;
    const side = add(face, new THREE.SphereGeometry(0.2, 20, 14), M.hair, s * 0.43, 0.08, 0.12);
    side.scale.set(0.45, 0.9, 0.7);
  }

  // Face
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = add(face, new THREE.SphereGeometry(0.06, 16, 12), M.dark, s * 0.17, 0.0, 0.46);
    eye.scale.set(1, 1.2, 0.6);
    eyes.push(eye);
    add(face, new THREE.SphereGeometry(0.018, 8, 8), M.white, s * 0.17 + 0.022, 0.03, 0.5);
    const brow = add(face, new THREE.BoxGeometry(0.13, 0.03, 0.03), M.hair, s * 0.17, 0.13, 0.47);
    brow.rotation.z = s * -0.12;
    add(face, new THREE.SphereGeometry(0.07, 16, 12), M.blush, s * 0.28, -0.12, 0.41).scale.set(1, 0.6, 0.4);
  }
  add(face, new THREE.SphereGeometry(0.055, 16, 12), M.skin, 0, -0.07, 0.5);
  const mouth = add(face, new THREE.TorusGeometry(0.085, 0.018, 8, 20, Math.PI), M.lip, 0, -0.17, 0.465);
  mouth.rotation.z = Math.PI;

  // Samurai touches: red headband (hachimaki) with tails that blow in the wind
  const band = add(face, new THREE.TorusGeometry(0.485, 0.045, 10, 56), M.red, 0, 0.14, -0.01);
  band.rotation.x = Math.PI / 2 - 0.12;
  const tails = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.08, 0.12, -0.47);
    face.add(pivot);
    const tail = add(pivot, new THREE.BoxGeometry(0.08, 0.36, 0.02), M.red, 0, -0.17, 0);
    tail.rotation.z = s * 0.25;
    pivot.userData.side = s;
    tails.push(pivot);
  }

  // Katana on the left hip: handle forward and up, scabbard behind
  M.lacquer = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.25, metalness: 0.3 });
  M.gold = new THREE.MeshStandardMaterial({ color: 0xc8a046, roughness: 0.3, metalness: 0.8 });
  M.wrap = new THREE.MeshStandardMaterial({ color: 0x7a1218, roughness: 0.7 });
  const sword = new THREE.Group();
  sword.position.set(-0.36, 1.02, 0.05);
  sword.rotation.set(-0.35, 0.35, 0);
  body.add(sword);
  const along = (geo, mat, z) => { const m = add(sword, geo, mat, 0, 0, z); m.rotation.x = Math.PI / 2; return m; };
  along(new THREE.CylinderGeometry(0.035, 0.04, 1.0, 16), M.lacquer, -0.5);
  along(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 24), M.gold, 0.0);
  along(new THREE.CylinderGeometry(0.036, 0.036, 0.32, 12), M.wrap, 0.17);
  add(sword, new THREE.SphereGeometry(0.042, 12, 10), M.gold, 0, 0, 0.34);

  return { person, body, torso, head, arms, eyes, tails };
}

function posePerson(P, t, s) {
  // Breathing + gentle sway
  const breath = Math.sin(t * 2);
  P.body.position.y = breath * 0.015;
  P.torso.scale.set(1 + breath * 0.008, 1 + breath * 0.012, 1);
  P.torso.rotation.z = Math.sin(t * 0.9) * 0.02;

  // Head follows the target
  P.head.rotation.y += (s.lookX * 0.6 - P.head.rotation.y) * 0.1;
  P.head.rotation.x += (s.lookY * 0.35 - P.head.rotation.x) * 0.1;
  P.head.rotation.z = Math.sin(t * 1.3) * 0.03 + s.wave * 0.08;

  // Arms: idle swing, right arm waves
  const R = P.arms.right, L = P.arms.left;
  const swing = Math.sin(t * 1.6);
  R.shoulder.rotation.z = lerp(0.12 + swing * 0.03, 2.75, s.wave);
  R.shoulder.rotation.x = lerp(swing * 0.05, -0.15, s.wave);
  R.elbow.rotation.z = s.wave * (0.35 + Math.sin(t * 11) * 0.5);
  L.shoulder.rotation.z = -0.12 - Math.sin(t * 1.6 + 1) * 0.03;
  L.shoulder.rotation.x = Math.sin(t * 1.6 + 1) * 0.05;
  L.elbow.rotation.z = -0.15;

  // Blink
  P.eyes.forEach((e) => (e.scale.y = s.blinking ? 0.12 : 1.2));

  // Headband tails flutter in the wind
  P.tails.forEach((p) => {
    const k = p.userData.side;
    p.rotation.x = 0.55 + Math.sin(t * 3.2 + k) * 0.25;
    p.rotation.z = k * (0.15 + Math.sin(t * 2.4 + k * 2) * 0.12);
  });
}

/* ------------------------------------------------------------------ Environment */

// Soft cloud texture made of many faint blobs
function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  for (let i = 0; i < 46; i++) {
    const x = 40 + Math.random() * 176, y = 50 + Math.random() * 156, r = 30 + Math.random() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.10)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(c);
}

// Leaf: a pointed oval with a short stem
function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.55);
  s.lineTo(0.03, -0.4);
  s.bezierCurveTo(0.42, -0.25, 0.38, 0.25, 0, 0.6);
  s.bezierCurveTo(-0.38, 0.25, -0.42, -0.25, -0.03, -0.4);
  s.lineTo(0, -0.55);
  return new THREE.ShapeGeometry(s, 8);
}

// Jagged rock: a dodecahedron with shared corners nudged randomly
function rockGeometry() {
  const geo = new THREE.DodecahedronGeometry(1.1, 1);
  const pos = geo.attributes.position;
  const offsets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!offsets.has(key)) offsets.set(key, 0.82 + Math.random() * 0.3);
    const f = offsets.get(key);
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  return geo;
}

function toriiGate(material) {
  const g = new THREE.Group();
  const box = (w, h, d, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, 0);
    g.add(m);
    return m;
  };
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.6, 12), material);
    pillar.position.set(s * 0.55, 0.8, 0);
    g.add(pillar);
  }
  box(1.5, 0.1, 0.12, 0, 1.62);            // kasagi (top beam)
  box(1.2, 0.07, 0.08, 0, 1.36);           // nuki (lower beam)
  box(0.08, 0.26, 0.06, 0, 1.49);          // centre strut
  for (const s of [-1, 1]) box(0.22, 0.08, 0.12, s * 0.8, 1.66).rotation.z = s * 0.25; // upturned ends
  return g;
}

/* ------------------------------------------------------------------ Scene */

function mount(el) {
  const isHero = el.dataset["3d"] === "hero";
  const small = matchMedia("(max-width: 760px)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return; // No WebGL: keep the CSS fallback orb
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 7;

  const env = new THREE.Group();   // moon, gate: follows layout, slower scroll parallax
  const world = new THREE.Group(); // character: layout + scroll
  const rig = new THREE.Group();   // turns toward the cursor
  scene.add(env, world);
  world.add(rig);

  // Lights: warm key from the front, strong white rim from the moon, red fill
  const hemi = new THREE.HemisphereLight(0xfff0e8, 0x2a0a0c, 1.2);
  const key = new THREE.DirectionalLight(0xffe7d6, 1.9);
  key.position.set(2.5, 3, 6);
  const rim = new THREE.DirectionalLight(0xffffff, 3.2);
  rim.position.set(0, 2.5, -6);
  const fill = new THREE.DirectionalLight(0xff3b3b, 0.6);
  fill.position.set(-5, -1, 3);
  scene.add(hemi, key, rim, fill);

  // Character on a rock
  const P = buildPerson();
  P.person.position.y = -1.65;
  rig.add(P.person);

  const rock = new THREE.Mesh(
    rockGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x4a1418, roughness: 0.95, flatShading: true })
  );
  rock.scale.set(1.15, 0.5, 0.95);
  rock.position.y = -1.65 - 0.47;
  rig.add(rock);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({
      map: radialTexture([[0, "rgba(0,0,0,0.5)"], [0.5, "rgba(0,0,0,0.15)"], [1, "rgba(0,0,0,0)"]]),
      transparent: true,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.65 + 0.02;
  rig.add(shadow);

  // Moon with a red-white glow, behind the character
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(isHero ? 1.75 : 1.8, 96),
    // Transparent + high renderOrder: drawn after the smoke so it stays bright, but still hidden by nearer objects
    new THREE.MeshBasicMaterial({ color: isHero ? 0xf6f1ea : 0xf7dcd8, transparent: true, toneMapped: false })
  );
  moon.renderOrder = 10;
  moon.position.set(0, 1.35, -5);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({
      map: radialTexture([[0, "rgba(255,235,225,0.55)"], [0.22, "rgba(255,60,60,0.22)"], [0.55, "rgba(140,8,18,0.08)"], [1, "rgba(0,0,0,0)"]]),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  glow.position.set(0, 1.35, -5.1);
  glow.renderOrder = 9;
  env.add(glow, moon);

  // Distant torii gate
  if (isHero) {
    const gate = toriiGate(new THREE.MeshStandardMaterial({ color: 0x5a0d12, roughness: 0.8 }));
    gate.position.set(-0.9, -2.7, -3.6);
    gate.scale.setScalar(0.8);
    env.add(gate);
  }

  // Drifting smoke layers (hero only)
  const smokes = [];
  if (isHero) {
    const tex = smokeTexture();
    const layers = [
      [0x9e0f19, 0.22, THREE.AdditiveBlending, -6, 1.8],
      [0x000000, 0.7, THREE.NormalBlending, -4.5, -2.2],
      [0x000000, 0.55, THREE.NormalBlending, -3.5, 3.0],
      [0x6e0a12, 0.18, THREE.AdditiveBlending, -2.5, 0.2],
      [0x000000, 0.6, THREE.NormalBlending, -1.5, -3.2],
    ];
    layers.forEach(([color, opacity, blending, z, y], i) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 9),
        new THREE.MeshBasicMaterial({ map: tex, color, opacity, transparent: true, depthWrite: false, blending })
      );
      m.position.set((i % 2 ? -1 : 1) * 2, y, z);
      m.rotation.z = Math.random() * Math.PI;
      m.userData = { speed: 0.05 + i * 0.02, dir: i % 2 ? 1 : -1, x0: m.position.x };
      scene.add(m);
      smokes.push(m);
    });
  }

  // Falling maple leaves (instanced)
  const LEAVES = isHero ? (small ? 60 : 130) : 22;
  const span = isHero ? { x: 8, y: 4.5, z0: -5, z1: 3 } : { x: 3.2, y: 3.2, z0: -2, z1: 2 };
  const leaves = new THREE.InstancedMesh(
    leafGeometry(),
    new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide }),
    LEAVES
  );
  const leafState = [];
  const leafColors = [0xc1121f, 0x8d0b16, 0xe63946, 0x6a040f, 0xf25c54].map((c) => new THREE.Color(c));
  const resetLeaf = (L, top) => {
    L.x = (Math.random() * 2 - 1) * span.x;
    L.y = top ? span.y + Math.random() : (Math.random() * 2 - 1) * span.y;
    L.z = span.z0 + Math.random() * (span.z1 - span.z0);
    L.speed = 0.35 + Math.random() * 0.45;
    L.sway = 0.4 + Math.random() * 0.8;
    L.phase = Math.random() * 10;
    L.rx = Math.random() * 6; L.ry = Math.random() * 6; L.rz = Math.random() * 6;
    L.spin = 0.6 + Math.random() * 1.6;
    L.size = (isHero ? 0.12 : 0.09) + Math.random() * 0.1;
  };
  for (let i = 0; i < LEAVES; i++) {
    const L = {};
    resetLeaf(L, false);
    leafState.push(L);
    leaves.setColorAt(i, leafColors[i % leafColors.length]);
  }
  leaves.frustumCulled = false;
  scene.add(leaves);
  const dummy = new THREE.Object3D();

  // Rising embers (hero only)
  let embers = null, emberPos = null, emberVel = null;
  if (isHero) {
    const count = small ? 70 : 150;
    emberPos = new Float32Array(count * 3);
    emberVel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      emberPos[i * 3] = (Math.random() * 2 - 1) * 8;
      emberPos[i * 3 + 1] = (Math.random() * 2 - 1) * 4.5;
      emberPos[i * 3 + 2] = -5 + Math.random() * 7;
      emberVel[i] = 0.15 + Math.random() * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
    embers = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.07,
        color: 0xff7a45,
        map: radialTexture([[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.5)"], [1, "rgba(255,255,255,0)"]]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(embers);
  }

  // Layout
  const base = { x: 0, y: 0, s: 1, turn: 0 };
  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (isHero) {
      const wide = w > 860;
      base.x = wide ? 2.7 : 0;
      base.y = wide ? -0.1 : 1.05;
      base.s = wide ? 0.95 : Math.min(0.55, (w / h) * 1.0);
      base.turn = wide ? -0.35 : 0; // face toward the headline on wide screens
    } else {
      base.y = -0.15;
      base.s = 0.8;
      base.turn = -0.3;
    }
    world.scale.setScalar(base.s);
    env.scale.setScalar(base.s);
    // Objects at z=-5 sit further away, so shift them out to stay behind the character
    const k = 5 / 7 / base.s;
    moon.position.x = glow.position.x = base.x * k;
    moon.position.y = glow.position.y = 1.15 + base.y * k;
  };
  new ResizeObserver(() => { resize(); if (!running) render(); }).observe(el);
  resize();

  // Pointer input (NDC, y down)
  const mouse = { x: 0, y: 0, active: false };
  if (finePointer && !reduceMotion) {
    addEventListener("pointermove", (e) => {
      mouse.x = (e.clientX / innerWidth) * 2 - 1;
      mouse.y = (e.clientY / innerHeight) * 2 - 1;
      mouse.active = true;
    }, { passive: true });
  }

  // Character state
  const state = { lookX: 0, lookY: 0, wave: 0, blinking: false };
  let waveStart = 0.8, lastWave = 0.8, nextBlink = 2, blinkUntil = 0;
  const WAVE_LEN = 2.6;
  const headPos = new THREE.Vector3();

  const clock = new THREE.Clock();
  let running = false, raf = 0, lastT = 0;

  function render() {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    const dt = Math.min(t - lastT, 0.05);
    lastT = t;

    // Where is the head on screen? Look from there toward the cursor.
    P.head.updateWorldMatrix(true, false);
    headPos.setFromMatrixPosition(P.head.matrixWorld).project(camera);
    const hx = headPos.x, hy = -headPos.y;
    if (mouse.active) {
      state.lookX = clamp((mouse.x - hx) * 0.9, -1, 1);
      state.lookY = clamp((mouse.y - hy) * 0.9, -0.8, 0.8);
      if (Math.hypot(mouse.x - hx, mouse.y - hy) < 0.3 && t - lastWave > 4) { waveStart = lastWave = t; }
    } else {
      state.lookX = Math.sin(t * 0.5) * 0.35;
      state.lookY = Math.sin(t * 0.37) * 0.1;
    }

    // Wave on load and every ~10 seconds
    if (t - lastWave > 10) waveStart = lastWave = t;
    const d = t - waveStart;
    state.wave = reduceMotion ? 0 : d >= 0 && d < WAVE_LEN ? smooth(Math.min(d / 0.35, 1) * Math.min((WAVE_LEN - d) / 0.35, 1)) : 0;

    // Blink every few seconds
    if (t > nextBlink) { blinkUntil = t + 0.12; nextBlink = t + 2.5 + Math.random() * 3; }
    state.blinking = t < blinkUntil;

    posePerson(P, t, state);

    // Scroll: character turns and drifts away; background follows more slowly
    const rect = el.getBoundingClientRect();
    const progress = clamp(-rect.top / Math.max(rect.height, 1), 0, 1);
    const bob = Math.sin(t * 0.8) * 0.06;
    world.position.set(base.x, base.y + progress * 1.8 + bob, 0);
    world.rotation.set(progress * 0.3, progress * 1.6, 0);
    env.position.set(base.x, base.y + progress * 0.9, 0);
    rig.rotation.y += (base.turn + state.lookX * 0.25 - rig.rotation.y) * 0.06;

    // Moon glow breathes; camera drifts slightly with the cursor for parallax
    glow.scale.setScalar(1 + Math.sin(t * 0.7) * 0.04);
    camera.position.x += ((mouse.active ? mouse.x * 0.35 : 0) - camera.position.x) * 0.04;
    camera.position.y += ((mouse.active ? -mouse.y * 0.2 : 0) - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    smokes.forEach((m) => {
      const u = m.userData;
      m.position.x = u.x0 + Math.sin(t * u.speed) * 1.5 * u.dir;
      m.rotation.z += dt * 0.01 * u.dir;
    });

    // Leaves: fall, sway in the wind and tumble
    for (let i = 0; i < LEAVES; i++) {
      const L = leafState[i];
      if (!reduceMotion) {
        L.y -= L.speed * dt;
        L.x += (Math.sin(t * L.sway + L.phase) * 0.6 + 0.25) * dt;
        L.rx += L.spin * dt; L.ry += L.spin * 0.7 * dt; L.rz += L.spin * 0.4 * dt;
        if (L.y < -span.y - 0.5 || L.x > span.x + 0.5) resetLeaf(L, true);
      }
      dummy.position.set(L.x, L.y, L.z);
      dummy.rotation.set(L.rx, L.ry, L.rz);
      dummy.scale.setScalar(L.size);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;

    if (embers) {
      for (let i = 0; i < emberVel.length; i++) {
        emberPos[i * 3 + 1] += emberVel[i] * dt;
        emberPos[i * 3] += Math.sin(t + i) * 0.1 * dt;
        if (emberPos[i * 3 + 1] > 4.5) emberPos[i * 3 + 1] = -4.5;
      }
      embers.geometry.attributes.position.needsUpdate = true;
      embers.material.opacity = 0.65 + Math.sin(t * 3) * 0.2;
    }

    renderer.render(scene, camera);
  }

  const loop = () => { render(); raf = requestAnimationFrame(loop); };
  const start = () => { if (!running && !reduceMotion) { running = true; loop(); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  render();
  el.classList.add("ready");

  if (!reduceMotion) {
    let onScreen = true;
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      onScreen && !document.hidden ? start() : stop();
    }).observe(el);
    document.addEventListener("visibilitychange", () => (document.hidden || !onScreen ? stop() : start()));
  }
}

document.querySelectorAll("[data-3d]").forEach(mount);
