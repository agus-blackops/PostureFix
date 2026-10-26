/**
 * Las escenas en 3D del tráiler 3 (three.js). Igual que lo demás, es una función
 * del tiempo: `T3.render(t)` dibuja el fotograma del segundo `t` en el lienzo
 * `#gl` y deja en `T3.screen` dónde han caído ciertos puntos, para que las
 * etiquetas en 2D (SVG) se pongan encima.
 *
 * Se compila con build3d.mjs a `trailer3-3d.js`.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const W = 1920, H = 1080;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const spring = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-7 * x) * Math.cos(11 * x));
const RAD = Math.PI / 180;

const C = {
  green: new THREE.Color('#30D158'), red: new THREE.Color('#FF453A'), orange: new THREE.Color('#FF7A29'),
  yellow: new THREE.Color('#FFD60A'), blue: new THREE.Color('#5AB0FF'),
};

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 60);

/** Dónde ha caído, en píxeles, cada punto con etiqueta. */
const screen = {};
const project = (name, v) => {
  const p = v.clone().project(camera);
  screen[name] = [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H];
};

function env(scene) {
  scene.fog = new THREE.Fog(0x0a0706, 5.5, 13);
  scene.add(new THREE.HemisphereLight(0xffd9c2, 0x1a0b05, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(2.5, 4, 3);
  scene.add(sun);
  const rim = new THREE.PointLight(0xff7a29, 30, 9, 2);
  rim.position.set(-2, 1.6, 1.6);
  scene.add(rim);
  const back = new THREE.PointLight(0xff453a, 14, 8, 2);
  back.position.set(2.5, 1.2, -2.5);
  scene.add(back);
  const grid = new THREE.GridHelper(14, 42, 0x4a2412, 0x24120a);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);
}

const UP = new THREE.Vector3(0, 1, 0);
function cylinder(radius, mat, segs = 18) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, segs), mat);
}
const _d = new THREE.Vector3();
function setLimb(mesh, a, b) {
  _d.subVectors(b, a);
  const len = Math.max(1e-4, _d.length());
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, _d.normalize());
}

/** Flecha gruesa: cilindro + cono. `set(origen, dirección, largo)`. */
function arrow(color, thick = 0.028) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 });
  const shaft = cylinder(thick, mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(thick * 2.6, 0.2, 24), mat);
  g.add(shaft, head);
  g.userData.set = (origin, dir, len) => {
    const d = dir.clone().normalize();
    const L = Math.max(0.0001, len);
    const sl = Math.max(0.0001, L - 0.2);
    g.visible = len > 0.01;
    shaft.position.copy(origin).addScaledVector(d, sl / 2);
    shaft.scale.set(1, sl, 1);
    shaft.quaternion.setFromUnitVectors(UP, d);
    head.position.copy(origin).addScaledVector(d, sl + 0.1);
    head.quaternion.setFromUnitVectors(UP, d);
    return origin.clone().addScaledVector(d, L);
  };
  return g;
}

