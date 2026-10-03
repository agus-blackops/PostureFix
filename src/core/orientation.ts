/**
 * Utilidades de orientación. Todo el módulo es puro: recibe lecturas del
 * acelerómetro (en g) y devuelve ángulos, sin tocar sensores ni React.
 *
 * La idea: con el móvil quieto, el acelerómetro mide el vector de la gravedad
 * expresado en los ejes del teléfono. Al calibrar guardamos ese vector con la
 * espalda recta; después, el ángulo entre el vector guardado y el actual es
 * cuánto se ha inclinado el cuerpo. Como girar sobre uno mismo no cambia la
 * dirección de la gravedad respecto del teléfono, el cálculo ignora los giros
 * horizontales y sólo reacciona a agacharse o ladearse.
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export function magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vector3): Vector3 {
  const length = magnitude(v);
  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** Ángulo (0-180°) entre dos vectores. */
export function angleBetweenDeg(a: Vector3, b: Vector3): number {
  const na = normalize(a);
  const nb = normalize(b);
  const dot = Math.max(-1, Math.min(1, na.x * nb.x + na.y * nb.y + na.z * nb.z));
  return (Math.acos(dot) * 180) / Math.PI;
}

/**
 * Filtro paso bajo exponencial independiente de la frecuencia de muestreo:
 * suaviza el ruido del sensor sin retrasar demasiado la detección.
 *
 * @param tauMs constante de tiempo; cuanto mayor, más suave y más lento.
 */
export function lowPass(previous: Vector3 | null, sample: Vector3, dtMs: number, tauMs: number): Vector3 {
  if (!previous) {
    return sample;
  }
  const alpha = 1 - Math.exp(-Math.max(dtMs, 0) / Math.max(tauMs, 1));
  return {
    x: previous.x + alpha * (sample.x - previous.x),
    y: previous.y + alpha * (sample.y - previous.y),
    z: previous.z + alpha * (sample.z - previous.z),
  };
}

/**
 * Una muestra sólo sirve para medir postura si el módulo del vector está cerca
 * de 1 g. Si el usuario camina, salta o agita el móvil, la aceleración propia
 * se suma a la gravedad y el ángulo deja de significar nada.
 */
export function isTrustedSample(sample: Vector3, toleranceG: number): boolean {
  return Math.abs(magnitude(sample) - 1) <= toleranceG;
}

/** Media de varias lecturas: se usa para calibrar con la espalda recta. */
export function averageVector(samples: Vector3[]): Vector3 | null {
  if (samples.length === 0) {
    return null;
  }
  const sum = samples.reduce(
    (acc, s) => ({ x: acc.x + s.x, y: acc.y + s.y, z: acc.z + s.z }),
    { x: 0, y: 0, z: 0 }
  );
  return { x: sum.x / samples.length, y: sum.y / samples.length, z: sum.z / samples.length };
}
