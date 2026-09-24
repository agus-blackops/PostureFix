import { sanitizeHistory, type SessionRecord } from '../../src/core/sessionLog';
import type { ModelQuality } from './detector';
import type { PostureMetrics } from './postureVision';
import { readBoolean, readChoice, readNumber } from '../../src/core/validate';

const STORAGE_KEY = 'posturefix.web.v1';
const HISTORY_KEY = 'posturefix.web.history.v1';

export interface WebSettings {
  /** Postura de referencia guardada al calibrar. */
  baseline: PostureMetrics | null;
  thresholdDeg: number;
  graceSeconds: number;
  volume: number;
  /** Marcado a mano: el navegador no puede saber si llevas auriculares. */
  headphones: boolean;
  /** Usar el tono EAS también por los altavoces del portátil. */
  easAlways: boolean;
  voiceEnabled: boolean;
  notificationsEnabled: boolean;
  /** Fotogramas por segundo que se analizan. La postura cambia despacio. */
  fps: number;
  /**
   * Sesión de control: mide y registra, pero no avisa. Es el grupo con el que
   * comparar para saber si los avisos sirven de algo.
   */
  controlMode: boolean;
  /** Modelo de detección: 'full' sitúa mejor los puntos, 'lite' pide menos CPU. */
  modelQuality: ModelQuality;
}

export const DEFAULT_SETTINGS: WebSettings = {
  baseline: null,
  thresholdDeg: 22,
  graceSeconds: 4,
  volume: 1,
  headphones: false,
  easAlways: false,
  voiceEnabled: true,
  notificationsEnabled: true,
  fps: 15,
  controlMode: false,
  modelQuality: 'full',
};

export const LIMITS = {
  thresholdDeg: { min: 10, max: 55 },
  graceSeconds: { min: 1, max: 20 },
  volume: { min: 0, max: 1 },
  fps: { min: 5, max: 30 },
};

/**
 * Normaliza lo leído de `localStorage`. Cada ajuste se valida por su tipo: un
 * volumen corrupto antes llegaba como `NaN` al audio y un sí/no guardado como
 * texto se tomaba por verdadero.
 */
export function sanitize(raw: Partial<Record<keyof WebSettings, unknown>> | null | undefined): WebSettings {
  const input = raw ?? {};
  const baseline = input.baseline as Record<string, unknown> | null | undefined;
  const validBaseline =
    !!baseline &&
    typeof baseline === 'object' &&
    ['shoulderWidth', 'headLift', 'shoulderY', 'tiltDeg'].every((key) => {
      const value = baseline[key];
      return typeof value === 'number' && Number.isFinite(value);
    });
  const flag = (key: BooleanSetting) => readBoolean(input[key], DEFAULT_SETTINGS[key]);
  return {
    baseline: validBaseline ? (baseline as unknown as PostureMetrics) : null,
    thresholdDeg: readNumber(input.thresholdDeg, DEFAULT_SETTINGS.thresholdDeg, LIMITS.thresholdDeg.min, LIMITS.thresholdDeg.max),
    graceSeconds: readNumber(input.graceSeconds, DEFAULT_SETTINGS.graceSeconds, LIMITS.graceSeconds.min, LIMITS.graceSeconds.max),
    volume: readNumber(input.volume, DEFAULT_SETTINGS.volume, LIMITS.volume.min, LIMITS.volume.max),
    fps: Math.round(readNumber(input.fps, DEFAULT_SETTINGS.fps, LIMITS.fps.min, LIMITS.fps.max)),
    headphones: flag('headphones'),
    easAlways: flag('easAlways'),
    voiceEnabled: flag('voiceEnabled'),
    notificationsEnabled: flag('notificationsEnabled'),
    controlMode: flag('controlMode'),
    modelQuality: readChoice(input.modelQuality, ['full', 'lite'] as const, DEFAULT_SETTINGS.modelQuality),
  };
}

type BooleanSetting = {
  [K in keyof WebSettings]: WebSettings[K] extends boolean ? K : never;
}[keyof WebSettings];

export function loadSettings(): WebSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: WebSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Modo incógnito o almacenamiento lleno: la vigilancia sigue funcionando.
  }
}

export function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return sanitizeHistory(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export function saveHistory(history: SessionRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Perder el historial no debe interrumpir una sesión en curso.
  }
}