// ============================================================ A: la persona
function buildA() {
  const scene = new THREE.Scene();
  env(scene);
  const gray = new THREE.MeshStandardMaterial({ color: 0x8a756c, roughness: 0.75 });
  const furn = new THREE.MeshStandardMaterial({ color: 0x4a3a34, roughness: 0.8 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x1b120e, emissive: 0xff9a5a, emissiveIntensity: 0.35, roughness: 0.6 });
  const spineMat = new THREE.MeshStandardMaterial({ color: C.green, roughness: 0.4, emissive: C.green, emissiveIntensity: 0.25 });
  const shellMat = new THREE.MeshStandardMaterial({ color: C.green, roughness: 0.6, transparent: true, opacity: 0.32, depthWrite: false });

  const box = (w, h, d, x, y, z, mat = furn) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  // Silla, mesa y portátil.
  box(0.5, 0.045, 0.5, -0.02, 0.45, 0);
  box(0.045, 0.55, 0.5, -0.27, 0.72, 0, furn).rotation.z = 0.05;
  const post = cylinder(0.03, furn); setLimb(post, new THREE.Vector3(-0.02, 0.05, 0), new THREE.Vector3(-0.02, 0.43, 0)); scene.add(post);
  const base = cylinder(0.3, furn, 28); base.scale.set(1, 0.03, 1); base.position.set(-0.02, 0.03, 0); scene.add(base);
  box(0.9, 0.04, 1.5, 1.05, 0.73, 0);
  [[0.7, 0.72], [0.7, -0.72], [1.4, 0.72], [1.4, -0.72]].forEach(([x, z]) => {
    const l = cylinder(0.035, furn); setLimb(l, new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 0.72, z)); scene.add(l);
  });
  box(0.36, 0.02, 0.26, 0.98, 0.765, 0, new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.5, metalness: 0.4 }));
  const lid = box(0.02, 0.26, 0.34, 1.14, 0.9, 0, screenMat); lid.rotation.z = 0.28;

  // La persona.
  const hip = new THREE.Vector3(0, 0.5, 0);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), gray); scene.add(pelvis);
  pelvis.position.copy(hip);
  const legs = [-0.1, 0.1].map((z) => {
    const th = cylinder(0.055, gray), sh = cylinder(0.045, gray), ft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.08), gray);
    const knee = new THREE.Vector3(0.44, 0.5, z), ankle = new THREE.Vector3(0.44, 0.06, z);
    setLimb(th, new THREE.Vector3(0, 0.5, z), knee); setLimb(sh, knee, ankle);
    ft.position.set(0.52, 0.04, z);
    scene.add(th, sh, ft);
    return null;
  });
  void legs;
  const vertebrae = Array.from({ length: 17 }, (_, i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.034 + 0.004 * Math.sin(i * 0.8), 16, 12), spineMat);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.105 - 0.01 * (i / 16), 20, 14), shellMat);
    scene.add(s, shell);
    return { s, shell };
  });
  const links = Array.from({ length: 16 }, () => { const l = cylinder(0.02, spineMat); scene.add(l); return l; });
  const neck = cylinder(0.045, spineMat); scene.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 28, 20), spineMat); scene.add(head);
  const arms = [-0.17, 0.17].map((z) => {
    const ua = cylinder(0.04, gray), fa = cylinder(0.035, gray);
    scene.add(ua, fa);
    return { ua, fa, z };
  });

  // Mismas curvas que el dibujo en 2D del tráiler 1: de 2D (px) a metros.
  const to3 = (x, y) => new THREE.Vector3(((x - 1340) / 232) * 0.55, 0.5 + ((722 - y) / 232) * 0.55, 0);
  function spine(s) {
    const a = s * 0.66, L = 232;
    const hip2 = { x: 1340, y: 722 };
    const N = { x: hip2.x + L * Math.sin(a), y: hip2.y - L * Math.cos(a) };
    const c1 = { x: hip2.x - 38 * s, y: hip2.y - L * 0.45 };
    const c2 = { x: N.x - 22 * (1 - s) - 40 * s, y: N.y + L * 0.32 };
    const at = (u) => {
      const v = 1 - u;
      return to3(
        v ** 3 * hip2.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u ** 3 * N.x,
        v ** 3 * hip2.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u ** 3 * N.y
      );
    };
    const neckBase = at(1);
    const headC = to3(N.x + 34 + 84 * s, N.y - 62 + 40 * s);
    return { at, neckBase, headC };
  }

  return {
    scene,
    update(t) {
      const s = easeInOut(seg(t, 1.0, 5.8));
      const col = C.green.clone().lerp(C.red, Math.min(1, s * s * s * 1.1));
      spineMat.color.copy(col); spineMat.emissive.copy(col); shellMat.color.copy(col);
      const sp = spine(s);
      const pts = vertebrae.map((_, i) => sp.at(i / 16));
      vertebrae.forEach((v, i) => { v.s.position.copy(pts[i]); v.shell.position.copy(pts[i]); });
      links.forEach((l, i) => setLimb(l, pts[i], pts[i + 1]));
      setLimb(neck, sp.neckBase, sp.headC);
      head.position.copy(sp.headC);
      const sh = sp.at(0.88);
      arms.forEach(({ ua, fa, z }) => {
        const shoulder = sh.clone().setZ(z), elbow = new THREE.Vector3(0.22, 0.58, z * 1.05), hand = new THREE.Vector3(0.74, 0.8, z * 0.6);
        setLimb(ua, shoulder, elbow); setLimb(fa, elbow, hand);
      });
      // Cámara en órbita lenta.
      const az = lerp(-0.85, 0.35, easeInOut(seg(t, 0, 7)));
      const r = lerp(3.5, 3.0, seg(t, 0, 7));
      camera.position.set(0.5 + r * Math.sin(az), 1.15, r * Math.cos(az));
      camera.lookAt(0.45, 0.72, 0);
      camera.setViewOffset(W, H, -430, 0, W, H);
      camera.updateMatrixWorld();
      project('head', head.position.clone().add(new THREE.Vector3(0.05, 0.2, 0)));
      screen.slouch = [s];
    },
  };
}

