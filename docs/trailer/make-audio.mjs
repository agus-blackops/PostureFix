#!/usr/bin/env node
/**
 * Banda sonora del tráiler, sintetizada sin muestras ni programas externos:
 * latidos y zumbido de tensión, golpes, el pitido y el tono EAS de la app, y una
 * música de 120 pulsaciones por minuto. Cada sonido cae en el instante exacto
 * en que ocurre en `trailer.html` (mismo reloj).
 *
 *   node docs/trailer/make-audio.mjs salida.wav
 */
import { writeFileSync } from 'node:fs';

const SR = 44100;
const DURATION = 48.5;
const N = Math.floor(SR * DURATION);
const L = new Float32Array(N);
const R = new Float32Array(N);

// Ruido repetible: el audio sale idéntico cada vez.
let seed = 20261026;
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
const TAU = Math.PI * 2;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Suma una señal `fn(segundosDesdeElInicio)` al estéreo, con panorama -1…1. */
function add(t0, dur, fn, pan = 0, gain = 1) {
  const i0 = Math.floor(t0 * SR);
  const i1 = Math.min(N, Math.floor((t0 + dur) * SR));
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = Math.max(0, i0); i < i1; i++) {
    const v = fn((i - i0) / SR);
    L[i] += v * gl;
    R[i] += v * gr;
  }
}

/** Nota con ataque corto y caída exponencial. */
function tone(t0, dur, freq, { amp = 0.3, a = 0.005, tau = 0.3, pan = 0, shape = 'sin', hold = false } = {}) {
  add(
    t0,
    dur,
    (tr) => {
      const env = Math.min(1, tr / a) * (hold ? 1 : Math.exp(-tr / tau)) * Math.min(1, (dur - tr) / 0.01);
      const p = TAU * freq * tr;
      let v;
      if (shape === 'tri') v = (2 / Math.PI) * Math.asin(Math.sin(p));
      else if (shape === 'bell') v = Math.sin(p) + 0.45 * Math.sin(p * 2.76) + 0.25 * Math.sin(p * 5.4);
      else if (shape === 'square') v = Math.sin(p) + Math.sin(3 * p) / 3 + Math.sin(5 * p) / 5;
      else v = Math.sin(p);
      return v * env * amp;
    },
    pan
  );
}

/** Ruido filtrado: `lp(tr)` es la frecuencia de corte en Hz. */
function noise(t0, dur, { amp = 0.3, tau = 0.2, a = 0.002, lp = () => 4000, hp = false, pan = 0 } = {}) {
  let y = 0;
  let prev = 0;
  add(
    t0,
    dur,
    (tr) => {
      const k = 1 - Math.exp((-TAU * lp(tr)) / SR);
      const x = rnd();
      y += k * (x - y);
      const v = hp ? x - prev : y;
      prev = x;
      return v * Math.min(1, tr / a) * Math.exp(-tr / tau) * amp;
    },
    pan
  );
}

function kick(t0, amp = 0.55) {
  let ph = 0;
  add(t0, 0.5, (tr) => {
    ph += (TAU * (46 + 110 * Math.exp(-tr * 32))) / SR;
    return Math.sin(ph) * Math.exp(-tr / 0.16) * amp * Math.min(1, tr / 0.002);
  });
}
const hat = (t0, amp = 0.07, pan = 0.3) => noise(t0, 0.08, { amp, tau: 0.025, hp: true, pan });
function snare(t0, amp = 0.28) {
  noise(t0, 0.3, { amp, tau: 0.09, lp: () => 7000, pan: 0 });
  tone(t0, 0.2, 190, { amp: amp * 0.8, tau: 0.05 });
}
function whoosh(t0, dur = 0.7, amp = 0.2) {
  noise(t0, dur, { amp, tau: dur * 0.55, a: dur * 0.5, lp: (tr) => 200 + 7000 * clamp01(tr / dur) ** 2 });
}
function impact(t0, amp = 0.9) {
  tone(t0, 2.4, 46, { amp, tau: 0.8 });
  tone(t0, 0.9, 92, { amp: amp * 0.4, tau: 0.25 });
  noise(t0, 1.2, { amp: amp * 0.55, tau: 0.22, lp: (tr) => 6000 * Math.exp(-tr * 2.4) + 200 });
}

