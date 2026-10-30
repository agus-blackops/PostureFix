/**
 * La música común de los tráileres: colchón de acordes (La menor, Fa, Do, Sol),
 * bajo, arpegio con eco y percusión a 120 ppm. Se le pasa el mezclador de
 * `audio-lib.mjs` y devuelve la función `music(desde, hasta, origen, opciones)`.
 */
export const BEAT = 0.5;

export function makeMusic({ TAU, mtof, add, tone, kick, hat, snare }) {
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

  return music;
}
