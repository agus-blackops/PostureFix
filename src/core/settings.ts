import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildFrame } from './bodyFrame';
import type { Vector3 } from './orientation';
import { ALERT_LEVELS, type AlertLevel } from './postureEngine';
import { DEFAULT_PROFILES, PROFILE_IDS, sanitizeProfiles, type Profile, type ProfileId } from './profiles';
import { DEFAULT_SCHEDULE, sanitizeSchedule, type Schedule } from './schedule';
import { sanitizeHistory, type SessionRecord } from './sessionLog';
import { clamp, readBoolean, readChoice, readNumber } from './validate';

/**
 * Ajustes de la app de móvil, versión 2. La 1.x guardaba una sola calibración
 * y un solo umbral; la 2.0 los guarda por perfil (sentado, de pie, en clase) y
 * añade tema, horario y recordatorio. Al abrir la 2.0 por primera vez, los
 * ajustes de la 1.x se pasan al perfil «Sentado».
 */
const STORAGE_KEY = 'posturefix.settings.v2';
const LEGACY_KEY = 'posturefix.settings.v1';
const HISTORY_KEY = 'posturefix.history.v1';
const TRIAL_KEY = 'posturefix.trial.v1';

export type ThemeMode = 'system' | 'light' | 'dark';
export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export interface Settings {
  activeProfile: ProfileId;
  profiles: Record<ProfileId, Profile>;

  /** Volumen de las alertas (0,2-1). */
  volume: number;
  /** Usar el tono EAS cuando hay auriculares conectados. */
  easWithHeadphones: boolean;
  /** Usar el tono EAS también por el altavoz. */
  easAlways: boolean;
  /** Cuenta hablada y avisos por voz. */
  voiceEnabled: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
  /** Mantener la pantalla encendida mientras se vigila. */
  keepAwake: boolean;
  /** Auriculares declarados a mano cuando no hay detección nativa. */
  manualHeadphones: boolean;
  /** Sesión de control: mide y registra, pero no avisa. */
  controlMode: boolean;
  /** Toques suaves al pulsar. */
  uiHaptics: boolean;

  theme: ThemeMode;
  schedule: Schedule;
  /** Avisar para levantarse cada `standEveryMinutes` sentado. */
  standReminder: boolean;
  standEveryMinutes: number;

  // PostureFix Labs.
  dailyGoalMinutes: number;
  labsStreaks: boolean;
  labsWeekly: boolean;
  labsStretches: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  activeProfile: 'sentado',
  profiles: DEFAULT_PROFILES,
  volume: 1,
  easWithHeadphones: true,
  easAlways: false,
  voiceEnabled: true,
  vibrationEnabled: true,
  notificationsEnabled: true,
  keepAwake: true,
  manualHeadphones: false,
  controlMode: false,
  uiHaptics: true,
  theme: 'system',
  schedule: DEFAULT_SCHEDULE,
  standReminder: false,
  standEveryMinutes: 45,
  dailyGoalMinutes: 30,
  labsStreaks: true,
  labsWeekly: true,
  labsStretches: true,
};

export const LIMITS = {
  volume: { min: 0.2, max: 1, step: 0.05 },
  standEveryMinutes: { min: 15, max: 120, step: 5 },
  dailyGoalMinutes: { min: 10, max: 240, step: 5 },
};

export { clamp };

type BooleanSetting = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

/** Normaliza lo leído de disco campo a campo: lo corrupto vuelve a su valor por defecto. */
export function sanitize(raw: Partial<Record<keyof Settings, unknown>> | null | undefined): Settings {
  const input = raw ?? {};
  const flag = (key: BooleanSetting) => readBoolean(input[key], DEFAULT_SETTINGS[key]);
  return {
    activeProfile: readChoice(input.activeProfile, PROFILE_IDS, DEFAULT_SETTINGS.activeProfile),
    profiles: sanitizeProfiles(input.profiles),
    volume: readNumber(input.volume, DEFAULT_SETTINGS.volume, LIMITS.volume.min, LIMITS.volume.max),
    easWithHeadphones: flag('easWithHeadphones'),
    easAlways: flag('easAlways'),
    voiceEnabled: flag('voiceEnabled'),
    vibrationEnabled: flag('vibrationEnabled'),
    notificationsEnabled: flag('notificationsEnabled'),
    keepAwake: flag('keepAwake'),
    manualHeadphones: flag('manualHeadphones'),
    controlMode: flag('controlMode'),
    uiHaptics: flag('uiHaptics'),
    theme: readChoice(input.theme, THEME_MODES, DEFAULT_SETTINGS.theme),
    schedule: sanitizeSchedule(input.schedule),
    standReminder: flag('standReminder'),
    standEveryMinutes: readNumber(
      input.standEveryMinutes,
      DEFAULT_SETTINGS.standEveryMinutes,
      LIMITS.standEveryMinutes.min,
      LIMITS.standEveryMinutes.max
    ),
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

/**
 * Pasa los ajustes de la 1.x a la 2.0: la calibración, el umbral, el margen y
 * el nivel de aviso van al perfil «Sentado»; el resto se conserva tal cual.
 */
export function migrateV1(raw: Record<string, unknown> | null | undefined): Settings {
  const old = raw ?? {};
  const baseline = old.baseline as Partial<Vector3> | null | undefined;
  const validBaseline =
    baseline && [baseline.x, baseline.y, baseline.z].every((n) => typeof n === 'number' && Number.isFinite(n));
  const built = validBaseline ? buildFrame(baseline as Vector3) : null;
  const sentado = {
    ...DEFAULT_PROFILES.sentado,
    frame: built && 'frame' in built ? built.frame : null,
    thresholdDeg: old.thresholdDeg,
    graceSeconds: old.graceSeconds,
    maxAlertLevel: readChoice(old.maxAlertLevel, ALERT_LEVELS, DEFAULT_PROFILES.sentado.maxAlertLevel as AlertLevel),
  };
  return sanitize({ ...old, activeProfile: 'sentado', profiles: { ...DEFAULT_PROFILES, sentado: sentado } });
}

export function activeProfileOf(settings: Settings): Profile {
  return settings.profiles[settings.activeProfile];
}

/** Ajustes con un perfil cambiado. */
export function withProfile(settings: Settings, id: ProfileId, patch: Partial<Profile>): Settings {
  return { ...settings, profiles: { ...settings.profiles, [id]: { ...settings.profiles[id], ...patch } } };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    return legacy ? migrateV1(JSON.parse(legacy)) : DEFAULT_SETTINGS;
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

/**
 * Cuándo empezó la prueba gratis de Labs. La primera vez que se llama, la
 * empieza y la guarda.
 */
export async function loadTrialStart(now: number = Date.now()): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TRIAL_KEY);
    const stored = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(stored) && stored > 0) return stored;
    await AsyncStorage.setItem(TRIAL_KEY, String(now));
  } catch {
    // Sin almacenamiento, la prueba cuenta desde esta apertura.
  }
  return now;
}
