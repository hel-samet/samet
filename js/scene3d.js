// 3D scenes: a morphing glass-like blob with orbiting shapes and particles.
// Mount with <div class="scene" data-3d="hero|mini"></div>. Falls back to the CSS orb if WebGL is unavailable.
import * as THREE from "three";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const blobVertex = /* glsl */ `
uniform float uTime;
uniform float uAmp;
varying vec3 vViewPos;
varying vec3 vNormal;
varying float vNoise;
${NOISE}
float field(vec3 p) {
  return snoise(p * 0.75 + vec3(uTime * 0.25)) + snoise(p * 1.6 - vec3(uTime * 0.2)) * 0.18;
}
vec3 displace(vec3 p) {
  return p + normalize(p) * field(p) * uAmp;
}
void main() {
  // Displace the vertex and two close neighbours to get a smooth normal for the new surface
  vec3 up = abs(normal.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t = normalize(cross(normal, up));
  vec3 b = normalize(cross(normal, t));
  float e = 0.01;
  vec3 p0 = displace(position);
  vec3 p1 = displace(position + t * e);
  vec3 p2 = displace(position + b * e);
  vec3 nrm = normalize(cross(p1 - p0, p2 - p0));
  if (dot(nrm, normal) < 0.0) nrm = -nrm;

  vNoise = field(position);
  vNormal = normalize(normalMatrix * nrm);
  vec4 mv = modelViewMatrix * vec4(p0, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const blobFragment = /* glsl */ `
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
varying vec3 vViewPos;
varying vec3 vNormal;
varying float vNoise;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vViewPos);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);
  vec3 col = mix(uC1, uC2, smoothstep(-0.7, 0.7, vNoise));
  col = mix(col, uC3, smoothstep(0.35, 1.0, n.y * 0.5 + 0.5) * 0.5);
  vec3 L = normalize(vec3(0.5, 0.8, 0.6));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), v), 0.0), 18.0);
  col *= 0.55 + 0.6 * diff;
  col += spec * 0.35 + fres * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

const cssColor = (name) =>
  new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888");

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

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
  const rig = new THREE.Group();   // mouse
  scene.add(world);
  world.add(rig);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  const fill = new THREE.DirectionalLight(0xffffff, 1.2);
  fill.position.set(-4, -2, 2);
  scene.add(key, fill);

  // Morphing blob
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.28 },
    uC1: { value: new THREE.Color() },
    uC2: { value: new THREE.Color() },
    uC3: { value: new THREE.Color() },
  };
  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, small ? 36 : 56),
    new THREE.ShaderMaterial({ uniforms, vertexShader: blobVertex, fragmentShader: blobFragment })
  );
  rig.add(blob);

  // Wireframe shell
  const shellMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.22 });
  const shell = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.35, 1)), shellMat);
  rig.add(shell);

  // Orbiting shapes
  const orbiters = [];
  const orbitDefs = isHero
    ? [
        [new THREE.TorusGeometry(0.3, 0.11, 24, 64), "--accent-3", 2.7, 0.0, 0.45],
        [new THREE.OctahedronGeometry(0.3), "--accent-2", 3.1, 2.1, 0.32],
        [new THREE.SphereGeometry(0.2, 32, 32), "--accent-1", 2.9, 4.2, 0.55],
        [new THREE.TorusKnotGeometry(0.17, 0.055, 96, 12), "--accent-2", 3.4, 5.3, 0.25],
        [new THREE.BoxGeometry(0.28, 0.28, 0.28), "--accent-3", 3.0, 3.1, 0.38],
      ]
    : [
        [new THREE.TorusGeometry(0.26, 0.1, 20, 48), "--accent-3", 2.6, 0.0, 0.45],
        [new THREE.OctahedronGeometry(0.26), "--accent-2", 2.9, 3.0, 0.32],
      ];
  orbitDefs.forEach(([geo, colorVar, radius, phase, speed], i) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.25 }));
    mesh.userData = { colorVar, radius, phase, speed, lift: (i % 2 ? -1 : 1) * (0.3 + i * 0.12) };
    rig.add(mesh);
    orbiters.push(mesh);
  });

  // Particle field
  let particles = null;
  if (isHero) {
    const count = small ? 260 : 700;
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
      new THREE.PointsMaterial({ size: 0.06, map: dotTexture(), transparent: true, opacity: 0.8, depthWrite: false })
    );
    world.add(particles);
  }

  // Theme colours
  const applyTheme = () => {
    uniforms.uC1.value.copy(cssColor("--accent-1"));
    uniforms.uC2.value.copy(cssColor("--accent-2"));
    uniforms.uC3.value.copy(cssColor("--accent-3"));
    shellMat.color.copy(cssColor("--accent-1"));
    orbiters.forEach((m) => m.material.color.copy(cssColor(m.userData.colorVar)));
    if (particles) particles.material.color.copy(cssColor("--accent-2"));
  };
  applyTheme();
  new MutationObserver(() => { applyTheme(); if (!running) render(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Layout
  const base = { x: 0, y: 0, s: 1 };
  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (isHero) {
      const wide = w > 860;
      base.x = wide ? 2.9 : 0;
      base.y = wide ? 0 : 1.55;
      base.s = wide ? 0.82 : Math.min(0.68, (w / h) * 0.95);
    } else {
      base.s = 0.95;
    }
    world.scale.setScalar(base.s);
  };
  new ResizeObserver(() => { resize(); if (!running) render(); }).observe(el);
  resize();

  // Pointer + scroll input
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, energy: 0 };
  if (finePointer && !reduceMotion) {
    let lastX = 0, lastY = 0;
    addEventListener("pointermove", (e) => {
      mouse.tx = (e.clientX / innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / innerHeight) * 2 - 1;
      const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      mouse.energy = Math.min(mouse.energy + speed * 0.0025, 1);
      lastX = e.clientX; lastY = e.clientY;
    }, { passive: true });
  }

  const clock = new THREE.Clock();
  let running = false, raf = 0;

  function render() {
    const t = reduceMotion ? 2 : clock.getElapsedTime();

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    mouse.energy *= 0.95;

    // Scroll: tumble and drift away as the section leaves the viewport
    const rect = el.getBoundingClientRect();
    const progress = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1);

    world.position.set(base.x, base.y + progress * 1.8, 0);
    world.rotation.set(progress * 0.8, progress * 1.6, 0);
    rig.rotation.x = mouse.y * 0.35;
    rig.rotation.y = mouse.x * 0.5;
    camera.position.x = mouse.x * 0.3;
    camera.position.y = -mouse.y * 0.2;
    camera.lookAt(0, 0, 0);

    uniforms.uTime.value = t;
    uniforms.uAmp.value = 0.2 + mouse.energy * 0.18;
    blob.rotation.y = t * 0.15;
    blob.rotation.z = t * 0.05;
    shell.rotation.x = t * 0.07;
    shell.rotation.y = -t * 0.1;

    orbiters.forEach((m) => {
      const { radius, phase, speed, lift } = m.userData;
      const a = t * speed + phase;
      m.position.set(Math.cos(a) * radius, Math.sin(a * 1.3) * 0.5 + lift, Math.sin(a) * radius);
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
