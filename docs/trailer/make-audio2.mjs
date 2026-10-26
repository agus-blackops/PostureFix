#!/usr/bin/env node
/**
 * Banda sonora del tráiler 2 (vertical, 24 s). Más seca y rítmica que la del
 * primero: golpes de texto, pitido, cuenta, tono EAS y un ritmo a 120 ppm.
 *
 *   node docs/trailer/make-audio2.mjs salida.wav
 */
import { createMixer } from './audio-lib.mjs';

const DURATION = 24.5;
const { TAU, mtof, clamp01, add, tone, noise, kick, hat, snare, whoosh, impact, finish } = createMixer(DURATION);
const BEAT = 0.5;

const CHORDS = [
  { notes: [57, 60, 64], bass: 33 }, // La menor
  { notes: [53, 57, 60], bass: 29 }, // Fa
  { notes: [60, 64, 67], bass: 36 }, // Do
  { notes: [55, 59, 62], bass: 31 }, // Sol
];

/** Música entre `from` y `to`, con los compases contados desde `origin`. */
function music(from, to, origin, { drumsFrom = from, snareFrom = Infinity, kickOn = true, arpAmp = 0.1, padAmp = 0.05 } = {}) {
  const bar = 4 * BEAT;
  for (let b = Math.floor((from - origin) / bar); origin + b * bar < to; b++) {
    const start = origin + b * bar;
    const chord = CHORDS[((b % 4) + 4) % 4];
    const t0 = Math.max(start, from);
    const dur = Math.min(start + bar, to) - t0;
    if (dur <= 0.05) continue;
    chord.notes.forEach((m) => {
      [-1, 1].forEach((side) => {
        add(
          t0,
          dur + 0.4,
          (tr) => {
            const env = Math.min(1, tr / 0.25) * Math.min(1, (dur + 0.4 - tr) / 0.4);
            const f = mtof(m) * 2 ** ((side * 3) / 1200);
            return (Math.sin(TAU * f * tr) + 0.3 * Math.sin(TAU * 2 * f * tr)) * env * padAmp;
          },
          side * 0.6
        );
      });
    });
    for (const beat of [0, 2]) {
      const tb = start + beat * BEAT;
      if (tb >= from && tb < to) tone(tb, 0.9, mtof(chord.bass), { amp: 0.22, tau: 0.45, shape: 'tri' });
    }
    for (let i = 0; i < 8; i++) {
      const ta = start + i * 0.25;
      if (ta < drumsFrom || ta >= to) continue;
      const m = chord.notes[[0, 1, 2, 1, 2, 1, 0, 2][i] % 3] + 12;
      [[0, 1], [0.375, 0.4], [0.75, 0.16]].forEach(([d, g]) => {
        if (ta + d < to + 0.5) tone(ta + d, 0.5, mtof(m), { amp: arpAmp * g, tau: 0.15, shape: 'tri', pan: i % 2 ? 0.45 : -0.45 });
      });
    }
    for (let q = 0; q < 4; q++) {
      const tq = start + q * BEAT;
      if (tq < drumsFrom || tq >= to) continue;
      if (kickOn) kick(tq, 0.5);
      hat(tq + BEAT / 2);
      if (tq >= snareFrom && q % 2 === 1) snare(tq);
    }
  }
}

// ---------------------------------------------------------------- A: el gancho
// Cuatro golpes de palabra, cada uno más agudo, y un zumbido que sube.
[110, 130, 155, 185].forEach((f, k) => {
  const t = k * 0.35 + (k === 3 ? 0 : 0);
  kick(t, 0.6);
  tone(t, 0.25, f, { amp: 0.35, tau: 0.09, shape: 'square' });
  noise(t, 0.12, { amp: 0.25, tau: 0.04, hp: true });
});
add(0, 2.4, (tr) => {
  const g = 0.05 + 0.16 * clamp01(tr / 2.2);
  return (Math.sin(TAU * 55 * tr) + 0.5 * Math.sin(TAU * 82.4 * tr)) * g * Math.min(1, tr / 0.3);
});
noise(1.2, 1.2, { amp: 0.3, tau: 9, a: 1.1, lp: (tr) => 300 + 9000 * clamp01(tr / 1.2) ** 2 });

