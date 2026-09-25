/**
 * Muelles de Material 3 Expressive. La especificación describe el movimiento
 * con dos números por token, la razón de amortiguamiento y la rigidez, y
 * distingue dos familias:
 *
 * - **espaciales** (posición, tamaño, forma): rebotan un poco, dan vida.
 * - **de efectos** (color, opacidad): nunca rebotan, solo llegan.
 *
 * Todo lo que se mueve en la app sale de aquí: React Native los usa como
 * `Animated.spring`, la versión de portátil los convierte en curvas CSS
 * `linear()`, y los componentes que dibujan cada fotograma (anillo ondulado,
 * formas que se transforman) los integran paso a paso con `stepSpring`.
 */

export interface SpringSpec {
  /** 1 = sin rebote; por debajo, rebota. */
  dampingRatio: number;
  /** Rigidez con masa 1: cuanto más alta, más rápido. */
  stiffness: number;
}

/** Tokens del esquema de movimiento «expressive» de Material 3. */
export const MOTION = {
  spatialFast: { dampingRatio: 0.6, stiffness: 800 },
  spatialDefault: { dampingRatio: 0.8, stiffness: 380 },
  spatialSlow: { dampingRatio: 0.8, stiffness: 200 },
  effectsFast: { dampingRatio: 1, stiffness: 3800 },
  effectsDefault: { dampingRatio: 1, stiffness: 1600 },
  effectsSlow: { dampingRatio: 1, stiffness: 800 },
} as const satisfies Record<string, SpringSpec>;

export type MotionToken = keyof typeof MOTION;

/**
 * Posición de un muelle que sale de 0 hacia 1 en reposo, `t` segundos después
 * (respuesta al escalón de un oscilador amortiguado de masa 1).
 */
export function springPosition({ dampingRatio: zeta, stiffness }: SpringSpec, t: number): number {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * w0 * t);
    return 1 - decay * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
  }
  if (zeta === 1) {
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - root);
  const r2 = -w0 * (zeta + root);
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/** Segundos hasta que el muelle se queda a menos de `tolerance` del destino. */
export function settleTime(spec: SpringSpec, tolerance = 0.001): number {
  const step = 1 / 1000;
  let last = 0;
  for (let t = 0; t <= 10; t += step) {
    if (Math.abs(springPosition(spec, t) - 1) >= tolerance) last = t;
  }
  return last + step;
}

/**
 * Curva CSS `linear()` que reproduce el muelle, con su duración. Así la
 * versión de portátil anima con la misma física que el móvil sin librerías.
 */
export function cssSpring(spec: SpringSpec, samples = 48): { easing: string; durationMs: number } {
  const duration = settleTime(spec);
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const progress = i / samples;
    const value = i === samples ? 1 : springPosition(spec, progress * duration);
    points.push(`${round(value, 4)} ${round(progress * 100, 2)}%`);
  }
  return { easing: `linear(${points.join(', ')})`, durationMs: Math.round(duration * 1000) };
}

/** Parámetros de `Animated.spring` de React Native para un token. */
export function rnSpring(spec: SpringSpec): { stiffness: number; damping: number; mass: number } {
  return { stiffness: spec.stiffness, damping: 2 * spec.dampingRatio * Math.sqrt(spec.stiffness), mass: 1 };
}

export interface SpringState {
  value: number;
  velocity: number;
}

/**
 * Un paso de integración del muelle hacia `target`. Para lo que se dibuja a
 * mano cada fotograma. Usa subpasos cortos para no perder estabilidad con los
 * muelles rígidos ni cuando un fotograma llega tarde.
 */
export function stepSpring(state: SpringState, target: number, spec: SpringSpec, dtSeconds: number): SpringState {
  const damping = 2 * spec.dampingRatio * Math.sqrt(spec.stiffness);
  let { value, velocity } = state;
  const dt = Math.min(Math.max(dtSeconds, 0), 0.1);
  const substeps = Math.max(1, Math.ceil(dt / 0.004));
  const h = dt / substeps;
  for (let i = 0; i < substeps; i++) {
    const force = spec.stiffness * (target - value) - damping * velocity;
    velocity += force * h;
    value += velocity * h;
  }
  return { value, velocity };
}

/** `true` cuando el muelle ya está en su sitio y parado. */
export function isSettled(state: SpringState, target: number, epsilon = 0.0005): boolean {
  return Math.abs(state.value - target) < epsilon && Math.abs(state.velocity) < epsilon * 10;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
