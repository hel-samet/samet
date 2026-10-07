// 3D scenes: an animated cartoon character (waves, blinks, breathes, follows the cursor)
// standing on a floating platform, with orbiting shapes and particles.
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

  return { person, body, torso, head, arms, eyes };
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

  const world = new THREE.Group(); // layout + scroll
  const rig = new THREE.Group();   // turns toward the cursor
  scene.add(world);
  world.add(rig);

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.4);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 5);
  const rim = new THREE.DirectionalLight(0xffffff, 2.2);
  rim.position.set(-4, 3, -4);
  scene.add(hemi, key, rim);

  // Character
  const P = buildPerson();
  P.person.position.y = -1.65;
  rig.add(P.person);

  // Floating platform, glow ring and contact shadow
  const platformMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.95, 0.14, 64), platformMat);
  platform.position.y = -1.65 - 0.07;
  rig.add(platform);
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.022, 12, 96), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -1.65 + 0.005;
  rig.add(ring);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({
      map: radialTexture([[0, "rgba(0,0,0,0.45)"], [0.5, "rgba(0,0,0,0.15)"], [1, "rgba(0,0,0,0)"]]),
      transparent: true,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.65 + 0.008;
  rig.add(shadow);

  // Orbiting shapes
  const orbiters = [];
  const orbitDefs = isHero
    ? [
        [new THREE.TorusGeometry(0.2, 0.075, 20, 48), "--accent-3", 2.0, 0.0, 0.45, 0.6],
        [new THREE.OctahedronGeometry(0.2), "--accent-2", 2.3, 2.1, 0.32, -0.3],
        [new THREE.SphereGeometry(0.14, 32, 32), "--accent-1", 2.1, 4.2, 0.55, 1.1],
        [new THREE.BoxGeometry(0.2, 0.2, 0.2), "--accent-3", 2.4, 3.1, 0.38, -0.9],
      ]
    : [
        [new THREE.TorusGeometry(0.18, 0.07, 20, 48), "--accent-3", 1.9, 0.0, 0.45, 0.6],
        [new THREE.OctahedronGeometry(0.18), "--accent-2", 2.1, 3.0, 0.32, -0.4],
      ];
  orbitDefs.forEach(([geo, colorVar, radius, phase, speed, lift]) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.25 }));
    mesh.userData = { colorVar, radius, phase, speed, lift };
    rig.add(mesh);
    orbiters.push(mesh);
  });

  // Particle field
  let particles = null;
  if (isHero) {
    const count = small ? 220 : 600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3.5 + Math.random() * 5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.06,
        map: radialTexture([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]]),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      })
    );
    world.add(particles);
  }

  // Theme colours
  const applyTheme = () => {
    platformMat.color.copy(cssColor("--accent-1"));
    ringMat.color.copy(cssColor("--accent-2"));
    rim.color.copy(cssColor("--accent-2"));
    hemi.groundColor.copy(cssColor("--accent-1"));
    orbiters.forEach((m) => m.material.color.copy(cssColor(m.userData.colorVar)));
    if (particles) particles.material.color.copy(cssColor("--accent-2"));
  };
  applyTheme();
  new MutationObserver(() => { applyTheme(); if (!running) render(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

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
      base.y = wide ? -0.1 : 1.75;
      base.s = wide ? 0.95 : Math.min(0.55, (w / h) * 1.0);
      base.turn = wide ? -0.35 : 0; // face toward the headline on wide screens
    } else {
      base.y = -0.15;
      base.s = 0.8;
      base.turn = -0.3;
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

  // Character state
  const state = { lookX: 0, lookY: 0, wave: 0, blinking: false };
  let waveStart = 0.8, lastWave = 0.8, nextBlink = 2, blinkUntil = 0;
  const WAVE_LEN = 2.6;
  const headPos = new THREE.Vector3();

  const clock = new THREE.Clock();
  let running = false, raf = 0;

  function render() {
    const t = reduceMotion ? 0 : clock.getElapsedTime();

    // Where is the head on screen? Look from there toward the cursor.
    P.head.updateWorldMatrix(true, false);
    headPos.setFromMatrixPosition(P.head.matrixWorld).project(camera);
    const hx = headPos.x, hy = -headPos.y;
    if (mouse.active) {
      state.lookX = clamp((mouse.x - hx) * 0.9, -1, 1);
      state.lookY = clamp((mouse.y - hy) * 0.9, -0.8, 0.8);
      // Wave when the cursor comes close
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

    // Scroll: turn and drift away as the section leaves the viewport
    const rect = el.getBoundingClientRect();
    const progress = clamp(-rect.top / Math.max(rect.height, 1), 0, 1);
    world.position.set(base.x, base.y + progress * 1.8 + Math.sin(t * 0.8) * 0.06, 0);
    world.rotation.set(progress * 0.3, progress * 1.6, 0);
    rig.rotation.y += (base.turn + state.lookX * 0.25 - rig.rotation.y) * 0.06;

    platform.rotation.y = t * 0.2;

    orbiters.forEach((m) => {
      const { radius, phase, speed, lift } = m.userData;
      const a = t * speed + phase;
      m.position.set(Math.cos(a) * radius * 0.45, Math.sin(a * 1.3) * 0.3 + lift, Math.sin(a) * radius);
      m.rotation.x = t * 0.8 + phase;
      m.rotation.y = t * 0.6;
    });
    if (particles) {
      particles.rotation.y = t * 0.02;
      particles.rotation.x = t * 0.01;
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