// ------------------------------------------------------------------- escena 1
// Zumbido grave que va creciendo y latidos cada vez más seguidos.
const droneEnd = 7.5;
add(0, droneEnd, (tr) => {
  const g = (0.04 + 0.2 * clamp01(tr / 7.2) ** 1.5) * (1 + 0.15 * Math.sin(TAU * 0.35 * tr));
  const v = Math.sin(TAU * 55 * tr) + 0.5 * Math.sin(TAU * 82.4 * tr) + 0.35 * Math.sin(TAU * 110.7 * tr);
  return v * g * Math.min(1, tr / 0.8);
});
for (let t = 0.9; t < 7.2; ) {
  const k = clamp01(t / 7);
  kick(t, 0.32 + 0.2 * k);
  kick(t + 0.2, 0.18 + 0.12 * k);
  t += 1.15 - 0.55 * k;
}
noise(5.4, 2.1, { amp: 0.3, tau: 9, a: 2.0, lp: (tr) => 300 + 9000 * clamp01(tr / 2.1) ** 2 });

// ------------------------------------------------------------------- música
const CHORDS = [
  { notes: [57, 60, 64], bass: 33 }, // La menor
  { notes: [53, 57, 60], bass: 29 }, // Fa
  { notes: [60, 64, 67], bass: 36 }, // Do
  { notes: [55, 59, 62], bass: 31 }, // Sol
];
const BEAT = 0.5;

/** Música desde `from` hasta `to`; los compases empiezan en `origin`. */
function music(from, to, origin, { drums = from, snareFrom = Infinity, arpAmp = 0.085, kickTo = to, bassAmp = 0.2, padAmp = 0.05 } = {}) {
  const bar = 4 * BEAT;
  for (let b = Math.floor((from - origin) / bar); origin + b * bar < to; b++) {
    const start = origin + b * bar;
    const chord = CHORDS[((b % 4) + 4) % 4];
    const t0 = Math.max(start, from);
    const dur = Math.min(start + bar, to) - t0;
    if (dur <= 0.05) continue;
    // Colchón: dos voces desafinadas por nota, una por oído.
    chord.notes.forEach((m) => {
      [-1, 1].forEach((side) => {
        add(
          t0,
          dur + 0.5,
          (tr) => {
            const env = Math.min(1, tr / 0.7) * Math.min(1, (dur + 0.5 - tr) / 0.5);
            const f = mtof(m) * 2 ** ((side * 3) / 1200);
            return (Math.sin(TAU * f * tr) + 0.3 * Math.sin(TAU * 2 * f * tr)) * env * padAmp;
          },
          side * 0.6
        );
      });
    });
    // Bajo en el primer y tercer tiempo.
    for (const beat of [0, 2]) {
      const tb = start + beat * BEAT;
      if (tb >= from && tb < to) tone(tb, 0.9, mtof(chord.bass), { amp: bassAmp, tau: 0.45, shape: 'tri' });
    }
    // Arpegio en corcheas, con eco.
    for (let i = 0; i < 8; i++) {
      const ta = start + i * 0.25;
      if (ta < drums || ta >= to) continue;
      const m = chord.notes[[0, 1, 2, 1, 2, 1, 0, 2][i] % 3] + 12;
      [[0, 1], [0.375, 0.42], [0.75, 0.18]].forEach(([delay, g]) => {
        if (ta + delay < to + 0.6) tone(ta + delay, 0.5, mtof(m), { amp: arpAmp * g, tau: 0.16, shape: 'tri', pan: i % 2 ? 0.45 : -0.45 });
      });
    }
    // Percusión.
    for (let q = 0; q < 4; q++) {
      const tq = start + q * BEAT;
      if (tq < drums || tq >= to) continue;
      if (tq < kickTo) kick(tq, 0.5);
      hat(tq + BEAT / 2);
      if (tq >= snareFrom && q % 2 === 1) snare(tq);
    }
  }
}

// Escena 2: golpe de título y colchón.
silenceGap(droneEnd, 8.0);
impact(8.0, 0.95);
[57, 60, 64, 69].forEach((m) => tone(8.0, 3.2, mtof(m), { amp: 0.09, tau: 1.2, shape: 'tri' }));
music(8.3, 21.0, 8.0, { drums: 14.0, snareFrom: 17.0 });
whoosh(13.0, 0.6, 0.18);

