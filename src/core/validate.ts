/**
 * Lectura defensiva de lo guardado en disco. Los ajustes pasan por aquí al
 * cargar: un valor corrupto (una cadena donde iba un número, un `null` donde
 * iba un sí/no) vuelve a su valor por defecto en lugar de colarse en la app.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Número finito dentro de [min, max]; si no lo es, el valor por defecto. */
export function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

/** Sí/no de verdad; cualquier otra cosa, el valor por defecto. */
export function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Uno de los valores permitidos; si no, el valor por defecto. */
export function readChoice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