// ============================================================ B: el título
function buildB() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0706, 6, 14);
  scene.add(new THREE.HemisphereLight(0xffd9c2, 0x1a0b05, 0.6));
  const key = new THREE.PointLight(0xff9a5a, 40, 12, 2); key.position.set(2, 2, 4); scene.add(key);
  const rim = new THREE.PointLight(0xff453a, 20, 12, 2); rim.position.set(-3, -1, 2); scene.add(rim);
  const ringMat = new THREE.MeshStandardMaterial({ color: C.orange, emissive: C.orange, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.2 });
  const ring2Mat = new THREE.MeshStandardMaterial({ color: 0xff8a45, emissive: 0xff8a45, emissiveIntensity: 0.35, roughness: 0.5, transparent: true, opacity: 0.6 });
  const holder = new THREE.Group(); scene.add(holder);
  let ring = null, ring2 = null;
  const curve = (R, A, n, ph, tilt) => {
    const pts = [];
    for (let i = 0; i < 160; i++) {
      const th = (i / 160) * Math.PI * 2;
      const r = R + A * Math.sin(n * th + ph);
      pts.push(new THREE.Vector3(r * Math.cos(th), r * Math.sin(th), tilt * Math.sin(2 * th + ph)));
    }
    return new THREE.CatmullRomCurve3(pts, true);
  };
  const N = 700, pos = new Float32Array(N * 3), phase = [];
  for (let i = 0; i < N; i++) {
    const a = Math.random(), b = Math.random(), c = Math.random();
    const th = a * Math.PI * 2, ph = Math.acos(2 * b - 1), r = 2.2 + c * 3.5;
    phase.push([th, ph, r]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 32;
  const dg = dot.getContext('2d');
  const grad = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,200,150,1)'); grad.addColorStop(1, 'rgba(255,200,150,0)');
  dg.fillStyle = grad; dg.fillRect(0, 0, 32, 32);
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dot), color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
  scene.add(dust);
  return {
    scene,
    update(t) {
      if (ring) { holder.remove(ring, ring2); ring.geometry.dispose(); ring2.geometry.dispose(); }
      const hit = spring(seg(t, 0.0, 0.9));
      ring = new THREE.Mesh(new THREE.TubeGeometry(curve(1.25, 0.08, 12, t * 1.4, 0.05), 240, 0.045, 10, true), ringMat);
      ring2 = new THREE.Mesh(new THREE.TubeGeometry(curve(1.55, 0.05, 18, -t * 1.1, 0), 240, 0.012, 6, true), ring2Mat);
      holder.add(ring, ring2);
      holder.scale.setScalar(lerp(1.7, 1, hit));
      holder.rotation.set(0.35 * Math.sin(t * 0.5) , 0.55 * Math.sin(t * 0.42 + 0.6), t * 0.12);
      ring2.rotation.set(1.15 + 0.25 * Math.sin(t * 0.7), 0.3, t * 0.2);
      const p = geo.attributes.position;
      for (let i = 0; i < N; i++) {
        const [th, ph, r] = phase[i];
        const a = th + t * 0.08 * (1 + (i % 5) * 0.1);
        p.setXYZ(i, r * Math.sin(ph) * Math.cos(a), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(a) - 1);
      }
      p.needsUpdate = true;
      camera.position.set(0, 0, lerp(5.2, 4.3, easeOut(seg(t, 0, 6))));
      camera.lookAt(0, 0, 0);
      camera.clearViewOffset();
      camera.updateMatrixWorld();
    },
  };
}

// ============================================================ C: el móvil
/** Pantalla del móvil, dibujada en un lienzo 2D y usada como textura. */
function phoneScreen() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 1024;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = (ang, label) => {
    const over = ang > 22;
    const col = ang < 14 ? '#30D158' : ang < 22 ? '#FFD60A' : '#FF453A';
    g.fillStyle = '#0b0807'; g.fillRect(0, 0, 512, 1024);
    g.fillStyle = '#fff'; g.font = '800 44px Inter, sans-serif'; g.textAlign = 'left';
    g.fillText('PostureFix', 44, 110);
    g.fillStyle = 'rgba(246,236,230,.6)'; g.font = '600 24px Inter, sans-serif';
    g.fillText(over ? 'Pitido en 4 s si no te enderezas' : 'Vigilando · Sentado', 44, 150);
    const cx = 256, cy = 470, R = 150;
    g.lineWidth = 24; g.lineCap = 'round';
    g.strokeStyle = 'rgba(130,120,118,.3)'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    const frac = clamp(ang / 70);
    if (frac > 0.004) { g.strokeStyle = col; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); g.stroke(); }
    const th = -Math.PI / 2 + (22 / 70) * Math.PI * 2;
    g.strokeStyle = '#fff'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx + (R - 22) * Math.cos(th), cy + (R - 22) * Math.sin(th)); g.lineTo(cx + (R + 22) * Math.cos(th), cy + (R + 22) * Math.sin(th)); g.stroke();
    g.textAlign = 'center'; g.fillStyle = over ? col : '#fff'; g.font = '900 150px "Big Shoulders Display", sans-serif';
    g.fillText(`${Math.round(ang)}°`, cx, cy + 50);
    g.fillStyle = 'rgba(246,236,230,.6)'; g.font = '600 26px Inter, sans-serif';
    g.fillText('de mala postura', cx, cy + 92);
    g.fillStyle = over ? '#7a1812' : '#14451f'; g.beginPath(); g.roundRect(70, 700, 372, 66, 33); g.fill();
    g.fillStyle = '#fff'; g.font = '800 30px Inter, sans-serif';
    g.fillText(label || (over ? '¡Te estás agachando!' : 'Postura correcta'), 256, 744);
    g.fillStyle = 'rgba(246,236,230,.35)'; g.font = '600 22px Inter, sans-serif';
    g.fillText('Umbral 22° · la marca del anillo', 256, 830);
    g.fillStyle = '#FF453A'; g.beginPath(); g.roundRect(60, 900, 392, 80, 40); g.fill();
    g.fillStyle = '#fff'; g.font = '800 32px Inter, sans-serif'; g.fillText('Parar vigilancia', 256, 952);
    tex.needsUpdate = true;
  };
  return { tex, draw };
}

function makePhone() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(0.78, 1.55, 0.09, 6, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x1d1512, roughness: 0.3, metalness: 0.6, emissive: 0x2a1308, emissiveIntensity: 0.4 })
  );
  group.add(body);
  const scr = phoneScreen();
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.70, 1.40), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
  screenMesh.position.z = 0.0465;
  group.add(screenMesh);
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new RoundedBoxGeometry(0.78, 1.55, 0.09, 4, 0.09), 35),
    new THREE.LineBasicMaterial({ color: 0xff7a29, transparent: true, opacity: 0.55 })
  );
  group.add(edge);
  return { group, draw: scr.draw };
}