// ------------------------------------------------------------- B: el teléfono
impact(2.4, 0.8);
music(2.8, 8.4, 2.4, { drumsFrom: 4.4, kickOn: true, arpAmp: 0.08 });
tone(4.4, 0.4, 330, { amp: 0.15, tau: 0.15, shape: 'bell' });
tone(5.0, 0.6, 196, { amp: 0.2, tau: 0.3, shape: 'tri' }); // el ángulo pasa el umbral
noise(6.6, 1.8, { amp: 0.3, tau: 9, a: 1.7, lp: (tr) => 300 + 9000 * clamp01(tr / 1.8) ** 2 });

// --------------------------------------------------------------- C: la alerta
[1046, 1568, 1046, 1568].forEach((f, k) => {
  const t = 8.4 + k * 0.3;
  tone(t, 0.2, f, { amp: 0.38, a: 0.004, hold: true, shape: 'square' });
  kick(t, 0.25);
});
[660, 784, 988].forEach((f, k) => {
  const t = 9.6 + k * 0.8;
  tone(t, 0.5, f, { amp: 0.4, tau: 0.14, shape: 'bell' });
  kick(t, 0.5 + 0.1 * k);
});
noise(11.0, 1.0, { amp: 0.25, tau: 9, a: 0.95, lp: (tr) => 300 + 9000 * clamp01(tr / 1.0) ** 2 });
impact(12.0, 0.6);
add(12.0, 2.4, (tr) => {
  const env = Math.min(1, tr / 0.01) * Math.min(1, (2.4 - tr) / 0.03);
  return (Math.sin(TAU * 853 * tr) + Math.sin(TAU * 960 * tr)) * 0.17 * env;
});
for (let t = 12.0; t < 14.4; t += 0.4) tone(t, 0.3, 70, { amp: 0.4, tau: 0.12 });
[72, 76, 79, 84].forEach((m, k) => tone(14.4 + k * 0.06, 2.0, mtof(m), { amp: 0.13, tau: 0.9, shape: 'bell', pan: (k - 1.5) / 3 }));
tone(14.4, 1.6, mtof(36), { amp: 0.25, tau: 0.7, shape: 'tri' });

// ------------------------------------------------------- D: más que un aviso
music(15.0, 19.6, 15.0, { drumsFrom: 15.0, snareFrom: 15.5, arpAmp: 0.11, padAmp: 0.055 });
[15.0, 15.25, 15.2, 16.25, 17.3, 18.35].forEach((t) => whoosh(t - 0.15, 0.3, 0.12));
[15.2, 16.25, 17.3, 18.35].forEach((t) => tone(t, 0.3, 880, { amp: 0.12, tau: 0.08, shape: 'bell' }));
noise(18.6, 1.0, { amp: 0.25, tau: 9, a: 0.95, lp: (tr) => 300 + 9000 * clamp01(tr / 1.0) ** 2 });

// ------------------------------------------------------------------ E: cierre
impact(19.6, 0.85);
kick(19.6, 0.6);
[45, 57, 60, 64, 69].forEach((m) => tone(19.6, 5.0, mtof(m), { amp: 0.08, a: 0.05, tau: 2.2, shape: 'tri' }));
[81, 76, 72, 79, 84, 88].forEach((m, k) => tone(20.1 + k * 0.45, 2.2, mtof(m), { amp: 0.09, tau: 1.0, shape: 'bell', pan: k % 2 ? 0.4 : -0.4 }));

finish(process.argv[2] || 'trailer2.wav', { fadeOutAt: 23.1, fadeOutLen: 1.3 });
