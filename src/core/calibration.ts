import { angleBetweenDeg, type Vector3 } from './orientation';

/**
 * Calibrar es decidir cuál es «tu postura buena» a partir de unas cuantas
 * lecturas. La 1.0.1 hacía la media, y la media se deja arrastrar por un
 * puñado de muestras malas: basta un respingo al final de la cuenta para torcer
 * la referencia y, con ella, todas las medidas de la sesión.
 *
 * Aquí se usa la **mediana**, que no se mueve aunque un tercio de las muestras
 * sean basura, y se mide además la **dispersión** para poder decirle al usuario
 * que se estuvo moviendo y que conviene repetir.
 */

/** Mediana de una lista. Devuelve `NaN` si está vacía. */
export function median(values: number[]): number {
  if (values.length === 0) {
    return NaN;
  }
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

/** Mediana componente a componente de un vector. */
export function medianVector(samples: Vector3[]): Vector3 | null {
  if (samples.length === 0) {
    return null;
  }
  return {
    x: median(samples.map((s) => s.x)),
    y: median(samples.map((s) => s.y)),
    z: median(samples.map((s) => s.z)),
  };
}

/** Mediana de una medida por cada clave: la calibración de la versión webcam. */
export function medianRecord<K extends string>(samples: Record<K, number>[], keys: readonly K[]): Record<K, number> | null {
  if (samples.length === 0) {
    return null;
  }
  return Object.fromEntries(keys.map((key) => [key, median(samples.map((s) => s[key]))])) as Record<K, number>;
}

/**
 * Dispersión robusta: la mediana de lo lejos que queda cada muestra del centro.
 * Con la persona quieta sale casi cero; si se movió, crece.
 */
export function medianDistance<T>(samples: T[], center: T, distance: (sample: T, center: T) => number): number {
  if (samples.length === 0) {
    return 0;
  }
  return median(samples.map((sample) => distance(sample, center)));
}

/** Por encima de esta dispersión la calibración no es de fiar. */
export const MAX_CALIBRATION_SPREAD_DEG = 4;

export interface Calibration<T> {
  baseline: T;
  /** Cuánto bailaban las muestras, en grados. */
  spreadDeg: number;
  /** `false` cuando conviene repetir la calibración. */
  steady: boolean;
}

/** Calibra a partir de lecturas del acelerómetro. */
export function calibrateVectors(
  samples: Vector3[],
  maxSpreadDeg: number = MAX_CALIBRATION_SPREAD_DEG
): Calibration<Vector3> | null {
  const baseline = medianVector(samples);
  if (!baseline) {
    return null;
  }
  const spreadDeg = medianDistance(samples, baseline, angleBetweenDeg);
  return { baseline, spreadDeg, steady: spreadDeg <= maxSpreadDeg };
}

/**
 * La ventana más quieta de una grabación: la 2.0 graba unos segundos y se
 * queda con el tramo de `windowSize` lecturas que menos baila, en vez de con
 * todo. Así no cuenta el momento de guardar el móvil ni el de acomodarse.
 */
export function mostStableWindow(samples: Vector3[], windowSize: number): Vector3[] {
  if (samples.length <= windowSize) return samples;
  let best = samples.slice(0, windowSize);
  let bestSpread = Infinity;
  const step = Math.max(1, Math.floor(windowSize / 4));
  for (let start = 0; start + windowSize <= samples.length; start += step) {
    const window = samples.slice(start, start + windowSize);
    const center = medianVector(window);
    if (!center) continue;
    const spread = medianDistance(window, center, angleBetweenDeg);
    // Ante empate gana la más tardía: la persona ya se ha acomodado.
    if (spread <= bestSpread) {
      best = window;
      bestSpread = spread;
    }
  }
  return best;
}
