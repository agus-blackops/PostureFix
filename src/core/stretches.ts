/**
 * Estiramientos guiados de PostureFix Labs: rutinas cortas para hacer sentado,
 * cada una con sus pasos cronometrados. Son movimientos suaves de los que se
 * recomiendan para quien pasa horas delante de una pantalla; nada de rebotes
 * ni posturas forzadas. La interfaz sólo pregunta aquí en qué paso va.
 */

export interface StretchStep {
  title: string;
  /** Lo que dice la voz y lo que se lee en pantalla. */
  instruction: string;
  seconds: number;
}

export interface Routine {
  id: 'cuello' | 'hombros' | 'espalda';
  title: string;
  subtitle: string;
  steps: StretchStep[];
}

export const SAFETY_NOTE = 'Muévete despacio y sin dolor. Si algo duele, para.';

export const ROUTINES: Routine[] = [
  {
    id: 'cuello',
    title: 'Cuello',
    subtitle: 'Para cuando llevas rato mirando abajo',
    steps: [
      {
        title: 'Barbilla atrás',
        instruction: 'Lleva la barbilla hacia atrás, como si hicieras papada, sin bajar la cabeza. Aguanta y suelta.',
        seconds: 20,
      },
      {
        title: 'Oreja al hombro derecho',
        instruction: 'Inclina la cabeza y acerca la oreja derecha al hombro, sin subir el hombro. Respira despacio.',
        seconds: 20,
      },
      {
        title: 'Oreja al hombro izquierdo',
        instruction: 'Ahora al otro lado: la oreja izquierda hacia el hombro izquierdo.',
        seconds: 20,
      },
      {
        title: 'Barbilla al pecho',
        instruction: 'Baja la barbilla hacia el pecho y nota cómo se estira la nuca.',
        seconds: 20,
      },
      {
        title: 'Giros lentos',
        instruction: 'Gira la cabeza despacio hacia la derecha y luego hacia la izquierda, mirando por encima del hombro.',
        seconds: 20,
      },
    ],
  },
  {
    id: 'hombros',
    title: 'Hombros',
    subtitle: 'Para soltar la tensión de arriba',
    steps: [
      {
        title: 'Círculos hacia atrás',
        instruction: 'Sube los hombros hacia las orejas y dibuja círculos grandes hacia atrás.',
        seconds: 20,
      },
      {
        title: 'Junta los omóplatos',
        instruction: 'Lleva los omóplatos hacia atrás y abajo, como si sujetaras un lápiz entre ellos. Aguanta tres segundos y suelta.',
        seconds: 30,
      },
      {
        title: 'Brazo derecho cruzado',
        instruction: 'Cruza el brazo derecho por delante del pecho y acércalo con la otra mano.',
        seconds: 20,
      },
      {
        title: 'Brazo izquierdo cruzado',
        instruction: 'Ahora el brazo izquierdo, acercándolo con la mano derecha.',
        seconds: 20,
      },
      {
        title: 'Abre el pecho',
        instruction: 'Entrelaza las manos detrás de la espalda, estira los brazos y abre el pecho mirando al frente.',
        seconds: 20,
      },
    ],
  },
  {
    id: 'espalda',
    title: 'Espalda',
    subtitle: 'Para despegarte de la silla',
    steps: [
      {
        title: 'Gato y vaca',
        instruction: 'Manos en las rodillas. Saca pecho arqueando la espalda y luego redondéala mirando al ombligo. Despacio.',
        seconds: 30,
      },
      {
        title: 'Giro a la derecha',
        instruction: 'Siéntate recto y gira el tronco hacia la derecha, apoyando la mano en el respaldo.',
        seconds: 20,
      },
      {
        title: 'Giro a la izquierda',
        instruction: 'Vuelve al centro y gira ahora hacia la izquierda.',
        seconds: 20,
      },
      {
        title: 'Crece hacia arriba',
        instruction: 'Entrelaza los dedos y estira los brazos hacia el techo, como si te tiraran de la coronilla.',
        seconds: 20,
      },
      {
        title: 'Cuelga hacia delante',
        instruction: 'Deja caer el tronco despacio hacia las rodillas con la cabeza suelta. Sube poco a poco.',
        seconds: 20,
      },
    ],
  },
];

export function routineDurationMs(routine: Routine): number {
  return routine.steps.reduce((total, step) => total + step.seconds * 1000, 0);
}

export interface RoutinePosition {
  /** Paso en curso; al terminar se queda en el último. */
  index: number;
  stepElapsedMs: number;
  stepRemainingMs: number;
  /** Avance del paso en curso, de 0 a 1. */
  stepProgress: number;
  /** Avance de la rutina entera, de 0 a 1. */
  progress: number;
  done: boolean;
}

/** En qué paso va una rutina tras `elapsedMs` de reloj (sin contar pausas). */
export function positionAt(routine: Routine, elapsedMs: number): RoutinePosition {
  const total = routineDurationMs(routine);
  const elapsed = Math.min(Math.max(0, elapsedMs), total);
  let start = 0;
  for (let index = 0; index < routine.steps.length; index++) {
    const length = routine.steps[index].seconds * 1000;
    const isLast = index === routine.steps.length - 1;
    if (elapsed < start + length || isLast) {
      const stepElapsedMs = Math.min(elapsed - start, length);
      return {
        index,
        stepElapsedMs,
        stepRemainingMs: length - stepElapsedMs,
        stepProgress: length > 0 ? stepElapsedMs / length : 1,
        progress: total > 0 ? elapsed / total : 1,
        done: elapsed >= total,
      };
    }
    start += length;
  }
  return { index: 0, stepElapsedMs: 0, stepRemainingMs: 0, stepProgress: 1, progress: 1, done: true };
}

/** Cuándo empieza el paso `index`, para saltar al anterior o al siguiente. */
export function stepStartMs(routine: Routine, index: number): number {
  const clamped = Math.min(Math.max(0, index), routine.steps.length);
  return routine.steps.slice(0, clamped).reduce((total, step) => total + step.seconds * 1000, 0);
}
