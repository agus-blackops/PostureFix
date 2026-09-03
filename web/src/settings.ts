import { sanitizeHistory, type SessionRecord } from '../../src/core/sessionLog';
import type { PostureMetrics } from './postureVision';

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
};

export const LIMITS = {
  thresholdDeg: { min: 10, max: 55 },
  graceSeconds: { min: 1, max: 20 },
  volume: { min: 0, max: 1 },
  fps: { min: 5, max: 30 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function sanitize(raw: Partial<WebSettings> | null): WebSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  const baseline = merged.baseline;
  const validBaseline =
    baseline &&
    ['shoulderWidth', 'headLift', 'shoulderY', 'tiltDeg'].every(
      (key) => Number.isFinite((baseline as unknown as Record<string, number>)[key])
    );
  return {
    ...merged,
    baseline: validBaseline ? baseline : null,
    thresholdDeg: clamp(Number(merged.thresholdDeg) || DEFAULT_SETTINGS.thresholdDeg, LIMITS.thresholdDeg.min, LIMITS.thresholdDeg.max),
    graceSeconds: clamp(Number(merged.graceSeconds) || DEFAULT_SETTINGS.graceSeconds, LIMITS.graceSeconds.min, LIMITS.graceSeconds.max),
    volume: clamp(Number(merged.volume), LIMITS.volume.min, LIMITS.volume.max),
    fps: clamp(Number(merged.fps) || DEFAULT_SETTINGS.fps, LIMITS.fps.min, LIMITS.fps.max),
  };
}

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
