#!/usr/bin/env node
/**
 * Banda sonora del tráiler 3 (77 s, con escenas en 3D). Cada sonido cae en el
 * instante exacto de `trailer3.html`: latidos, golpe de título, música a 120 ppm,
 * pitido, cuenta y tono EAS de la app, un silbido al salir cada eje 3D, y las
 * «indirectas» del final con clics de máquina de escribir y un golpe seco.
 *
 *   node docs/trailer/make-audio3.mjs salida.wav
 */
import { createMixer } from './audio-lib.mjs';
import { makeMusic } from './audio-music.mjs';

const DURATION = 77.5;
const mixer = createMixer(DURATION);
const { TAU, mtof, clamp01, add, tone, noise, kick, hat, whoosh, impact, silenceGap, finish } = mixer;
const music = makeMusic(mixer);
const riser = (t0, dur, amp = 0.28) =>
  noise(t0, dur, { amp, tau: 9, a: dur * 0.95, lp: (tr) => 300 + 9000 * clamp01(tr / dur) ** 2 });
const ping = (t, f, amp = 0.2) => tone(t, 0.5, f, { amp, tau: 0.16, shape: 'bell' });

// ------------------------------------------------ 0–7: la persona (3D)
add(0, 6.7, (tr) => {
  const g = (0.04 + 0.2 * clamp01(tr / 6.4) ** 1.5) * (1 + 0.15 * Math.sin(TAU * 0.35 * tr));
  const v = Math.sin(TAU * 55 * tr) + 0.5 * Math.sin(TAU * 82.4 * tr) + 0.35 * Math.sin(TAU * 110.7 * tr);
  return v * g * Math.min(1, tr / 0.8);
});
for (let t = 0.9; t < 6.4; ) {
  const k = clamp01(t / 6.2);
  kick(t, 0.32 + 0.2 * k);
  kick(t + 0.2, 0.18 + 0.12 * k);
  t += 1.15 - 0.55 * k;
}
riser(4.6, 2.1, 0.3);

// ------------------------------------------------ 7–13: el título (3D)
silenceGap(6.7, 7.0);
impact(7.0, 0.95);
[57, 60, 64, 69].forEach((m) => tone(7.0, 3.2, mtof(m), { amp: 0.09, tau: 1.2, shape: 'tri' }));
music(7.3, 13.0, 7.0, { drumsFrom: 13.0 });
whoosh(12.4, 0.6, 0.18);

// ------------------------------------------------ 13–23: el móvil (3D)
music(13.0, 23.0, 7.0, { drumsFrom: 14.0, snareFrom: 17.0 });
ping(17.8, 330, 0.18); // el ángulo pasa el umbral
tone(17.8, 0.6, 196, { amp: 0.22, tau: 0.3, shape: 'tri' });
riser(21.2, 1.8, 0.25);

// ------------------------------------------------ 23–32: la alerta (2D)
add(23.0, 5.8, (tr) => {
  const g = 0.06 + 0.1 * clamp01(tr / 5);
  return (Math.sin(TAU * 55 * tr) + Math.sin(TAU * 58.3 * tr) + 0.4 * Math.sin(TAU * 77.8 * tr)) * g * Math.min(1, tr / 0.5);
});
[1046, 1568, 1046, 1568].forEach((f, k) => {
  const t = 23.5 + k * 0.3;
  tone(t, 0.2, f, { amp: 0.38, a: 0.004, hold: true, shape: 'square' });
  kick(t, 0.25);
});
[660, 784, 988].forEach((f, k) => {
  const t = 26.0 + k * 0.9;
  tone(t, 0.5, f, { amp: 0.4, tau: 0.14, shape: 'bell' });
  kick(t, 0.5 + 0.1 * k);
});
riser(27.2, 1.6, 0.22);
impact(28.8, 0.6);
add(28.8, 2.8, (tr) => {
  const env = Math.min(1, tr / 0.01) * Math.min(1, (2.8 - tr) / 0.03);
  return (Math.sin(TAU * 853 * tr) + Math.sin(TAU * 960 * tr)) * 0.17 * env;
});
for (let t = 28.8; t < 31.6; t += 0.4) tone(t, 0.3, 70, { amp: 0.4, tau: 0.12 });
[72, 76, 79, 84].forEach((m, k) => tone(31.6 + k * 0.07, 2.4, mtof(m), { amp: 0.13, tau: 0.9, shape: 'bell', pan: (k - 1.5) / 3 }));
tone(31.6, 2.0, mtof(36), { amp: 0.25, tau: 0.8, shape: 'tri' });

