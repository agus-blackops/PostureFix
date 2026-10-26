/**
 * Modo feria de la app de móvil (2.1): para enseñar PostureFix en un stand.
 *
 * La secuencia es la misma, pero en corto: avisa al segundo de encorvarse, la
 * alarma dura unos segundos y suena más baja, porque al lado hay otros stands.
 * Lo que se mide en modo feria no va al historial del experimento: son
 * visitantes encorvándose a propósito, no datos.
 *
 * Puro, como la máquina de estados: la capa de React sólo pregunta aquí.
 */
import type { AlarmSound, EngineConfig } from './postureEngine';

export const FAIR_PRESET = {
  /** Nunca menos sensible que esto, aunque el perfil lo sea. */
  thresholdDeg: 18,
  graceMs: 1000,
  cooldownMs: 2500,
  /** La alarma se corta sola a los 6 s. */
  maxAlarmMs: 6000,
  /** Volumen máximo de las alertas. */
  maxVolume: 0.7,
} as const;

/** La configuración del motor en modo feria: la secuencia entera, en corto. */
export function fairEngineConfig(base: EngineConfig): EngineConfig {
  return {
    ...base,
    thresholdDeg: Math.min(base.thresholdDeg, FAIR_PRESET.thresholdDeg),
    graceMs: FAIR_PRESET.graceMs,
    cooldownMs: FAIR_PRESET.cooldownMs,
    maxAlarmMs: FAIR_PRESET.maxAlarmMs,
    maxLevel: 'alarm',
  };
}

/** Volumen de las alertas: en modo feria, como mucho `maxVolume`. */
export function alertVolume(volume: number, fairMode: boolean): number {
  return fairMode ? Math.min(volume, FAIR_PRESET.maxVolume) : volume;
}

/**
 * Qué alarma suena. El tono EAS por el altavoz asusta de verdad: en modo feria
 * sólo suena con auriculares, y si no, la sirena.
 */
export function chooseAlarmSound(
  options: { easAlways: boolean; easWithHeadphones: boolean; fairMode: boolean },
  headphonesConnected: boolean
): AlarmSound {
  if (headphonesConnected && (options.easWithHeadphones || options.easAlways)) return 'eas';
  if (options.easAlways && !options.fairMode) return 'eas';
  return 'siren';
}
