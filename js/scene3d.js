// 3D scenes: an animated cartoon version of the person in image/personal.jpg who waves and says
// "Welcome!" (blinks, breathes, follows the cursor) on a golden stage, celebrating the New Year with
// fireworks, falling confetti, twinkling sparkles and a glowing year number.
// Mount with <div class="scene" data-3d="hero|mini"></div>. Falls back to the CSS orb if WebGL is unavailable.
import * as THREE from "three";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const PHOTO = new URL("../image/personal.jpg", import.meta.url).href;
const now = new Date();
const YEAR = now.getFullYear() + (now.getMonth() >= 9 ? 1 : 0); // From October, greet the coming year

const GOLD = 0xffc94a;
const PINK = 0xff4f9a;
const FESTIVE = [0xffc94a, 0xff4f9a, 0x4fd2ff, 0x9b6bff, 0x5cff9d, 0xff7a3d, 0xffffff];

const clamp = THREE.MathUtils.clamp;

// Additive glow that adds light without touching the canvas alpha, so it blends cleanly over the page
const glow = (mat) => Object.assign(mat, {
  transparent: true, depthWrite: false, toneMapped: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
});

const makeCanvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

function radialTexture(stops) {
  const c = makeCanvas(128, 128);
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const dotTexture = () => radialTexture([[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]]);

/* ------------------------------------------------------------------ Character */

// Cartoon 3D version of the person in image/personal.jpg: brown curtain-bangs hair, royal-blue polo
// with chest patches, red lanyard and an ID badge that shows the real photo.
const PALETTE = {
  skin: 0xeab48c,
  hair: 0x5a2f17,
  shirt: 0x1f4fe0,
  shirtDark: 0x173db0,
  pants: 0x1f2433,
  shoes: 0xf4f5f8,
  dark: 0x1b1b22,
  lip: 0xa0503f,
  red: 0xe11d2e,
  white: 0xffffff,
  blush: 0xf29a8a,
  yellow: 0xffc22e,
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
  add(torso, new THREE.CylinderGeometry(0.12, 0.13, 0.22, 20), M.skin, 0, 1.26, 0);

  // Polo collar: two folded flaps and a button placket
  for (const s of [-1, 1]) {
    const flap = add(torso, new THREE.BoxGeometry(0.2, 0.05, 0.16), M.shirt, s * 0.12, 1.17, 0.14);
    flap.rotation.set(0.5, s * -0.35, s * -0.35);
  }
  const back = add(torso, new THREE.TorusGeometry(0.16, 0.05, 10, 28, Math.PI), M.shirt, 0, 1.18, -0.02);
  back.rotation.x = Math.PI / 2;
  add(torso, new THREE.BoxGeometry(0.08, 0.26, 0.02), M.shirtDark, 0, 0.98, 0.3);
  for (const y of [1.05, 0.95]) add(torso, new THREE.SphereGeometry(0.015, 8, 8), M.white, 0, y, 0.315);

  // Chest patches: round club logo on one side, school crest on the other
  const patch = add(torso, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 28), M.red, -0.2, 0.82, 0.27);
  patch.rotation.x = Math.PI / 2 - 0.25;
  const ring = add(torso, new THREE.TorusGeometry(0.065, 0.016, 8, 24), M.yellow, -0.2, 0.825, 0.285);
  ring.rotation.x = -0.25;
  const crest = add(torso, new THREE.ConeGeometry(0.08, 0.12, 3), M.red, 0.21, 0.84, 0.28);
  crest.rotation.set(Math.PI / 2 - 0.25, 0, Math.PI);
  crest.scale.z = 0.15;

  // Lanyard and ID badge (the badge photo is filled in once the image loads)
  const lanyard = add(torso, new THREE.TorusGeometry(0.22, 0.022, 8, 32, Math.PI), M.red, 0, 1.08, 0.27);
  lanyard.rotation.set(-0.3, 0, Math.PI);
  lanyard.scale.y = 1.6;
  add(torso, new THREE.BoxGeometry(0.22, 0.28, 0.025), M.white, 0, 0.6, 0.31);
  add(torso, new THREE.BoxGeometry(0.22, 0.05, 0.03), M.red, 0, 0.72, 0.315);
  const badgePhoto = add(torso, new THREE.PlaneGeometry(0.11, 0.13), new THREE.MeshBasicMaterial({ color: 0xdfe6f2 }), -0.04, 0.58, 0.324);
  for (const y of [0.6, 0.56]) add(torso, new THREE.BoxGeometry(0.05, 0.012, 0.005), M.dark, 0.06, y, 0.325);

  // Arms: shoulder -> elbow pivots, short sleeves
  const arms = {};
  for (const [side, s] of [["left", -1], ["right", 1]]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.47, 1.0, 0);
    torso.add(shoulder);
    add(shoulder, new THREE.SphereGeometry(0.17, 20, 16), M.shirt);
    add(shoulder, new THREE.CapsuleGeometry(0.15, 0.22, 8, 16), M.shirt, 0, -0.18, 0);
    add(shoulder, new THREE.CapsuleGeometry(0.11, 0.18, 8, 16), M.skin, 0, -0.34, 0);
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

  // Hair: full cap plus long curtain bangs parted in the middle, like the photo
  const cap = add(face, new THREE.SphereGeometry(0.545, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.58), M.hair, 0, 0.03, -0.03);
  cap.rotation.x = -0.3;
  cap.scale.set(1.05, 1.02, 1.05);
  for (const s of [-1, 1]) {
    const bang = add(face, new THREE.SphereGeometry(0.28, 24, 16), M.hair, s * 0.22, 0.29, 0.31);
    bang.scale.set(1.05, 0.42, 0.55);
    bang.rotation.z = s * -0.5;
    const side = add(face, new THREE.SphereGeometry(0.22, 20, 14), M.hair, s * 0.44, 0.04, 0.1);
    side.scale.set(0.42, 1.05, 0.75);
  }

  // Face: eyes, brows, nose, cheeks and a smile
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = add(face, new THREE.SphereGeometry(0.065, 16, 12), M.dark, s * 0.17, 0.0, 0.465);
    eye.scale.set(1.05, 1.25, 0.7);
    eyes.push(eye);
    add(face, new THREE.SphereGeometry(0.02, 8, 8), M.white, s * 0.17 + 0.022, 0.035, 0.51);
    const brow = add(face, new THREE.BoxGeometry(0.13, 0.03, 0.03), M.hair, s * 0.17, 0.15, 0.46);
    brow.rotation.z = s * -0.08;
    add(face, new THREE.SphereGeometry(0.07, 16, 12), M.blush, s * 0.28, -0.12, 0.41).scale.set(1, 0.6, 0.4);
  }
  add(face, new THREE.SphereGeometry(0.055, 16, 12), M.skin, 0, -0.07, 0.5);
  const mouth = add(face, new THREE.TorusGeometry(0.085, 0.018, 8, 20, Math.PI), M.lip, 0, -0.17, 0.465);
  mouth.rotation.z = Math.PI;

  return { person, body, torso, head, arms, eyes, mouth, badgePhoto };
}

