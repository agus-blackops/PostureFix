/**
 * Piezas comunes para sintetizar las bandas sonoras de los tráileres: osciladores,
 * ruido, bombo, golpes y la escritura del WAV. Todo es código, sin muestras.
 */
import { writeFileSync } from 'node:fs';

export function createMixer(DURATION) {
const SR = 44100;
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


  /** Calla el tramo entre `a` y `b` (el instante de silencio antes de un golpe). */
  function silenceGap(a, b) {
    const i0 = Math.floor(a * SR);
    const i1 = Math.floor(b * SR);
    for (let i = i0; i < i1 && i < N; i++) {
      L[i] = 0;
      R[i] = 0;
    }
  }

  /** Suaviza, funde la entrada y la salida, normaliza y escribe el WAV. */
  function finish(target, { fadeIn = 0.3, fadeOutAt = DURATION - 1.6, fadeOutLen = 1.5 } = {}) {
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      const g = Math.min(1, t / fadeIn) * (1 - clamp01((t - fadeOutAt) / fadeOutLen));
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
    writeFileSync(target, out);
    console.log(`${target}: ${DURATION} s, pico ${peak.toFixed(2)} → ${(peak * norm).toFixed(2)}`);
  }

  return { SR, TAU, mtof, clamp01, rnd, add, tone, noise, kick, hat, snare, whoosh, impact, silenceGap, finish };
}
