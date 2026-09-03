import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_ENGINE_CONFIG } from './postureEngine';
import { sanitizeHistory, type SessionRecord } from './sessionLog';
import type { Vector3 } from './orientation';

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
};

export const LIMITS = {
  thresholdDeg: { min: 10, max: 55, step: 1 },
  graceSeconds: { min: 1, max: 20, step: 0.5 },
  volume: { min: 0.2, max: 1, step: 0.05 },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Normaliza lo leído de disco: descarta valores corruptos o fuera de rango. */
export function sanitize(raw: Partial<Settings> | null | undefined): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  const baseline = merged.baseline;
  return {
    ...merged,
    baseline:
      baseline && [baseline.x, baseline.y, baseline.z].every((n) => typeof n === 'number' && Number.isFinite(n))
        ? { x: baseline.x, y: baseline.y, z: baseline.z }
        : null,
    thresholdDeg: clamp(Number(merged.thresholdDeg) || DEFAULT_SETTINGS.thresholdDeg, LIMITS.thresholdDeg.min, LIMITS.thresholdDeg.max),
    graceSeconds: clamp(Number(merged.graceSeconds) || DEFAULT_SETTINGS.graceSeconds, LIMITS.graceSeconds.min, LIMITS.graceSeconds.max),
    volume: clamp(Number(merged.volume) || DEFAULT_SETTINGS.volume, LIMITS.volume.min, LIMITS.volume.max),
  };
}

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