function posePerson(P, t, s) {
  // Breathing + gentle sway, a happy little bounce while waving
  const breath = Math.sin(t * 2);
  P.body.position.y = breath * 0.015 + s.wave * Math.abs(Math.sin(t * 6)) * 0.05;
  P.torso.scale.set(1 + breath * 0.008, 1 + breath * 0.012, 1);
  P.torso.rotation.z = Math.sin(t * 0.9) * 0.02 - s.wave * 0.05;

  // Head follows the target and tilts in greeting
  P.head.rotation.y += (s.lookX * 0.6 - P.head.rotation.y) * 0.1;
  P.head.rotation.x += (s.lookY * 0.35 - P.head.rotation.x) * 0.1;
  P.head.rotation.z = Math.sin(t * 1.3) * 0.03 + s.wave * 0.12;

  // Arms: idle swing, right arm waves hello
  const R = P.arms.right, L = P.arms.left;
  const swing = Math.sin(t * 1.6);
  R.shoulder.rotation.z = THREE.MathUtils.lerp(0.12 + swing * 0.03, 2.75, s.wave);
  R.shoulder.rotation.x = THREE.MathUtils.lerp(swing * 0.05, -0.15, s.wave);
  R.elbow.rotation.z = s.wave * (0.35 + Math.sin(t * 11) * 0.5);
  L.shoulder.rotation.z = -0.12 - Math.sin(t * 1.6 + 1) * 0.03;
  L.shoulder.rotation.x = Math.sin(t * 1.6 + 1) * 0.05;
  L.elbow.rotation.z = -0.15;

  // Blink; smile gets bigger while waving
  P.eyes.forEach((e) => (e.scale.y = s.blinking ? 0.12 : 1.25));
  P.mouth.scale.set(1 + s.wave * 0.25, 1 + s.wave * 0.6, 1);
}