function buildC() {
  const scene = new THREE.Scene();
  env(scene);
  const phone = makePhone();
  const holder = new THREE.Group(); holder.position.set(0, 1.0, 0); scene.add(holder);
  holder.add(phone.group);
  // Móvil «fantasma» derecho, de referencia.
  const ghost = new THREE.LineSegments(
    new THREE.EdgesGeometry(new RoundedBoxGeometry(0.78, 1.55, 0.09, 3, 0.09), 35),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 })
  );
  ghost.position.copy(holder.position); scene.add(ghost);
  // Gravedad: siempre hacia abajo.
  const grav = arrow(C.yellow, 0.022);
  scene.add(grav);
  const arcMat = new THREE.MeshBasicMaterial({ color: C.green });
  let arc = null;
  return {
    scene,
    update(t) {
      const az = lerp(-0.35, 0.3, easeInOut(seg(t, 0, 10)));
      camera.position.set(4.7 * Math.sin(az), 1.75, 4.7 * Math.cos(az));
      camera.lookAt(0.2, 1.4, 0);
      camera.setViewOffset(W, H, -380, 0, W, H);
      camera.updateMatrixWorld();
      const ang = easeInOut(seg(t, 3.0, 6.2)) * 36 + (t > 6.2 ? (Math.sin(t * 7) * 0.5 + Math.sin(t * 3.1) * 0.7) * 0.9 : 0);
      const appear = easeOut(seg(t, 0.0, 1.2));
      holder.scale.setScalar(lerp(0.6, 1, appear));
      holder.position.y = lerp(0.2, 1.0, appear);
      holder.rotation.z = -ang * RAD;
      holder.rotation.y = 0.12 * Math.sin(t * 0.6);
      ghost.visible = t > 1.2;
      phone.draw(ang, null);
      const tip = grav.userData.set(new THREE.Vector3(1.25, 1.7, 0), new THREE.Vector3(0, -1, 0), 1.35 * easeOut(seg(t, 1.0, 2.2)));
      project('grav', tip.clone().add(new THREE.Vector3(0.1, 0.1, 0)));
      // Arco del ángulo entre la vertical y el móvil.
      if (arc) { scene.remove(arc); arc.geometry.dispose(); }
      if (ang > 0.8) {
        // Arco entre la vertical y el móvil inclinado, en el plano del dibujo.
        const R = 1.0, steps = 30, pts = [];
        for (let i = 0; i <= steps; i++) {
          const a = ang * RAD * (i / steps);
          pts.push(new THREE.Vector3(R * Math.sin(a), 1.0 + R * Math.cos(a), 0.07));
        }
        arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.018, 8, false), arcMat);
        arcMat.color.copy(ang < 14 ? C.green : ang < 22 ? C.green.clone().lerp(C.yellow, (ang - 14) / 8) : C.yellow.clone().lerp(C.red, clamp((ang - 22) / 10)));
        scene.add(arc);
        const m = ang * RAD * 0.5;
        project('arc', new THREE.Vector3(1.3 * Math.sin(m), 1.0 + 1.3 * Math.cos(m), 0));
      } else arc = null;
      screen.ang = [ang];
    },
  };
}

