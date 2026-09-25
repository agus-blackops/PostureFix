import AsyncStorage from '@react-native-async-storage/async-storage';

import { ALERT_LEVELS, DEFAULT_ENGINE_CONFIG, type AlertLevel } from './postureEngine';
import { sanitizeHistory, type SessionRecord } from './sessionLog';
import type { Vector3 } from './orientation';
import { clamp, readBoolean, readChoice, readNumber } from './validate';

const STORAGE_KEY = 'posturefix.settings.v1';
const HISTORY_KEY = 'posturefix.history.v1';

export interface Settings {
  /** Vector de gravedad guardado al calibrar con la espalda recta. */
  baseline: Vector3 | null;
  /** Grados de inclinación que se consideran "agachado". */
  thresholdDeg: number;
  /** Segundos agachado antes del pitido. */
  graceSeconds: number;
  /** Volumen de las alertas (0-1). */
  volume: number;
  /** Usar el tono EAS cuando hay auriculares conectados. */
  easWithHeadphones: boolean;
  /** Usar el tono EAS también por el altavoz. */
  easAlways: boolean;
  /** Cuenta hablada "uno, dos, tres" y avisos por voz. */
  voiceEnabled: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
  /** Mantener la pantalla encendida mientras se vigila. */
  keepAwake: boolean;
  /** Auriculares declarados a mano cuando no hay detección nativa. */
  manualHeadphones: boolean;
  /**
   * Sesión de control: mide y registra, pero no avisa. Es el grupo con el que
   * comparar para saber si los avisos sirven de algo.
   */
  controlMode: boolean;
  /** Último escalón del aviso: pitido, cuenta o alarma completa. */
  maxAlertLevel: AlertLevel;
  /** Toques suaves al pulsar botones e interruptores. */
  uiHaptics: boolean;

  // PostureFix Labs (solo con la suscripción activa).
  /** Minutos de buena postura al día que cuentan para la racha. */
  dailyGoalMinutes: number;
  /** Tarjeta de objetivo diario, racha e insignias. */
  labsStreaks: boolean;
  /** Informe de los últimos siete días. */
  labsWeekly: boolean;
  /** Estiramientos guiados con temporizador y voz. */
  labsStretches: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  baseline: null,
  thresholdDeg: DEFAULT_ENGINE_CONFIG.thresholdDeg,
  graceSeconds: DEFAULT_ENGINE_CONFIG.graceMs / 1000,
  volume: 1,
  easWithHeadphones: true,
  easAlways: false,
  voiceEnabled: true,
  vibrationEnabled: true,
  notificationsEnabled: true,
  keepAwake: true,
  manualHeadphones: false,
  controlMode: false,
  maxAlertLevel: DEFAULT_ENGINE_CONFIG.maxLevel,
  uiHaptics: true,
  dailyGoalMinutes: 30,
  labsStreaks: true,
  labsWeekly: true,
  labsStretches: true,
};

export const LIMITS = {
  thresholdDeg: { min: 10, max: 55, step: 1 },
  graceSeconds: { min: 1, max: 20, step: 0.5 },
  volume: { min: 0.2, max: 1, step: 0.05 },
  dailyGoalMinutes: { min: 10, max: 240, step: 5 },
};

export { clamp };

/**
 * Normaliza lo leído de disco: descarta valores corruptos o fuera de rango.
 * Cada ajuste se valida por su tipo; un `"true"` guardado como texto o un
 * volumen `NaN` vuelven a su valor por defecto en vez de colarse en la app.
 */
export function sanitize(raw: Partial<Record<keyof Settings, unknown>> | null | undefined): Settings {
  const input = raw ?? {};
  const baseline = input.baseline as Partial<Vector3> | null | undefined;
  const flag = (key: BooleanSetting) => readBoolean(input[key], DEFAULT_SETTINGS[key]);
  return {
    baseline:
      baseline && [baseline.x, baseline.y, baseline.z].every((n) => typeof n === 'number' && Number.isFinite(n))
        ? { x: baseline.x as number, y: baseline.y as number, z: baseline.z as number }
        : null,
    thresholdDeg: readNumber(input.thresholdDeg, DEFAULT_SETTINGS.thresholdDeg, LIMITS.thresholdDeg.min, LIMITS.thresholdDeg.max),
    graceSeconds: readNumber(input.graceSeconds, DEFAULT_SETTINGS.graceSeconds, LIMITS.graceSeconds.min, LIMITS.graceSeconds.max),
    volume: readNumber(input.volume, DEFAULT_SETTINGS.volume, LIMITS.volume.min, LIMITS.volume.max),
    easWithHeadphones: flag('easWithHeadphones'),
    easAlways: flag('easAlways'),
    voiceEnabled: flag('voiceEnabled'),
    vibrationEnabled: flag('vibrationEnabled'),
    notificationsEnabled: flag('notificationsEnabled'),
    keepAwake: flag('keepAwake'),
    manualHeadphones: flag('manualHeadphones'),
    controlMode: flag('controlMode'),
    maxAlertLevel: readChoice(input.maxAlertLevel, ALERT_LEVELS, DEFAULT_SETTINGS.maxAlertLevel),
    uiHaptics: flag('uiHaptics'),
    dailyGoalMinutes: readNumber(
      input.dailyGoalMinutes,
      DEFAULT_SETTINGS.dailyGoalMinutes,
      LIMITS.dailyGoalMinutes.min,
      LIMITS.dailyGoalMinutes.max
    ),
    labsStreaks: flag('labsStreaks'),
    labsWeekly: flag('labsWeekly'),
    labsStretches: flag('labsStretches'),
  };
}

type BooleanSetting = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Que no se pueda guardar no debe tumbar la vigilancia en curso.
  }
}

export async function loadHistory(): Promise<SessionRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return sanitizeHistory(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export async function saveHistory(history: SessionRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Perder el historial no debe interrumpir una sesión en curso.
  }
}