// "Welcome!" speech bubble drawn on a canvas
function welcomeBubble() {
  const c = makeCanvas(512, 256);
  const g = c.getContext("2d");
  const r = 60, x = 16, y = 16, w = 480, h = 170;
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.lineTo(402, y + h);
  g.lineTo(417, 240); // tail pointing down-right toward the head
  g.lineTo(362, y + h);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  const grad = g.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, "#ffc94a");
  grad.addColorStop(1, "#ff4f9a");
  g.fillStyle = "#fff";
  g.shadowColor = "rgba(0,0,0,0.25)";
  g.shadowBlur = 12;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 8;
  g.strokeStyle = grad;
  g.stroke();
  g.font = '700 92px "Space Grotesk", system-ui, sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#1a1030";
  g.fillText("Welcome!", 256, 104);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 20;
  sprite.center.set(0.81, 0.05); // anchor at the tail tip
  return sprite;
}

/* ------------------------------------------------------------------ New Year environment */

// Fireworks: a fixed pool of particles reused by bursts. Colour fades to black, which adds nothing.
function fireworks(maxBursts, perBurst, area) {
  const N = maxBursts * perBurst;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), base = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, glow(new THREE.PointsMaterial({ size: 0.09, map: dotTexture(), vertexColors: true })));
  points.frustumCulled = false;
  let slot = 0, next = 0.3;
  const c = new THREE.Color();

  const burst = () => {
    c.setHex(FESTIVE[(Math.random() * FESTIVE.length) | 0]);
    const cx = (Math.random() * 2 - 1) * area.x, cy = area.y0 + Math.random() * area.y, cz = area.z0 + Math.random() * area.z;
    const speed = 1.4 + Math.random() * 1.2;
    for (let k = 0; k < perBurst; k++) {
      const i = slot * perBurst + k;
      // Even directions on a sphere, slightly randomised
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const v = speed * (0.85 + Math.random() * 0.3);
      vel[i * 3] = r * Math.cos(th) * v; vel[i * 3 + 1] = u * v; vel[i * 3 + 2] = r * Math.sin(th) * v * 0.5;
      pos[i * 3] = cx; pos[i * 3 + 1] = cy; pos[i * 3 + 2] = cz;
      const hot = Math.random() < 0.15; // a few white-hot sparks
      base[i * 3] = hot ? 1 : c.r; base[i * 3 + 1] = hot ? 1 : c.g; base[i * 3 + 2] = hot ? 1 : c.b;
      life[i] = 1;
    }
    slot = (slot + 1) % maxBursts;
  };

  const update = (t, dt) => {
    if (t > next) { burst(); next = t + 0.5 + Math.random() * 1.1; }
    const drag = Math.pow(0.35, dt);
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      life[i] -= dt * 0.55;
      vel[i * 3] *= drag; vel[i * 3 + 1] = vel[i * 3 + 1] * drag - 0.9 * dt; vel[i * 3 + 2] *= drag;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const f = Math.max(life[i], 0) ** 1.5 * (0.75 + Math.random() * 0.25); // fade with a little crackle
      col[i * 3] = base[i * 3] * f; col[i * 3 + 1] = base[i * 3 + 1] * f; col[i * 3 + 2] = base[i * 3 + 2] * f;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return { points, update, burst };
}

