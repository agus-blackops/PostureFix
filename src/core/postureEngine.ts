/**
 * Máquina de estados de la alerta de postura. Es una función pura: recibe el
 * estado anterior y una lectura, y devuelve el estado nuevo más una lista de
 * acciones ("pita", "habla", "vibra"...) que ejecuta la capa de React. Así la
 * secuencia completa se puede probar con tests sin sensores ni sonido.
 *
 * Secuencia:
 *   1. El usuario se agacha más de `thresholdDeg` durante `graceMs`.
 *   2. Suena un pitido corto y fuerte (susto) + vibración.
 *   3. Si sigue agachado, la voz cuenta "uno... dos... tres".
 *   4. Si aún sigue agachado, salta la alerta fuerte: notificación, vibración
 *      larga y tono continuo (EAS con auriculares, sirena por altavoz).
 *   5. Al enderezarse durante `recoverMs` todo se apaga y empieza el descanso.
 */
export type Phase =
  | 'idle' // monitorización parada
  | 'ok' // vigilando, postura correcta
  | 'slouching' // agachado, corriendo el margen previo al pitido
  | 'scare' // acaba de sonar el pitido
  | 'countdown' // 1... 2... 3...
  | 'alarm' // alerta fuerte sostenida
  | 'cooldown'; // pausa tras una alerta

export type AlarmSound = 'eas' | 'siren';

export type EngineAction =
  | { type: 'beep' }
  | { type: 'speak'; text: string }
  | { type: 'silence' }
  | { type: 'startAlarm' }
  | { type: 'notify'; title: string; body: string }
  | { type: 'haptic'; pattern: 'warning' | 'tick' | 'alarm' | 'success' };

export interface EngineConfig {
  /** Inclinación respecto a la postura calibrada que se considera "agachado". */
  thresholdDeg: number;
  /** Margen extra que hay que recuperar para volver a considerarse erguido. */
  hysteresisDeg: number;
  /** Tiempo agachado antes del pitido de susto. */
  graceMs: number;
  /** Espera entre el pitido y el inicio de la cuenta. */
  scareMs: number;
  /** Duración de cada número de la cuenta. */
  countStepMs: number;
  /** Tiempo erguido continuo necesario para cancelar. */
  recoverMs: number;
  /** Pausa tras una alerta antes de volver a vigilar. */
  cooldownMs: number;
  /** Corte de seguridad: la alarma nunca suena más de este tiempo seguido. */
  maxAlarmMs: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  thresholdDeg: 22,
  hysteresisDeg: 6,
  graceMs: 4000,
  scareMs: 1600,
  countStepMs: 900,
  recoverMs: 800,
  cooldownMs: 4000,
  maxAlarmMs: 45000,
};

export const MESSAGES = {
  counts: ['uno', 'dos', 'tres'],
  alarm: '¡Endereza la espalda! ¡Ahora!',
  recovered: 'Bien. Espalda recta.',
  notificationTitle: '🚨 ¡ALERTA DE POSTURA!',
  notificationBody: 'Llevas demasiado tiempo agachado. Endereza la espalda ahora mismo.',
};

export interface EngineState {
  phase: Phase;
  /** Estado de postura ya filtrado con histéresis. */
  slouching: boolean;
  /** Tiempo transcurrido dentro de la fase actual. */
  phaseMs: number;
  /** Tiempo agachado seguido en el ciclo actual. */
  badMs: number;
  /** Tiempo erguido seguido. */
  goodMs: number;
  /** Números de la cuenta ya pronunciados (0-3). */
  countsSpoken: number;
  /** Última inclinación medida, para la interfaz. */
  deviationDeg: number;
  /** Estadísticas de la sesión. */
  totalAlerts: number;
  sessionBadMs: number;
  sessionMs: number;
}

export interface EngineInput {
  /** Inclinación actual respecto a la postura calibrada, en grados. */
  deviationDeg: number;
  /** Milisegundos desde la lectura anterior. */
  dtMs: number;
  /** `false` si el móvil se movía demasiado y la lectura no es fiable. */
  trusted: boolean;
}

export interface StepResult {
  state: EngineState;
  actions: EngineAction[];
}

export function createInitialState(): EngineState {
  return {
    phase: 'idle',
    slouching: false,
    phaseMs: 0,
    badMs: 0,
    goodMs: 0,
    countsSpoken: 0,
    deviationDeg: 0,
    totalAlerts: 0,
    sessionBadMs: 0,
    sessionMs: 0,
  };
}

/** Arranca la vigilancia conservando las estadísticas de la sesión. */
export function startMonitoring(state: EngineState): EngineState {
  return { ...state, phase: 'ok', phaseMs: 0, badMs: 0, goodMs: 0, countsSpoken: 0, slouching: false };
}

