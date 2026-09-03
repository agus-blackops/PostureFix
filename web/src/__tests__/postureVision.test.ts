import {
  CAUSE_LABEL,
  GAINS,
  POSE,
  deviationFrom,
  extractMetrics,
  smoothMetrics,
  type Landmark,
} from '../postureVision';

/** Esqueleto sintético: sólo importan orejas y hombros. */
function skeleton(options: {
  shoulderY?: number;
  earY?: number;
  halfWidth?: number;
  tilt?: number;
  visibility?: number;
}): Landmark[] {
  const { shoulderY = 0.6, earY = 0.3, halfWidth = 0.1, tilt = 0, visibility = 0.95 } = options;
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility }));
  const point = (x: number, y: number): Landmark => ({ x, y, z: 0, visibility });
  landmarks[POSE.leftEar] = point(0.5 + halfWidth * 0.55, earY);
  landmarks[POSE.rightEar] = point(0.5 - halfWidth * 0.55, earY);
  landmarks[POSE.leftShoulder] = point(0.5 + halfWidth, shoulderY + tilt / 2);
  landmarks[POSE.rightShoulder] = point(0.5 - halfWidth, shoulderY - tilt / 2);
  return landmarks;
}

const upright = () => extractMetrics(skeleton({}))!;

describe('postureVision', () => {
  it('no mide nada si no hay nadie delante', () => {
    expect(extractMetrics(null)).toBeNull();
    expect(extractMetrics([])).toBeNull();
  });

  it('descarta los puntos que no se ven bien', () => {
    expect(extractMetrics(skeleton({ visibility: 0.2 }))).toBeNull();
  });

  it('descarta a quien está demasiado lejos', () => {
    expect(extractMetrics(skeleton({ halfWidth: 0.01 }))).toBeNull();
  });

  it('normaliza la distancia oreja-hombro con la anchura de hombros', () => {
    const cerca = extractMetrics(skeleton({ halfWidth: 0.2 }))!;
    const lejos = extractMetrics(skeleton({ halfWidth: 0.1 }))!;
    // La misma postura a distinta distancia de la cámara mide lo mismo…
    expect(cerca.headLift).toBeCloseTo(lejos.headLift * 0.5, 5);
    // …y por eso alejarse no dispara ninguna alerta.
    expect(deviationFrom(lejos, extractMetrics(skeleton({ halfWidth: 0.09 }))!).deg).toBe(0);
  });

  it('la misma postura no se desvía de sí misma', () => {
    const base = upright();
    const deviation = deviationFrom(base, base);
    expect(deviation.deg).toBe(0);
    expect(deviation.cause).toBe('none');
  });

  it('detecta encorvarse: las orejas caen hacia los hombros', () => {
    const base = upright();
    const hunched = extractMetrics(skeleton({ earY: 0.45 }))!;
    const deviation = deviationFrom(base, hunched);
    expect(deviation.cause).toBe('hunch');
    expect(deviation.deg).toBeGreaterThan(22);
    expect(CAUSE_LABEL[deviation.cause]).toMatch(/encorvando/i);
  });

  it('detecta echarse sobre la pantalla: los hombros se ven más anchos', () => {
    const base = upright();
    // Acercarse a la cámara agranda a la persona entera: los hombros se ven un
    // 25 % más anchos y la distancia oreja-hombro crece en la misma proporción.
    const leaning = extractMetrics(skeleton({ halfWidth: 0.125, earY: 0.6 - 0.3 * 1.25 }))!;
    const deviation = deviationFrom(base, leaning);
    expect(deviation.cause).toBe('lean');
    expect(deviation.parts.lean).toBeCloseTo(0.25 * GAINS.lean, 5);
  });

  it('detecta escurrirse en la silla', () => {
    const base = upright();
    const sliding = extractMetrics(skeleton({ shoulderY: 0.75, earY: 0.45 }))!;
    const deviation = deviationFrom(base, sliding);
    expect(deviation.cause).toBe('slide');
    expect(deviation.deg).toBeGreaterThan(22);
  });

  it('detecta ladear los hombros', () => {
    const base = upright();
    const tilted = extractMetrics(skeleton({ tilt: 0.12 }))!;
    const deviation = deviationFrom(base, tilted);
    expect(deviation.cause).toBe('tilt');
    expect(deviation.parts.tilt).toBeGreaterThan(22);
  });

  it('se queda con el indicador peor, no con la suma', () => {
    const base = upright();
    const both = extractMetrics(skeleton({ earY: 0.45, shoulderY: 0.75 }))!;
    const deviation = deviationFrom(base, both);
    expect(deviation.deg).toBe(Math.max(...Object.values(deviation.parts)));
  });

  it('enderezarse más de lo calibrado no cuenta como mala postura', () => {
    const base = upright();
    const straighter = extractMetrics(skeleton({ earY: 0.2, shoulderY: 0.55, halfWidth: 0.09 }))!;
    expect(deviationFrom(base, straighter).deg).toBe(0);
  });

  it('el filtro arranca en la primera muestra y converge', () => {
    const base = upright();
    const hunched = extractMetrics(skeleton({ earY: 0.45 }))!;
    expect(smoothMetrics(null, base, 66, 300)).toEqual(base);

    let smoothed = base;
    for (let i = 0; i < 100; i++) {
      smoothed = smoothMetrics(smoothed, hunched, 66, 300);
    }
    expect(smoothed.headLift).toBeCloseTo(hunched.headLift, 4);
  });
});
