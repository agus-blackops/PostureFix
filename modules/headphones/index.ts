import type { EventSubscription } from 'expo-modules-core';

import HeadphonesModule from './src/HeadphonesModule';
import type { HeadphonesStatus } from './src/Headphones.types';

export type { HeadphoneKind, HeadphonesStatus } from './src/Headphones.types';

/** `true` si esta build incluye el módulo nativo de detección de auriculares. */
export const isHeadphoneDetectionAvailable = HeadphonesModule != null;

const UNKNOWN: HeadphonesStatus = { connected: false, kind: null };

/** Estado actual de la salida de audio. Devuelve `null` si no se puede saber. */
export function getHeadphonesStatus(): HeadphonesStatus | null {
  if (!HeadphonesModule) {
    return null;
  }
  try {
    return HeadphonesModule.getStatus() ?? UNKNOWN;
  } catch {
    return null;
  }
}

/** Se suscribe a los cambios de ruta de audio (conectar/desconectar auriculares). */
export function addHeadphonesListener(
  listener: (status: HeadphonesStatus) => void
): EventSubscription | null {
  if (!HeadphonesModule) {
    return null;
  }
  try {
    return HeadphonesModule.addListener('onChange', listener);
  } catch {
    return null;
  }
}