/** Para la vigilancia y apaga cualquier sonido en curso. */
export function stopMonitoring(state: EngineState): StepResult {
  return {
    state: { ...createInitialState(), totalAlerts: state.totalAlerts, sessionBadMs: state.sessionBadMs, sessionMs: state.sessionMs },
    actions: state.phase === 'idle' ? [] : [{ type: 'silence' }],
  };
}

/** ¿Está la fase actual haciendo ruido o a punto de hacerlo? */
export function isAlerting(phase: Phase): boolean {
  return phase === 'scare' || phase === 'countdown' || phase === 'alarm';
}

/** Aplica histéresis para que la postura no parpadee en el umbral. */
function resolveSlouching(previous: boolean, deviationDeg: number, config: EngineConfig): boolean {
  const exitThreshold = Math.max(0, config.thresholdDeg - config.hysteresisDeg);
  return previous ? deviationDeg > exitThreshold : deviationDeg > config.thresholdDeg;
}

export function step(state: EngineState, input: EngineInput, config: EngineConfig): StepResult {
  if (state.phase === 'idle') {
    return { state, actions: [] };
  }

  const dtMs = Math.max(0, input.dtMs);
  const actions: EngineAction[] = [];
  const slouching = input.trusted ? resolveSlouching(state.slouching, input.deviationDeg, config) : state.slouching;

  let next: EngineState = {
    ...state,
    slouching,
    deviationDeg: input.deviationDeg,
    phaseMs: state.phaseMs + dtMs,
    sessionMs: state.sessionMs + dtMs,
    // Cuando la lectura no es fiable (el usuario camina o mueve el móvil)
    // congelamos los contadores en vez de inventarnos una postura.
    badMs: input.trusted ? (slouching ? state.badMs + dtMs : 0) : state.badMs,
    goodMs: input.trusted ? (slouching ? 0 : state.goodMs + dtMs) : state.goodMs,
    sessionBadMs: input.trusted && slouching ? state.sessionBadMs + dtMs : state.sessionBadMs,
  };

  const toPhase = (phase: Phase): void => {
    next = { ...next, phase, phaseMs: 0 };
  };

  const recovered = !slouching && next.goodMs >= config.recoverMs;

  switch (state.phase) {
    case 'ok': {
      if (slouching) {
        toPhase('slouching');
      }
      break;
    }

    case 'slouching': {
      if (!slouching && recovered) {
        toPhase('ok');
      } else if (next.badMs >= config.graceMs) {
        // Paso 2: el susto.
        toPhase('scare');
        actions.push({ type: 'beep' }, { type: 'haptic', pattern: 'warning' });
      }
      break;
    }

    case 'scare': {
      if (recovered) {
        toPhase('ok');
        actions.push({ type: 'silence' }, { type: 'speak', text: MESSAGES.recovered });
      } else if (next.phaseMs >= config.scareMs) {
        // Paso 3: empieza la cuenta atrás hablada.
        toPhase('countdown');
        next.countsSpoken = 1;
        actions.push({ type: 'speak', text: MESSAGES.counts[0] }, { type: 'haptic', pattern: 'tick' });
      }
      break;
    }

    case 'countdown': {
      if (recovered) {
        toPhase('ok');
        next.countsSpoken = 0;
        actions.push({ type: 'silence' }, { type: 'speak', text: MESSAGES.recovered });
        break;
      }
      const spoken = state.countsSpoken;
      if (spoken >= MESSAGES.counts.length && next.phaseMs >= MESSAGES.counts.length * config.countStepMs) {
        // Paso 4: alerta fuerte.
        toPhase('alarm');
        next.countsSpoken = 0;
        next.totalAlerts = state.totalAlerts + 1;
        actions.push(
          { type: 'startAlarm' },
          { type: 'haptic', pattern: 'alarm' },
          { type: 'notify', title: MESSAGES.notificationTitle, body: MESSAGES.notificationBody },
          { type: 'speak', text: MESSAGES.alarm }
        );
      } else if (spoken < MESSAGES.counts.length && next.phaseMs >= spoken * config.countStepMs) {
        next.countsSpoken = spoken + 1;
        actions.push({ type: 'speak', text: MESSAGES.counts[spoken] }, { type: 'haptic', pattern: 'tick' });
      }
      break;
    }

    case 'alarm': {
      if (recovered) {
        toPhase('cooldown');
        actions.push({ type: 'silence' }, { type: 'haptic', pattern: 'success' }, { type: 'speak', text: MESSAGES.recovered });
      } else if (next.phaseMs >= config.maxAlarmMs) {
        // Corte de seguridad: nadie debería quedarse con la sirena sonando.
        toPhase('cooldown');
        actions.push({ type: 'silence' });
      }
      break;
    }

    case 'cooldown': {
      if (next.phaseMs >= config.cooldownMs) {
        toPhase('ok');
        next.badMs = 0;
      }
      break;
    }
  }

  return { state: next, actions };
}
