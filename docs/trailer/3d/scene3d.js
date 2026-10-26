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

// ============================================================ reparto
const A = buildA(), B = buildB(), Cc = buildC(), D = buildD();
const SCENES = [
  { s: A, a: 0, b: 7.2 },
  { s: B, a: 7.0, b: 13.2 },
  { s: Cc, a: 13.0, b: 23.2 },
  { s: D, a: 33.5, b: 50.0 },
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