// ------------------------------------------------------------------- escena 4
// Tensión, pitido, cuenta, alarma EAS y alivio.
add(21.0, 5.8, (tr) => {
  const g = 0.06 + 0.1 * clamp01(tr / 5);
  return (Math.sin(TAU * 55 * tr) + Math.sin(TAU * 58.3 * tr) + 0.4 * Math.sin(TAU * 77.8 * tr)) * g * Math.min(1, tr / 0.5);
});
[1046, 1568, 1046, 1568].forEach((f, k) => {
  const t = 21.5 + k * 0.3;
  tone(t, 0.2, f, { amp: 0.38, a: 0.004, hold: true, shape: 'square' });
  kick(t, 0.25);
});
[660, 784, 988].forEach((f, k) => {
  const t = 24.0 + k * 0.9;
  tone(t, 0.5, f, { amp: 0.4, tau: 0.14, shape: 'bell' });
  kick(t, 0.5 + 0.1 * k);
});
noise(25.2, 1.6, { amp: 0.22, tau: 9, a: 1.5, lp: (tr) => 300 + 8000 * clamp01(tr / 1.6) ** 2 });
impact(26.8, 0.6);
add(26.8, 2.8, (tr) => {
  const env = Math.min(1, tr / 0.01) * Math.min(1, (2.8 - tr) / 0.03);
  return (Math.sin(TAU * 853 * tr) + Math.sin(TAU * 960 * tr)) * 0.17 * env;
});
for (let t = 26.8; t < 29.6; t += 0.4) tone(t, 0.3, 70, { amp: 0.4, tau: 0.12 });
// Alivio.
[72, 76, 79, 84].forEach((m, k) => tone(29.6 + k * 0.07, 2.4, mtof(m), { amp: 0.13, tau: 0.9, shape: 'bell', pan: (k - 1.5) / 3 }));
tone(29.6, 2.0, mtof(36), { amp: 0.25, tau: 0.8, shape: 'tri' });
whoosh(30.0, 0.5, 0.15);

// ----------------------------------------------------------- escenas 5 a 7
music(30.5, 36.5, 30.5, { drums: 30.5, snareFrom: 31.5, arpAmp: 0.1 });
whoosh(35.8, 0.7, 0.16);
// Escena 6: sin bombo, el arpegio queda solo y el colchón sube.
music(36.5, 42.0, 36.5, { drums: 36.5, kickTo: 36.5, snareFrom: Infinity, arpAmp: 0.09, padAmp: 0.06 });
noise(39.6, 2.4, { amp: 0.3, tau: 9, a: 2.2, lp: (tr) => 300 + 9000 * clamp01(tr / 2.4) ** 2 });
for (let t = 40.0; t < 42.0; t += 0.5 - 0.3 * clamp01((t - 40) / 2)) kick(t, 0.4);
// Final.
impact(42.0, 0.85);
[45, 57, 60, 64, 69].forEach((m) => tone(42.0, 6.0, mtof(m), { amp: 0.08, a: 0.05, tau: 2.4, shape: 'tri' }));
[81, 76, 72, 79, 84, 88].forEach((m, k) => tone(42.6 + k * 0.5, 2.5, mtof(m), { amp: 0.09, tau: 1.0, shape: 'bell', pan: k % 2 ? 0.4 : -0.4 }));
kick(42.0, 0.6);

/** Nada suena entre `a` y `b` (el instante de silencio antes del golpe). */
function silenceGap(a, b) {
  const i0 = Math.floor(a * SR);
  const i1 = Math.floor(b * SR);
  for (let i = i0; i < i1 && i < N; i++) {
    L[i] = 0;
    R[i] = 0;
  }
}

// ----------------------------------------------------------------- masterización
// Se vuelve a callar el hueco (por si algo de arriba lo rellenó) y se funde al final.
silenceGap(7.5, 7.98);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = Math.min(1, t / 0.4) * (1 - clamp01((t - 46.8) / 1.7));
  L[i] = Math.tanh(L[i] * 1.5 * g);
  R[i] = Math.tanh(R[i] * 1.5 * g);
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = 0.9 / peak;

const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4);
}
const target = process.argv[2] || 'trailer.wav';
writeFileSync(target, out);
console.log(`${target}: ${DURATION} s, pico ${peak.toFixed(2)} → ${(peak * norm).toFixed(2)}`);
