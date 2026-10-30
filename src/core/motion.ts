/**
 * De la lectura del sensor a «hacia dónde cae la gravedad» y «cuánto se está
 * moviendo el móvil».
 *
 * Hasta la 1.1 se usaba sólo el acelerómetro: mide la gravedad más el
 * movimiento propio, así que en cuanto el usuario caminaba o daba un respingo
 * el ángulo dejaba de significar nada y había que tirar la lectura. Desde la
 * 2.0 se pide al sistema la gravedad ya separada del movimiento: iOS y Android
 * la calculan juntando acelerómetro y giroscopio (fusión de sensores), y esa
 * gravedad apenas tiembla al moverse. Si el móvil no tiene giroscopio se vuelve
 * al acelerómetro de siempre.
 *
 * Módulo puro: recibe objetos con la forma de las lecturas de expo-sensors.
 */
import { magnitude, type Vector3 } from './orientation';

/** Gravedad estándar, para pasar de m/s² a g. */
export const STANDARD_GRAVITY = 9.80665;

export interface MotionReading {
  /** Vector de la gravedad en los ejes del móvil, en g. */
  gravity: Vector3;
  /**
   * Aceleración propia (sin gravedad) en g, o `null` cuando el móvil no sabe
   * separarla (sin giroscopio): entonces la gravedad lleva el movimiento dentro.
   */
  userAccelG: number | null;
  /** `true` si la gravedad viene de la fusión de sensores del sistema. */
  fused: boolean;
}

type Axes = { x: number; y: number; z: number } | null | undefined;

const finite = (v: Axes): v is { x: number; y: number; z: number } =>
  !!v && [v.x, v.y, v.z].every((n) => typeof n === 'number' && Number.isFinite(n));

const scale = (v: { x: number; y: number; z: number }, k: number): Vector3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });

/**
 * Lectura de `DeviceMotion`. La gravedad sale de restar la aceleración propia a
 * la aceleración total; en Android el signo es el contrario que en iOS, pero
 * eso da igual: la calibración y las medidas salen del mismo sensor.
 * Devuelve `null` si la lectura viene incompleta (Android sin sensor de
 * gravedad la manda sin `accelerationIncludingGravity`).
 */
export function readingFromDeviceMotion(sample: {
  acceleration?: Axes;
  accelerationIncludingGravity?: Axes;
}): MotionReading | null {
  const total = sample.accelerationIncludingGravity;
  if (!finite(total)) return null;
  const own = sample.acceleration;
  if (!finite(own)) {
    return { gravity: scale(total, 1 / STANDARD_GRAVITY), userAccelG: null, fused: false };
  }
  const gravity = scale({ x: total.x - own.x, y: total.y - own.y, z: total.z - own.z }, 1 / STANDARD_GRAVITY);
  if (magnitude(gravity) < 0.2) return null;
  return { gravity, userAccelG: magnitude(own) / STANDARD_GRAVITY, fused: true };
}

/** Lectura del acelerómetro de siempre (ya viene en g). */
export function readingFromAccelerometer(sample: Vector3): MotionReading {
  return { gravity: sample, userAccelG: null, fused: false };
}

export interface TrustConfig {
  /** Aceleración propia máxima con gravedad fusionada, en g. */
  fusedToleranceG: number;
  /** Cuánto puede alejarse de 1 g una lectura sin fusionar. */
  rawToleranceG: number;
}

/**
 * Con la gravedad fusionada se puede medir caminando: sólo se descartan los
 * golpes de verdad. Sin fusión se mantiene el criterio de la 1.x (que el
 * módulo esté cerca de 1 g).
 */
export const DEFAULT_TRUST: TrustConfig = { fusedToleranceG: 0.45, rawToleranceG: 0.22 };

export function isTrustedReading(reading: MotionReading, config: TrustConfig = DEFAULT_TRUST): boolean {
  if (reading.fused && reading.userAccelG != null) {
    return reading.userAccelG <= config.fusedToleranceG;
  }
  return Math.abs(magnitude(reading.gravity) - 1) <= config.rawToleranceG;
}

/** Por encima de esto se considera que la persona se está moviendo (caminar). */
export const MOVING_THRESHOLD_G = 0.12;

/**
 * ¿Se está moviendo? Sólo se sabe con la aceleración propia; sin ella se
 * estima por cuánto se aleja el módulo de 1 g.
 */
export function isMoving(reading: MotionReading): boolean {
  if (reading.userAccelG != null) return reading.userAccelG > MOVING_THRESHOLD_G;
  return Math.abs(magnitude(reading.gravity) - 1) > MOVING_THRESHOLD_G;
}