// ============================================================ D: los ejes
function buildD() {
  const scene = new THREE.Scene();
  env(scene);
  const phone = makePhone();
  const holder = new THREE.Group(); holder.position.set(1.15, 1.0, 0); scene.add(holder);
  holder.add(phone.group);
  const gizmoO = new THREE.Vector3(-1.45, 0.12, 0);
  const aUp = arrow(C.green, 0.03), aFw = arrow(C.orange, 0.03), aSd = arrow(C.blue, 0.03);
  scene.add(aUp, aFw, aSd);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }));
  hub.position.copy(gizmoO); scene.add(hub);
  const disc = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.8, 64), new THREE.MeshBasicMaterial({ color: 0xff7a29, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; disc.position.copy(gizmoO).setY(0.01); scene.add(disc);
  return {
    scene,
    update(t) {
      const az = lerp(0.2, 0.7, easeInOut(seg(t, 0, 16)));
      camera.position.set(5.4 * Math.sin(az), 1.9, 5.4 * Math.cos(az));
      camera.lookAt(0, 1.5, 0);
      camera.clearViewOffset();
      camera.updateMatrixWorld();
      // Postura del móvil: recto, se inclina hacia delante, y luego la demostración.
      let pitch = 0, roll = 0;
      pitch += 24 * easeInOut(seg(t, 3.5, 4.7));
      if (t > 6.6) pitch = 24 * (1 - easeInOut(seg(t, 6.6, 7.4)));
      if (t > 8.5) pitch += 24 * easeInOut(seg(t, 8.5, 9.4)) * (1 - easeInOut(seg(t, 10.0, 10.6)));
      if (t > 10.6) pitch += -16 * easeInOut(seg(t, 10.6, 11.3)) * (1 - easeInOut(seg(t, 12.4, 13.0)));
      if (t > 13.0) roll = 18 * easeInOut(seg(t, 13.0, 13.7));
      if (t > 14.6) roll *= 1 - easeInOut(seg(t, 14.6, 15.2));
      const wob = t < 3.4 ? Math.sin(t * 9) * 0.25 * (1 - seg(t, 2.4, 3.4)) : 0;
      holder.rotation.set(roll * RAD, 0, -(pitch + wob) * RAD);
      const appear = easeOut(seg(t, 0.0, 1.0));
      holder.scale.setScalar(lerp(0.6, 1, appear));
      phone.draw(Math.hypot(Math.max(0, pitch), roll), pitch < -1 ? 'Hacia atrás: no cuenta' : undefined);
      const up = aUp.userData.set(gizmoO, new THREE.Vector3(0, 1, 0), 1.4 * easeOut(seg(t, 0.9, 2.0)));
      const fw = aFw.userData.set(gizmoO, new THREE.Vector3(1, 0, 0), 1.35 * easeOut(seg(t, 5.0, 6.0)));
      const sd = aSd.userData.set(gizmoO, new THREE.Vector3(0, 0, 1), 1.35 * easeOut(seg(t, 7.4, 8.4)));
      project('up', up.clone().add(new THREE.Vector3(0, 0.15, 0)));
      project('fw', fw.clone().add(new THREE.Vector3(0.12, 0.1, 0)));
      project('sd', sd.clone().add(new THREE.Vector3(0, 0.12, 0.1)));
      project('hub', gizmoO);
      screen.pitch = [pitch]; screen.roll = [roll];
    },
  };
}

// ============================================================ F: la pelea
/** 0 → 1 → 0 en `dur` segundos desde `t0`. */
const bump = (f, t0, dur) => Math.sin(Math.PI * seg(f, t0, t0 + dur));

function buildF() {
  const scene = new THREE.Scene();
  env(scene);
  scene.fog = new THREE.Fog(0x0a0706, 9, 20);
  const arena = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.06, 72), new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 0.85 }));
  arena.position.y = -0.04; scene.add(arena);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.045, 8, 120), new THREE.MeshStandardMaterial({ color: C.orange, emissive: C.orange, emissiveIntensity: 0.9 }));
  rim.rotation.x = Math.PI / 2; scene.add(rim);

  const glove = (color) => new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
  const hose = (color) => cylinder(0.07, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }), 12);

  // ------------------------------------------------ el horno
  const ovenRoot = new THREE.Group(); scene.add(ovenRoot);   // posición y caída
  const ovenYaw = new THREE.Group(); ovenYaw.rotation.y = 0.6; ovenRoot.add(ovenYaw);
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9aa4, metalness: 0.55, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 });
  const shell = new THREE.Mesh(new RoundedBoxGeometry(1.35, 1.5, 1.0, 5, 0.08), steel); shell.position.y = 1.05; ovenYaw.add(shell);
  const panel = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.38, 0.05, 4, 0.03), dark); panel.position.set(0, 1.58, 0.51); ovenYaw.add(panel);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  const eyes = [-0.3, 0.3].map((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), eyeMat); e.scale.z = 0.5; e.position.set(x, 1.58, 0.56);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), pupilMat); p.position.set(x + 0.04, 1.58, 0.62);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), dark); b.position.set(x, 1.79, 0.56); b.rotation.z = x < 0 ? -0.42 : 0.42;
    ovenYaw.add(e, p, b);
    return { e, p, b };
  });
  [-0.56, 0.56].forEach((x) => {
    const k = cylinder(0.075, new THREE.MeshStandardMaterial({ color: 0x5a5a62, metalness: 0.6, roughness: 0.3 }), 16);
    k.rotation.x = Math.PI / 2; k.scale.set(1, 0.08, 1); k.position.set(x, 1.58, 0.54); ovenYaw.add(k);
  });
  const inside = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.88, 0.04, 3, 0.02), new THREE.MeshStandardMaterial({ color: 0x120a07, emissive: 0xff5a1a, emissiveIntensity: 0.25 }));
  inside.position.set(0, 0.88, 0.505); ovenYaw.add(inside);
  const doorPivot = new THREE.Group(); doorPivot.position.set(0, 0.42, 0.52); ovenYaw.add(doorPivot);
  const door = new THREE.Mesh(new RoundedBoxGeometry(1.16, 0.84, 0.07, 4, 0.03), steel); door.position.y = 0.44; doorPivot.add(door);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a0d08, emissive: 0xff5a1a, emissiveIntensity: 0.4, roughness: 0.2 });
  const glass = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.5, 0.03, 3, 0.02), glassMat); glass.position.set(0, 0.4, 0.05); doorPivot.add(glass);
  const handle = cylinder(0.03, dark, 10); handle.rotation.z = Math.PI / 2; handle.scale.set(1, 0.8, 1); handle.position.set(0, 0.78, 0.1); doorPivot.add(handle);
  [-0.4, 0.4].forEach((x) => {
    const leg = cylinder(0.09, dark, 12); setLimb(leg, new THREE.Vector3(x, 0.3, 0.1), new THREE.Vector3(x, 0.06, 0.1)); ovenYaw.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.42), dark); foot.position.set(x, 0.04, 0.2); ovenYaw.add(foot);
  });
  const ovenArms = [{ s: new THREE.Vector3(0.74, 1.15, 0.1), g: glove(0xd0211a), h: hose(0x7a7a84) }, { s: new THREE.Vector3(-0.74, 1.15, 0.1), g: glove(0xd0211a), h: hose(0x7a7a84) }];
  ovenArms.forEach((a) => ovenYaw.add(a.g, a.h));

  // ------------------------------------------------ PostureFix
  const heroRoot = new THREE.Group(); scene.add(heroRoot);
  const heroYaw = new THREE.Group(); heroYaw.rotation.y = -0.6; heroRoot.add(heroYaw);
  const faceCv = document.createElement('canvas'); faceCv.width = 256; faceCv.height = 512;
  const fg = faceCv.getContext('2d');
  const faceTex = new THREE.CanvasTexture(faceCv); faceTex.colorSpace = THREE.SRGBColorSpace;
  const phoneBody = new THREE.Mesh(new RoundedBoxGeometry(0.86, 1.5, 0.14, 6, 0.09), new THREE.MeshStandardMaterial({ color: 0x1d1512, roughness: 0.3, metalness: 0.6, emissive: 0x2a1308, emissiveIntensity: 0.5 }));
  phoneBody.position.y = 1.3; heroYaw.add(phoneBody);
  const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 1.4), new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false }));
  faceMesh.position.set(0, 1.3, 0.076); heroYaw.add(faceMesh);
  const orangeMat = new THREE.MeshStandardMaterial({ color: C.orange, emissive: C.orange, emissiveIntensity: 0.3, roughness: 0.5 });
  [-0.22, 0.22].forEach((x) => {
    const leg = cylinder(0.075, orangeMat, 12); setLimb(leg, new THREE.Vector3(x, 0.56, 0), new THREE.Vector3(x, 0.1, 0)); heroYaw.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.44), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })); shoe.position.set(x, 0.05, 0.1); heroYaw.add(shoe);
  });
  const heroArms = [{ s: new THREE.Vector3(-0.5, 1.5, 0.05), g: glove(0xff7a29), h: hose(0xff7a29) }, { s: new THREE.Vector3(0.5, 1.5, 0.05), g: glove(0xff7a29), h: hose(0xff7a29) }];
  heroArms.forEach((a) => heroYaw.add(a.g, a.h));

  function drawFace(mood, charge) {
    fg.clearRect(0, 0, 256, 512);
    fg.fillStyle = charge > 0.01 ? `rgb(${Math.round(11 + 150 * charge)}, ${Math.round(8 + 10 * charge)}, ${Math.round(7 + 10 * charge)})` : '#0b0807';
    fg.fillRect(0, 0, 256, 512);
    fg.lineCap = 'round'; fg.lineWidth = 12;
    const eye = (cx) => {
      if (mood === 'hit') { fg.strokeStyle = '#fff'; fg.beginPath(); fg.moveTo(cx - 26, 150); fg.lineTo(cx + 22, 190); fg.moveTo(cx + 22, 150); fg.lineTo(cx - 26, 190); fg.stroke(); return; }
      if (mood === 'win') { fg.strokeStyle = '#fff'; fg.beginPath(); fg.arc(cx, 190, 30, Math.PI * 1.1, Math.PI * 1.9); fg.stroke(); return; }
      fg.fillStyle = '#fff'; fg.beginPath(); fg.ellipse(cx, 170, 32, 44 + 6 * charge, 0, 0, Math.PI * 2); fg.fill();
      fg.fillStyle = charge > 0.5 ? '#ff453a' : '#111'; fg.beginPath(); fg.arc(cx - 11, 176, 15, 0, Math.PI * 2); fg.fill();
    };
    eye(84); eye(172);
    if (mood !== 'win' && mood !== 'hit') { // cejas decididas
      fg.strokeStyle = '#ff7a29'; fg.lineWidth = 14;
      fg.beginPath(); fg.moveTo(48, 108); fg.lineTo(112, 128); fg.moveTo(208, 108); fg.lineTo(144, 128); fg.stroke();
    }
    // La boca es el anillo del medidor.
    fg.lineWidth = 16; fg.strokeStyle = mood === 'hit' ? '#ff453a' : '#30D158';
    fg.beginPath();
    if (mood === 'win') fg.arc(128, 300, 56, 0.1 * Math.PI, 0.9 * Math.PI);
    else if (mood === 'hit') fg.arc(128, 350, 40, 1.1 * Math.PI, 1.9 * Math.PI);
    else fg.moveTo(84, 330), fg.lineTo(172, 330);
    fg.stroke();
    fg.fillStyle = '#fff'; fg.font = '900 74px "Big Shoulders Display", sans-serif'; fg.textAlign = 'center';
    fg.fillText(mood === 'hit' ? '22°' : '0°', 128, 450);
    faceTex.needsUpdate = true;
  }

  // ------------------------------------------------ efectos
  const emissive = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, transparent: true, depthWrite: false });
  const mkRing = (c, r = 0.4, tube = 0.06) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 40), emissive(c)); m.visible = false; scene.add(m); m.rotation.y = Math.PI / 2; return m; };
  const heatRings = [0, 1, 2].map(() => mkRing(0xff5a1a));
  const bigHeat = [0, 1, 2].map(() => mkRing(0xff3a10, 0.6, 0.12));
  const beepRings = [0, 1, 2, 3].map(() => mkRing(0xffd60a));
  const easRings = [mkRing(0xff453a, 0.7, 0.14), mkRing(0xffffff, 0.7, 0.1), mkRing(0xff453a, 0.7, 0.14)];
  const flashMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false });
  const sparks = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), flashMat(0xffffff)); m.visible = false; scene.add(m); return m; });
  const smoke = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: 0x8a8a92, transparent: true, depthWrite: false })); m.visible = false; scene.add(m); return m; });
  const toast = [0, 1].map(() => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.4, 0.09, 3, 0.04), new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 })); m.visible = false; scene.add(m); return m; });

  const travel = (mesh, f, t0, t1, xa, xb, y, scale0, scale1) => {
    const k = seg(f, t0, t1);
    mesh.visible = k > 0 && k < 1;
    if (!mesh.visible) return;
    mesh.position.set(lerp(xa, xb, k), y, 0.1);
    const s = lerp(scale0, scale1, k);
    mesh.scale.setScalar(s);
    mesh.material.opacity = 1 - 0.5 * k;
  };
  const spark = (m, f, t0, x, y, size = 1.2) => {
    const k = seg(f, t0, t0 + 0.28);
    m.visible = k > 0 && k < 1;
    if (!m.visible) return;
    m.position.set(x, y, 0.4);
    m.scale.setScalar(lerp(0.3, size, easeOut(k)));
    m.material.opacity = 1 - k;
  };

  const OVEN_HITS = [[3.65, 18], [6.05, 16], [6.55, 16], [7.05, 14], [10.3, 36]];
  const HERO_HITS = [[5.3, 14], [8.9, 8]];
  const hp = (hits, f) => 100 - hits.reduce((s, [t, d]) => s + d * easeOut(seg(f, t, t + 0.25)), 0);
  const HERO_JABS = [3.4, 5.8, 6.3, 6.8];
  const pose = new THREE.Vector3();

  return {
    scene,
    update(f) {
      // ---------- posiciones de los dos
      const ovenX = lerp(-6.5, -1.9, easeOut(seg(f, 0, 1.3))) - 0.35 * OVEN_HITS.reduce((s, [t]) => s + (t < 10 ? bump(f, t, 0.35) : 0), 0) - 0.9 * easeOut(seg(f, 10.3, 11.1));
      const heroX = lerp(6.5, 1.9, easeOut(seg(f, 0, 1.3))) + 0.35 * HERO_HITS.reduce((s, [t]) => s + bump(f, t, 0.35), 0) - 0.15 * bump(f, 2.4, 0.5);
      const step = (f < 1.3 ? Math.abs(Math.sin(f * 11)) * 0.12 : 0);
      const idle = Math.sin(f * 5) * 0.03;
      const win = f > 11.6 ? Math.abs(Math.sin((f - 11.6) * 5.5)) * 0.55 * (1 - seg(f, 11.6, 14)) : 0;
      const duck = 0.2 * bump(f, 2.4, 0.5);
      ovenRoot.position.set(ovenX, step + idle * (f < 10.3 ? 1 : 0), 0);
      ovenRoot.rotation.z = 1.45 * easeOut(seg(f, 10.3, 11.1)) + 0.06 * Math.sin(f * 40) * (f > 10.3 && f < 10.6 ? 1 : 0);
      heroRoot.position.set(heroX, step + idle + win - duck, 0);
      heroRoot.rotation.z = 0.12 * bump(f, 2.4, 0.5) - 0.1 * HERO_HITS.reduce((s, [t]) => s + bump(f, t, 0.35), 0);
      heroYaw.scale.setScalar(1 + 0.1 * bump(f, 9.2, 0.65) * (f < 9.9 ? 1 : 0));

      // ---------- brazos (en coordenadas del mundo, luego al sistema del personaje)
      scene.updateMatrixWorld(true);
      const place = (arm, yaw, target) => {
        const sh = yaw.localToWorld(arm.s.clone());
        arm.g.position.copy(yaw.worldToLocal(target.clone()));
        setLimb(arm.h, arm.s, arm.g.position);
        void sh;
      };
      // Horno: el brazo hacia el héroe pega en 2.4 (falla) y los dos suben al soplar.
      const raiseO = Math.max(bump(f, 4.6, 0.9), bump(f, 8.0, 1.1));
      const jabO = bump(f, 2.4, 0.55);
      pose.set(ovenX + 0.9 + 2.0 * jabO - 0.1 * raiseO, 1.05 + 0.5 * raiseO, 0.45); place(ovenArms[0], ovenYaw, pose);
      pose.set(ovenX + 0.35 - 0.2 * raiseO, 1.0 + 0.7 * raiseO + Math.sin(f * 6) * 0.04, 0.7); place(ovenArms[1], ovenYaw, pose);
      // Héroe: jabs, guardia, carga y festejo.
      const jabH = HERO_JABS.reduce((s, t) => s + bump(f, t, 0.35), 0);
      const charge = seg(f, 9.2, 9.8) * (1 - seg(f, 9.8, 9.95));
      const winUp = seg(f, 11.5, 11.9);
      const guard = bump(f, 8.4, 1.0);
      pose.set(heroX - 0.8 - 2.1 * Math.min(1, jabH) + 0.5 * guard + 0.3 * charge, 1.25 + 0.7 * winUp + 0.3 * guard, 0.45); place(heroArms[0], heroYaw, pose);
      pose.set(heroX - 0.4 + 0.3 * guard - 0.5 * charge, 1.2 + 0.7 * winUp + 0.3 * guard, 0.6); place(heroArms[1], heroYaw, pose);

      // ---------- ojos del horno y su boca (la puerta brilla al atacar)
      const heat = Math.max(bump(f, 4.6, 0.9), bump(f, 8.0, 1.1) * 1.4);
      glassMat.emissiveIntensity = 0.4 + 3.2 * heat;
      eyes.forEach((e) => { e.p.position.x = e.e.position.x + 0.05; e.p.position.y = 1.58 - 0.02 * (f > 10.3 ? 1 : 0); });
      doorPivot.rotation.x = 1.7 * easeOut(seg(f, 10.5, 11.0));
      const koMood = f > 10.3 && f < 10.9;
      eyes.forEach((e) => { e.e.scale.y = koMood ? 0.15 : 1; e.p.visible = !koMood; });

      // ---------- el héroe: cara según el momento
      const hitNow = HERO_HITS.some(([t]) => f >= t && f < t + 0.35);
      drawFace(f > 11.5 ? 'win' : hitNow ? 'hit' : 'idle', charge);

      // ---------- ataques: ondas de calor, pitidos y alarma
      const oy = 1.15, hy = 1.3;
      travel(heatRings[0], f, 4.8, 5.3, ovenX + 0.9, heroX - 0.6, oy, 0.5, 1.4);
      travel(heatRings[1], f, 4.9, 5.4, ovenX + 0.9, heroX - 0.6, oy, 0.4, 1.2);
      travel(heatRings[2], f, 5.0, 5.5, ovenX + 0.9, heroX - 0.6, oy, 0.3, 1.0);
      [0, 1, 2].forEach((i) => travel(bigHeat[i], f, 8.4 + i * 0.1, 8.95 + i * 0.1, ovenX + 0.9, heroX - 0.5, oy + 0.2, 0.6, 2.0));
      HERO_JABS.forEach((t, i) => travel(beepRings[i], f, t, t + 0.25, heroX - 0.9, ovenX + 0.7, hy, 0.5, 1.1));
      easRings.forEach((r, i) => travel(r, f, 9.8 + i * 0.12, 10.3 + i * 0.12, heroX - 0.9, ovenX + 0.5, hy, 0.6, 2.8));
      // chispas de impacto
      const ox = ovenX, hx = heroX;
      spark(sparks[0], f, 3.65, ox + 0.8, 1.2); spark(sparks[1], f, 5.3, hx - 0.6, 1.3);
      [6.05, 6.55, 7.05].forEach((t) => spark(sparks[0], f, t, ox + 0.8, 1.2));
      spark(sparks[1], f, 8.9, hx - 0.6, 1.3, 1.8);
      spark(sparks[0], f, 10.3, ox + 0.8, 1.2, 3.4);

      // ---------- K.O.: humo y tostadas
      smoke.forEach((m, i) => {
        const k = seg(f, 10.4 + i * 0.12, 12.0 + i * 0.12);
        m.visible = k > 0 && k < 1;
        if (!m.visible) return;
        m.position.set(ox - 0.3 + Math.sin(i * 2.1 + f * 2) * 0.35, 0.8 + 1.8 * k, 0.5);
        m.scale.setScalar(0.6 + 1.6 * k);
        m.material.opacity = 0.55 * (1 - k);
      });
      toast.forEach((m, i) => {
        const tau = f - (10.85 + i * 0.1);
        m.visible = tau > 0 && tau < 3;
        if (!m.visible) return;
        const v = [[1.2, 5.4], [-0.5, 6.2]][i];
        m.position.set(ox - 0.3 + v[0] * tau, 0.9 + v[1] * tau - 4.9 * tau * tau, 0.6);
        m.rotation.set(tau * 3 * (i ? -1 : 1), 0, tau * 5);
        if (m.position.y < 0.2) m.position.y = 0.2;
      });

      // ---------- cámara: dos planos, más cerca al final
      const zoom = lerp(7.4, 6.2, easeInOut(seg(f, 9.0, 10.3))) + 0.6 * seg(f, 12.0, 14);
      const shake = (hit) => hit * Math.sin(f * 90) * 0.05;
      const sh = shake(bump(f, 10.3, 0.5)) + shake(0.3 * bump(f, 5.3, 0.3));
      camera.position.set(Math.sin(f * 0.3) * 0.6 + sh, 2.0 + 0.15 * Math.sin(f * 0.4), zoom);
      camera.lookAt(-0.1, 1.05, 0);
      camera.clearViewOffset();
      camera.updateMatrixWorld();
      project('oven', new THREE.Vector3(ox, 2.1, 0));
      project('hero', new THREE.Vector3(hx, 2.3, 0));
      screen.hpOven = [hp(OVEN_HITS, f)]; screen.hpHero = [hp(HERO_HITS, f)];
    },
  };
}

// ============================================================ reparto
const A = buildA(), B = buildB(), Cc = buildC(), D = buildD(), F = buildF();
const SCENES = [
  { s: A, a: 0, b: 7.2 },
  { s: B, a: 7.0, b: 13.2 },
  { s: Cc, a: 13.0, b: 23.2 },
  { s: D, a: 32.5, b: 48.0 },
  { s: F, a: 71.0, b: 85.0 },
];

window.T3 = {
  screen,
  active: null,
  render(t) {
    const hit = SCENES.find((x) => t >= x.a && t < x.b);
    if (!hit) { canvas.style.opacity = '0'; T3.active = null; return; }
    const local = t - hit.a;
    hit.s.update(local);
    renderer.render(hit.s.scene, camera);
    // Fundidos suaves de entrada y salida.
    canvas.style.opacity = String(Math.min(seg(t, hit.a, hit.a + 0.3), 1 - seg(t, hit.b - 0.3, hit.b)).toFixed(3));
    T3.active = SCENES.indexOf(hit);
  },
};
