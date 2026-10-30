/**
 * Medición de postura a partir de los puntos que devuelve MediaPipe Pose.
 *
 * Módulo puro: recibe landmarks y devuelve números, sin cámara ni DOM, así que
 * se puede probar con esqueletos sintéticos.
 *
 * Una webcam frontal no ve la curva de la columna, pero sí cuatro indicadores
 * que la delatan bien cuando se comparan con una calibración previa:
 *
 *   - encorvarse: las orejas se acercan a los hombros;
 *   - echarse hacia la pantalla: los hombros se ven más anchos;
 *   - escurrirse en la silla: los hombros bajan en el encuadre;
 *   - ladearse: la línea de los hombros se inclina.
 *
 * Todo se normaliza con la anchura de hombros, de modo que la medida no depende
 * de tu estatura ni de lo lejos que esté la silla.
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** Índices de MediaPipe Pose que usamos. */
export const POSE = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
} as const;

export interface PostureMetrics {
  /** Anchura de hombros en el encuadre (0-1). Es la escala de referencia. */
  shoulderWidth: number;
  /** Distancia vertical orejas→hombros medida en anchuras de hombro. */
  headLift: number;
  /** Altura del centro de los hombros en el encuadre (0 arriba, 1 abajo). */
  shoulderY: number;
  /** Inclinación de la línea de hombros, en grados. */
  tiltDeg: number;
}

/** Las cuatro medidas, en el orden en que se suavizan y se calibran. */
export const METRIC_KEYS = ['shoulderWidth', 'headLift', 'shoulderY', 'tiltDeg'] as const;

export type PostureCause = 'none' | 'hunch' | 'lean' | 'slide' | 'tilt';

export interface Deviation {
  /** Desviación total en "grados equivalentes", comparable con el umbral. */
  deg: number;
  /** Qué indicador manda ahora mismo. */
  cause: PostureCause;
  parts: Record<Exclude<PostureCause, 'none'>, number>;
}

/**
 * Cuánto pesa cada indicador al traducirlo a grados. Están ajustados para que
 * el umbral por defecto (22°) salte con un encorvamiento claro:
 * perder un 25 % de la distancia oreja-hombro, acercarse un 18 % a la pantalla
 * o escurrirse un tercio de anchura de hombros.
 */
export const GAINS = { hunch: 90, lean: 120, slide: 70 };

/** Visibilidad mínima para fiarse de un punto. */
export const MIN_VISIBILITY = 0.5;

/** Hombros más estrechos que esto: estás demasiado lejos o mal encuadrado. */
const MIN_SHOULDER_WIDTH = 0.04;

/**
 * Extrae las medidas del esqueleto. Devuelve `null` cuando no hay nadie, la
 * persona está mal encuadrada o los puntos clave no se ven: la máquina de
 * estados congela sus contadores en vez de inventarse una postura.
 */
export function extractMetrics(landmarks: Landmark[] | null | undefined): PostureMetrics | null {
  if (!landmarks || landmarks.length <= POSE.rightShoulder) {
    return null;
  }

  const points = [POSE.leftEar, POSE.rightEar, POSE.leftShoulder, POSE.rightShoulder].map((i) => landmarks[i]);
  if (points.some((point) => !point || point.visibility < MIN_VISIBILITY)) {
    return null;
  }

  const [leftEar, rightEar, leftShoulder, rightShoulder] = points;
  const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
  if (shoulderWidth < MIN_SHOULDER_WIDTH) {
    return null;
  }

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const earY = (leftEar.y + rightEar.y) / 2;

  return {
    shoulderWidth,
    headLift: (shoulderY - earY) / shoulderWidth,
    shoulderY,
    tiltDeg: (Math.atan2(leftShoulder.y - rightShoulder.y, leftShoulder.x - rightShoulder.x) * 180) / Math.PI,
  };
}

/**
 * Elige a quién medir cuando la cámara ve a varias personas: se queda con la de
 * hombros más anchos, que es siempre la más cercana a la cámara. Sin esto, en
 * un sitio con gente pasando por detrás la app podría ponerse a medir la
 * postura de un curioso en lugar de la de quien está sentado delante.
 *
 * @returns los puntos y las medidas de la persona elegida, o `null` si no hay
 *          ninguna suficientemente visible.
 */
export function selectSubject(
  poses: (Landmark[] | null | undefined)[] | null | undefined
): { landmarks: Landmark[]; metrics: PostureMetrics } | null {
  if (!poses) {
    return null;
  }
  let best: { landmarks: Landmark[]; metrics: PostureMetrics } | null = null;
  for (const landmarks of poses) {
    const metrics = extractMetrics(landmarks);
    if (metrics && landmarks && (!best || metrics.shoulderWidth > best.metrics.shoulderWidth)) {
      best = { landmarks, metrics };
    }
  }
  return best;
}

/**
 * Compara la postura actual con la calibrada. Se queda con el indicador peor
 * (no con la suma) para que la interfaz pueda decir *por qué* está avisando.
 */
export function deviationFrom(baseline: PostureMetrics, current: PostureMetrics): Deviation {
  const hunch =
    baseline.headLift > 0
      ? Math.max(0, (baseline.headLift - current.headLift) / baseline.headLift) * GAINS.hunch
      : 0;
  const lean = Math.max(0, current.shoulderWidth / baseline.shoulderWidth - 1) * GAINS.lean;
  const slide = Math.max(0, (current.shoulderY - baseline.shoulderY) / baseline.shoulderWidth) * GAINS.slide;
  const tilt = Math.abs(current.tiltDeg - baseline.tiltDeg);

  const parts = { hunch, lean, slide, tilt };
  let cause: PostureCause = 'none';
  let deg = 0;
  for (const [key, value] of Object.entries(parts) as [Exclude<PostureCause, 'none'>, number][]) {
    if (value > deg) {
      deg = value;
      cause = key;
    }
  }

  return { deg, cause, parts };
}

export const CAUSE_LABEL: Record<PostureCause, string> = {
  none: 'Postura correcta',
  hunch: 'Estás encorvando la espalda',
  lean: 'Te has echado sobre la pantalla',
  slide: 'Te estás escurriendo en la silla',
  tilt: 'Estás ladeando los hombros',
};
