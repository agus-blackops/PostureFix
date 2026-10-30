/**
 * Geometría de las formas de Material 3 Expressive, en SVG, compartida por la
 * app de móvil y la de portátil.
 *
 * - **Anillo ondulado**: el tramo recorrido del medidor es una onda en vez de
 *   un trazo liso. La amplitud dice cuánto urge: plano con la postura bien,
 *   ondas suaves al agacharte y fuertes en la alarma.
 * - **Formas polares**: círculo, «galleta» de lóbulos redondeados, flor y
 *   estallido, descritas como un radio que varía con el ángulo. Dos formas se
 *   transforman una en otra interpolando ese radio punto a punto.
 */

export interface PolarShape {
  /** Número de lóbulos alrededor. 0 = círculo. */
  lobes: number;
  /** Profundidad de los lóbulos, de 0 (círculo) a ~0,25 (estallido). */
  depth: number;
}

/** Las formas que usa la app, de más tranquila a más urgente. */
export const SHAPES = {
  circle: { lobes: 0, depth: 0 },
  cookie9: { lobes: 9, depth: 0.06 },
  cookie6: { lobes: 6, depth: 0.09 },
  pentagon: { lobes: 5, depth: 0.1 },
  flower8: { lobes: 8, depth: 0.14 },
  burst12: { lobes: 12, depth: 0.2 },
} as const satisfies Record<string, PolarShape>;

export type ShapeName = keyof typeof SHAPES;

/** Secuencia del indicador de carga: cada forma se transforma en la siguiente. */
export const LOADING_SEQUENCE: readonly ShapeName[] = ['cookie9', 'pentagon', 'burst12', 'flower8', 'cookie6'];

/** Radio relativo (máximo 1) de una forma en el ángulo `theta`. */
export function shapeRadius(shape: PolarShape, theta: number): number {
  if (shape.lobes === 0 || shape.depth === 0) return 1;
  return 1 - shape.depth + shape.depth * Math.cos(shape.lobes * theta);
}

const TAU = Math.PI * 2;

const fmt = (n: number) => (Math.abs(n) < 1e-9 ? '0' : String(Math.round(n * 100) / 100));

/** Hasta dónde puede pasarse la mezcla al rebotar (1 = forma de destino). */
export const MAX_OVERSHOOT = 1.25;

/**
 * Contorno cerrado de la transformación de `from` en `to` al punto `t`
 * (0 = `from`, 1 = `to`), centrado en (cx, cy), con radio máximo `radius` y
 * girado `rotation` radianes. Al pasarse de 1 la forma puede salir hasta un
 * ~10 % de `radius`: quien la dibuja debe dejar ese margen.
 */
export function morphPath(
  from: PolarShape,
  to: PolarShape,
  t: number,
  cx: number,
  cy: number,
  radius: number,
  rotation = 0,
  steps?: number
): string {
  // Se admite pasar un poco de 1: es el rebote del muelle espacial, que
  // exagera la forma de destino un instante antes de asentarse en ella.
  const mix = Math.min(MAX_OVERSHOOT, Math.max(0, t));
  // Al menos 16 puntos por lóbulo: con menos, las puntas se ven planas.
  const count = steps ?? Math.max(96, 16 * Math.max(from.lobes, to.lobes));
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * TAU;
    const r = radius * ((1 - mix) * shapeRadius(from, theta) + mix * shapeRadius(to, theta));
    const angle = theta + rotation - Math.PI / 2;
    parts.push(`${i === 0 ? 'M' : 'L'}${fmt(cx + r * Math.cos(angle))} ${fmt(cy + r * Math.sin(angle))}`);
  }
  return `${parts.join(' ')} Z`;
}

/** Contorno de una sola forma. */
export function shapePath(shape: PolarShape, cx: number, cy: number, radius: number, rotation = 0, steps?: number): string {
  return morphPath(shape, shape, 0, cx, cy, radius, rotation, steps);
}

export interface WavyArcOptions {
  cx: number;
  cy: number;
  radius: number;
  /** Fracción de la vuelta recorrida, de 0 a 1, empezando arriba. */
  progress: number;
  /** Altura de la onda en px. 0 = arco liso. */
  amplitude: number;
  /** Longitud de cada onda a lo largo del anillo, en px. */
  wavelength: number;
  /** Desfase de la onda en radianes: al avanzarlo, la onda «corre». */
  phase: number;
}

/**
 * Arco ondulado del anillo, desde arriba en el sentido de las agujas del
 * reloj. La onda nace y muere con suavidad en los extremos, para que los
 * remates redondeados caigan sobre la pista y no floten.
 */
export function wavyArcPath({ cx, cy, radius, progress, amplitude, wavelength, phase }: WavyArcOptions): string {
  const sweep = Math.min(1, Math.max(0, progress)) * TAU;
  if (sweep <= 0) return '';
  const arcLength = sweep * radius;
  const waves = TAU * radius / Math.max(wavelength, 1);
  // Un punto cada ~2 px de arco: suave sin cargar el dibujo.
  const steps = Math.max(8, Math.ceil(arcLength / 2));
  const taper = Math.min(sweep / 2, 0.22);
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * sweep;
    const edge = Math.min(theta, sweep - theta);
    const envelope = taper > 0 ? Math.min(1, edge / taper) : 0;
    const smooth = envelope * envelope * (3 - 2 * envelope);
    const r = radius + amplitude * smooth * Math.sin(waves * theta - phase);
    const angle = theta - Math.PI / 2;
    parts.push(`${i === 0 ? 'M' : 'L'}${fmt(cx + r * Math.cos(angle))} ${fmt(cy + r * Math.sin(angle))}`);
  }
  return parts.join(' ');
}
