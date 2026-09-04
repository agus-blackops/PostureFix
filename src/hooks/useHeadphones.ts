import { useEffect, useState } from 'react';

import {
  addHeadphonesListener,
  getHeadphonesStatus,
  isHeadphoneDetectionAvailable,
  type HeadphonesStatus,
} from '../../modules/headphones';

export interface HeadphonesInfo {
  connected: boolean;
  kind: HeadphonesStatus['kind'];
  /** `false` en Expo Go o en web: ahí manda el interruptor manual de ajustes. */
  detectionAvailable: boolean;
}

/**
 * Estado de los auriculares. Si el módulo nativo no está en la build, se usa el
 * valor que el usuario haya marcado a mano en los ajustes.
 */
export function useHeadphones(manualFallback: boolean): HeadphonesInfo {
  const [status, setStatus] = useState<HeadphonesStatus | null>(() => getHeadphonesStatus());

  useEffect(() => {
    const subscription = addHeadphonesListener(setStatus);
    setStatus(getHeadphonesStatus());
    return () => subscription?.remove();
  }, []);

  return {
    connected: isHeadphoneDetectionAvailable ? (status?.connected ?? false) : manualFallback,
    kind: status?.kind ?? null,
    detectionAvailable: isHeadphoneDetectionAvailable,
  };
}
