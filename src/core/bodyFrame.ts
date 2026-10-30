/**
 * Ejes del cuerpo a partir de la calibración en dos pasos de la 2.0.
 *
 * Con un solo paso (espalda recta) sólo se sabe cuánto te has inclinado, no
 * hacia dónde: echarse hacia atrás en la silla contaba igual que encorvarse.
 * Con el segundo paso (inclinarse un poco hacia delante) la app aprende qué
 * dirección es «delante» en los ejes del móvil, esté como esté en el bolsillo.
 *
 *   arriba   u = gravedad con la espalda recta
 *   delante  f = lo que cambia la gravedad al inclinarse, sin la parte de u
 *   lado     s = u × f
 *
 * Cualquier lectura v se descompone en esos ejes: el ángulo en el plano (u, f)
 * es la inclinación hacia delante o atrás y el del plano (u, s), la lateral.
 */
import { angleBetweenDeg, normalize, type Vector3 } from './orientation';

export interface BodyFrame {
  /** Gravedad con la espalda recta (unitaria). */
  up: Vector3;
  /** Dirección «hacia delante» aprendida, o `null` si sólo hay un paso. */
  forward: Vector3 | null;
}

/** Por debajo de esta inclinación el segundo paso no enseña hacia dónde es delante. */
export const MIN_LEAN_DEG = 8;

const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export type FrameResult = { frame: BodyFrame; leanDeg: number } | { error: 'lean-too-small'; leanDeg: number };

/** Construye los ejes con la postura recta y, si la hay, la inclinada. */
export function buildFrame(upright: Vector3, leaning?: Vector3 | null): FrameResult {
  const up = normalize(upright);
  if (!leaning) return { frame: { up, forward: null }, leanDeg: 0 };
  const lean = normalize(leaning);
  const leanDeg = angleBetweenDeg(up, lean);
  if (leanDeg < MIN_LEAN_DEG) return { error: 'lean-too-small', leanDeg };
  const along = dot(lean, up);
  const forward = normalize({ x: lean.x - along * up.x, y: lean.y - along * up.y, z: lean.z - along * up.z });
  return { frame: { up, forward }, leanDeg };
}

export interface Tilt {
  /** Ángulo total respecto a la postura recta. */
  totalDeg: number;
  /** Hacia delante (+) o hacia atrás (−); `null` sin segundo paso. */
  pitchDeg: number | null;
  /** Hacia un lado o el otro; `null` sin segundo paso. */
  rollDeg: number | null;
}

export function tiltOf(frame: BodyFrame, reading: Vector3): Tilt {
  const v = normalize(reading);
  const totalDeg = angleBetweenDeg(frame.up, v);
  if (!frame.forward) return { totalDeg, pitchDeg: null, rollDeg: null };
  const side = cross(frame.up, frame.forward);
  const alongUp = dot(v, frame.up);
  return {
    totalDeg,
    pitchDeg: toDeg(Math.atan2(dot(v, frame.forward), alongUp)),
    rollDeg: toDeg(Math.atan2(dot(v, side), alongUp)),
  };
}

/**
 * Lo que cuenta como «mala postura». Con los dos pasos: inclinarse hacia
 * delante y ladearse; echarse hacia atrás no, si así se pide. Con uno solo, el
 * ángulo total, como en la 1.x.
 */
export function slouchDeg(tilt: Tilt, ignoreBackward: boolean): number {
  if (tilt.pitchDeg == null || tilt.rollDeg == null) return tilt.totalDeg;
  const forward = ignoreBackward ? Math.max(0, tilt.pitchDeg) : Math.abs(tilt.pitchDeg);
  return Math.min(180, Math.hypot(forward, tilt.rollDeg));
}

/** Valida unos ejes leídos de disco. */
export function sanitizeFrame(raw: unknown): BodyFrame | null {
  const isVector = (v: unknown): v is Vector3 =>
    !!v &&
    typeof v === 'object' &&
    ['x', 'y', 'z'].every((k) => typeof (v as Record<string, unknown>)[k] === 'number' && Number.isFinite((v as Record<string, number>)[k]));
  if (!raw || typeof raw !== 'object') return null;
  const { up, forward } = raw as { up?: unknown; forward?: unknown };
  if (!isVector(up)) return null;
  const upUnit = normalize(up);
  if (upUnit.x === 0 && upUnit.y === 0 && upUnit.z === 0) return null;
  if (!isVector(forward)) return { up: upUnit, forward: null };
  const f = normalize(forward);
  // Un «delante» que no es perpendicular a «arriba» viene corrupto.
  return Math.abs(dot(f, upUnit)) < 0.05 ? { up: upUnit, forward: f } : { up: upUnit, forward: null };
}