function textSprite(text, color, height, font = '700 120px "Space Grotesk", system-ui, sans-serif') {
  const g0 = makeCanvas(1, 1).getContext("2d");
  g0.font = font;
  const w = Math.ceil(g0.measureText(text).width) + 80;
  const c = makeCanvas(w, 180);
  const g = c.getContext("2d");
  g.font = font;
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 30;
  g.fillText(text, 40, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(glow(new THREE.SpriteMaterial({ map: tex })));
  s.scale.set((w / 180) * height, height, 1);
  return s;
}

// Golden stage: rings, a soft disc of light and a spinning ring of little stars
function stage() {
  const g = new THREE.Group();
  const ring = (r, tube, color, opacity) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 96), glow(new THREE.MeshBasicMaterial({ color, opacity })));
    m.rotation.x = Math.PI / 2;
    g.add(m);
  };
  ring(1.55, 0.025, GOLD, 0.95);
  ring(1.3, 0.01, PINK, 0.7);

  const stars = new THREE.Group();
  const starGeo = new THREE.OctahedronGeometry(0.05, 0);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, toneMapped: false });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const m = new THREE.Mesh(starGeo, starMat);
    m.position.set(Math.cos(a) * 1.42, 0.03, Math.sin(a) * 1.42);
    stars.add(m);
  }
  g.add(stars);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 64),
    glow(new THREE.MeshBasicMaterial({ map: radialTexture([[0, "rgba(255,201,74,0.5)"], [0.6, "rgba(255,79,154,0.12)"], [1, "rgba(0,0,0,0)"]]) }))
  );
  disc.rotation.x = -Math.PI / 2;
  g.add(disc);
  return { group: g, stars };
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
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 7;

  const world = new THREE.Group(); // layout + scroll
  const rig = new THREE.Group();   // turns toward the cursor
  scene.add(world);
  world.add(rig);

  // Lights: soft white key, warm gold rim from behind-left, pink rim from the right
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1030, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 2, 6);
  const rimGold = new THREE.DirectionalLight(GOLD, 3.2);
  rimGold.position.set(-5, 2, -3);
  const rimPink = new THREE.DirectionalLight(PINK, 2.2);
  rimPink.position.set(5, 1, -2);
  scene.add(key, rimGold, rimPink);

  // Character on a golden stage, with the real photo on the ID badge
  const FLOOR = -1.85;
  const P = buildPerson();
  P.person.position.y = FLOOR;
  rig.add(P.person);
  new THREE.TextureLoader().load(PHOTO, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    // Crop to the face/shoulders area of the portrait
    tex.repeat.set(0.6, 0.45);
    tex.offset.set(0.14, 0.5);
    P.badgePhoto.material = new THREE.MeshBasicMaterial({ map: tex });
    if (!running) render();
  });

  // "Welcome!" bubble that pops up beside the head when he waves
  const bubble = welcomeBubble();
  bubble.position.set(-0.35, FLOOR + 3.25, 0.3);
  rig.add(bubble);
  const BUBBLE_W = isHero ? 1.7 : 1.9;

  const st = stage();
  st.group.position.y = FLOOR;
  rig.add(st.group);

  // Big glowing year behind the figure (hero only)
  let yearSprite = null;
  if (isHero) {
    yearSprite = textSprite(String(YEAR), "#ffc94a", 1.8);
    yearSprite.position.set(0.5, 1.7, -3.2);
    rig.add(yearSprite);
  }

  // Fireworks across the sky
  const fw = isHero
    ? fireworks(small ? 5 : 8, small ? 70 : 110, { x: 6.5, y0: 0.6, y: 2.6, z0: -5, z: 2.5 })
    : fireworks(3, 60, { x: 1.8, y0: 0.3, y: 1.6, z0: -2, z: 1.5 });
  scene.add(fw.points);
  if (!reduceMotion) fw.burst();

  // Falling confetti (instanced little rectangles)
  const CONF = isHero ? (small ? 70 : 150) : 30;
  const span = isHero ? { x: 8, y: 4.5, z0: -4, z1: 3 } : { x: 3, y: 3, z0: -2, z1: 2 };
  const confetti = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.6, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }),
    CONF
  );
  confetti.frustumCulled = false;
  const confState = [];
  const resetConf = (C, top) => {
    C.x = (Math.random() * 2 - 1) * span.x;
    C.y = top ? span.y + Math.random() : (Math.random() * 2 - 1) * span.y;
    C.z = span.z0 + Math.random() * (span.z1 - span.z0);
    C.speed = 0.4 + Math.random() * 0.5;
    C.sway = 0.5 + Math.random();
    C.phase = Math.random() * 10;
    C.rx = Math.random() * 6; C.ry = Math.random() * 6; C.rz = Math.random() * 6;
    C.spin = 1.5 + Math.random() * 3;
    C.size = (isHero ? 0.09 : 0.07) + Math.random() * 0.06;
  };
  const confColors = FESTIVE.map((c) => new THREE.Color(c));
  for (let i = 0; i < CONF; i++) {
    const C = {};
    resetConf(C, false);
    confState.push(C);
    confetti.setColorAt(i, confColors[i % confColors.length]);
  }
  scene.add(confetti);
  const dummy = new THREE.Object3D();

  // Twinkling gold sparkles
  const SPARK = isHero ? (small ? 60 : 140) : 30;
  const sparkPos = new Float32Array(SPARK * 3);
  for (let i = 0; i < SPARK; i++) {
    sparkPos[i * 3] = (Math.random() * 2 - 1) * (isHero ? 8 : 3);
    sparkPos[i * 3 + 1] = (Math.random() * 2 - 1) * 4.5;
    sparkPos[i * 3 + 2] = -5 + Math.random() * 6;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkles = new THREE.Points(sparkGeo, glow(new THREE.PointsMaterial({ size: 0.08, color: 0xffe08a, map: dotTexture() })));
  scene.add(sparkles);

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
      base.x = wide ? 2.6 : 0;
      base.y = wide ? -0.1 : 1.1;
      base.s = wide ? 0.98 : Math.min(0.55, (w / h) * 1.0);
      base.turn = wide ? -0.25 : 0; // face toward the headline on wide screens
    } else {
      base.y = 0.05;
      base.s = 0.85;
      base.turn = -0.25;
    }
    world.scale.setScalar(base.s);
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

  // Character state: waves "Welcome!" on load, every few seconds, and when the cursor comes near
  const state = { lookX: 0, lookY: 0, wave: 0, blinking: false };
  let waveStart = 0.6, lastWave = 0.6, nextBlink = 2, blinkUntil = 0;
  const WAVE_LEN = 2.6, BUBBLE_LEN = WAVE_LEN + 1.6;
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
      if (Math.hypot(mouse.x - hx, mouse.y - hy) < 0.3 && t - lastWave > 4) waveStart = lastWave = t;
    } else {
      state.lookX = Math.sin(t * 0.5) * 0.35;
      state.lookY = Math.sin(t * 0.37) * 0.1;
    }
    if (t - lastWave > 7) waveStart = lastWave = t;
    const d = t - waveStart;
    const ease = (x) => x * x * (3 - 2 * x);
    state.wave = reduceMotion ? 0 : d >= 0 && d < WAVE_LEN ? ease(Math.min(d / 0.35, 1) * Math.min((WAVE_LEN - d) / 0.35, 1)) : 0;
    if (t > nextBlink) { blinkUntil = t + 0.12; nextBlink = t + 2.5 + Math.random() * 3; }
    state.blinking = t < blinkUntil;
    posePerson(P, t, state);

    // Bubble pops in with a little overshoot, then shrinks away
    let pop = 1;
    if (!reduceMotion) {
      const inP = clamp(d / 0.4, 0, 1), outP = clamp((BUBBLE_LEN - d) / 0.3, 0, 1);
      pop = d < 0 || d > BUBBLE_LEN ? 0 : (1 + Math.sin(inP * Math.PI) * 0.15) * ease(inP) * ease(outP);
    }
    bubble.visible = pop > 0.01;
    bubble.scale.set(BUBBLE_W * pop, BUBBLE_W * 0.5 * pop, 1);
    bubble.position.y = FLOOR + 3.25 + Math.sin(t * 2) * 0.03;

    rig.rotation.y += (base.turn + state.lookX * 0.25 - rig.rotation.y) * 0.06;

    // Scroll: figure turns and drifts away
    const rect = el.getBoundingClientRect();
    const progress = clamp(-rect.top / Math.max(rect.height, 1), 0, 1);
    world.position.set(base.x, base.y + progress * 1.8 + Math.sin(t * 0.8) * 0.05, 0);
    world.rotation.set(progress * 0.3, progress * 1.4, 0);

    st.stars.rotation.y = t * 0.4;
    if (yearSprite) yearSprite.material.opacity = 0.5 + Math.sin(t * 1.5) * 0.12;
    sparkles.material.opacity = 0.6 + Math.sin(t * 4) * 0.35;

    camera.position.x += ((mouse.active ? mouse.x * 0.35 : 0) - camera.position.x) * 0.04;
    camera.position.y += ((mouse.active ? -mouse.y * 0.2 : 0) - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    if (!reduceMotion) fw.update(t, dt);

    // Confetti: fall, flutter and tumble
    for (let i = 0; i < CONF; i++) {
      const C = confState[i];
      if (!reduceMotion) {
        C.y -= C.speed * dt;
        C.x += Math.sin(t * C.sway + C.phase) * 0.4 * dt;
        C.rx += C.spin * dt; C.ry += C.spin * 0.6 * dt; C.rz += C.spin * 0.3 * dt;
        if (C.y < -span.y - 0.5) resetConf(C, true);
      }
      dummy.position.set(C.x, C.y, C.z);
      dummy.rotation.set(C.rx, C.ry, C.rz);
      dummy.scale.setScalar(C.size);
      dummy.updateMatrix();
      confetti.setMatrixAt(i, dummy.matrix);
    }
    confetti.instanceMatrix.needsUpdate = true;

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
