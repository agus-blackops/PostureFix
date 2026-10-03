/**
 * Perfiles de la 2.0: sentado, de pie y en clase. Cada uno guarda su propia
 * calibración, porque el móvil queda distinto en el bolsillo sentado que de
 * pie, y sus propios límites: en clase basta con un pitido.
 */
import { sanitizeFrame, type BodyFrame } from './bodyFrame';
import { ALERT_LEVELS, DEFAULT_ENGINE_CONFIG, type AlertLevel } from './postureEngine';
import { readBoolean, readChoice, readNumber } from './validate';

export const PROFILE_IDS = ['sentado', 'de-pie', 'clase'] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

export interface Profile {
  /** Ejes calibrados; `null` mientras no se haya calibrado este perfil. */
  frame: BodyFrame | null;
  /** Dispersión de la última calibración, en grados. */
  spreadDeg: number | null;
  thresholdDeg: number;
  graceSeconds: number;
  maxAlertLevel: AlertLevel;
  /** Con la calibración en dos pasos, echarse hacia atrás no cuenta. */
  ignoreBackward: boolean;
}

export const PROFILE_NAMES: Record<ProfileId, string> = {
  sentado: 'Sentado',
  'de-pie': 'De pie',
  clase: 'En clase',
};

export const PROFILE_LIMITS = {
  thresholdDeg: { min: 10, max: 55, step: 1 },
  graceSeconds: { min: 1, max: 20, step: 0.5 },
} as const;

const base: Profile = {
  frame: null,
  spreadDeg: null,
  thresholdDeg: DEFAULT_ENGINE_CONFIG.thresholdDeg,
  graceSeconds: DEFAULT_ENGINE_CONFIG.graceMs / 1000,
  maxAlertLevel: 'alarm',
  ignoreBackward: true,
};

/**
 * Puntos de partida razonables. De pie el móvil se balancea más al andar, así
 * que el margen es un poco mayor; en clase sólo pita.
 */
export const DEFAULT_PROFILES: Record<ProfileId, Profile> = {
  sentado: base,
  'de-pie': { ...base, thresholdDeg: 20, graceSeconds: 5 },
  clase: { ...base, maxAlertLevel: 'beep' },
};

export function sanitizeProfile(raw: unknown, fallback: Profile): Profile {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const spread = readNumber(input.spreadDeg, NaN, 0, 90);
  return {
    frame: sanitizeFrame(input.frame),
    spreadDeg: Number.isFinite(spread) ? spread : null,
    thresholdDeg: readNumber(input.thresholdDeg, fallback.thresholdDeg, PROFILE_LIMITS.thresholdDeg.min, PROFILE_LIMITS.thresholdDeg.max),
    graceSeconds: readNumber(input.graceSeconds, fallback.graceSeconds, PROFILE_LIMITS.graceSeconds.min, PROFILE_LIMITS.graceSeconds.max),
    maxAlertLevel: readChoice(input.maxAlertLevel, ALERT_LEVELS, fallback.maxAlertLevel),
    ignoreBackward: readBoolean(input.ignoreBackward, fallback.ignoreBackward),
  };
}

export function sanitizeProfiles(raw: unknown): Record<ProfileId, Profile> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(PROFILE_IDS.map((id) => [id, sanitizeProfile(input[id], DEFAULT_PROFILES[id])])) as Record<
    ProfileId,
    Profile
  >;
}

/** Cómo está calibrado un perfil, para decirlo con palabras. */
export function calibrationKind(profile: Profile): 'none' | 'upright' | 'two-step' {
  if (!profile.frame) return 'none';
  return profile.frame.forward ? 'two-step' : 'upright';
}