// ------------------------------------------------ 32.5–48: los ejes (3D)
music(32.5, 54.0, 32.5, { drumsFrom: 32.5, snareFrom: 34.5, arpAmp: 0.105 });
// La pregunta: sin percusión, sólo colchón y bajo, para que se note el silencio.
music(54.0, 59.5, 32.5, { drumsFrom: 99, padAmp: 0.06 });
const D0 = 32.5;
whoosh(D0 + 0.8, 0.5, 0.15); ping(D0 + 1.0, mtof(72), 0.22); // arriba
whoosh(D0 + 4.9, 0.5, 0.15); ping(D0 + 5.1, mtof(76), 0.22); // delante
whoosh(D0 + 7.3, 0.5, 0.15); ping(D0 + 7.5, mtof(79), 0.22); // lado
ping(D0 + 8.5, mtof(84), 0.2); // ahora lo sabe todo
tone(D0 + 10.6, 0.6, mtof(60), { amp: 0.16, tau: 0.3, shape: 'tri' }); // hacia atrás: no cuenta
ping(D0 + 13.0, mtof(81), 0.18); // de lado

// ------------------------------------------------ 48–59.5: dos formas y la pregunta
whoosh(47.6, 0.5, 0.16);
riser(56.6, 2.9, 0.3);

// ------------------------------------------------ 59.5–64.5: más que un aviso
impact(59.5, 0.5);
music(59.5, 64.5, 59.5, { drumsFrom: 59.5, snareFrom: 60.5, arpAmp: 0.115 });
[60.0, 60.9, 61.8, 62.7].forEach((t) => { whoosh(t - 0.15, 0.3, 0.12); ping(t, 880, 0.12); });

// ------------------------------------------------ 64.5–71: las indirectas
add(64.5, 6.5, (tr) => {
  const g = 0.07 + 0.08 * clamp01(tr / 5.5);
  return (Math.sin(TAU * 49 * tr) + 0.6 * Math.sin(TAU * 73.4 * tr)) * g * Math.min(1, tr / 0.4) * Math.min(1, (6.5 - tr) / 0.1);
});
[65.2, 66.7, 68.0, 69.3].forEach((t0, i) => {
  // Chispazo de glitch al aparecer y clics de máquina de escribir.
  noise(t0, 0.18, { amp: 0.22, tau: 0.05, hp: true });
  tone(t0, 0.15, 1800 + i * 150, { amp: 0.12, tau: 0.04, shape: 'square' });
  for (let k = 0; k < 14; k++) noise(t0 + k * 0.04, 0.03, { amp: 0.07, tau: 0.01, hp: true, pan: k % 2 ? 0.3 : -0.3 });
  kick(t0, 0.3);
});
tone(66.4, 1.4, 2093, { amp: 0.16, tau: 0.5, shape: 'bell' }); // el «ding» del horno
riser(66.9, 0.9, 0.18); // sube la temperatura
ping(68.5, 660, 0.18); // sube el ángulo… y esta vez avisa
riser(69.3, 1.2, 0.3);
silenceGap(70.45, 70.5);
impact(70.5, 0.8); // «REVANCHA.»
[0.12, 0.24].forEach((d) => noise(70.5 + d, 0.1, { amp: 0.25, tau: 0.03, hp: true }));

// ------------------------------------------------ 71–77: el cierre
impact(71.0, 0.85);
kick(71.0, 0.6);
[45, 57, 60, 64, 69].forEach((m) => tone(71.0, 5.5, mtof(m), { amp: 0.08, a: 0.05, tau: 2.2, shape: 'tri' }));
[81, 76, 72, 79, 84, 88].forEach((m, k) => tone(71.5 + k * 0.45, 2.2, mtof(m), { amp: 0.09, tau: 1.0, shape: 'bell', pan: k % 2 ? 0.4 : -0.4 }));

finish(process.argv[2] || 'trailer3.wav', { fadeOutAt: 75.9, fadeOutLen: 1.5 });
