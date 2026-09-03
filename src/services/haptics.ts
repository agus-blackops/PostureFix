import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

export type HapticPattern = 'warning' | 'tick' | 'alarm' | 'success';

/** Patrón largo de la alerta fuerte: vibra, para, vibra... (ms). */
const ALARM_PATTERN = [0, 600, 250, 600, 250, 900];

/**
 * Vibración de cada momento de la secuencia. `Haptics` da el golpe seco y
 * `Vibration` los patrones largos, que es lo que de verdad se nota con el móvil
 * en el bolsillo.
 */
export async function fireHaptic(pattern: HapticPattern, enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    switch (pattern) {
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Vibration.vibrate(Platform.OS === 'android' ? [0, 250, 120, 250] : 400);
        break;
      case 'tick':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'alarm':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Vibration.vibrate(ALARM_PATTERN, true); // en bucle hasta enderezarse
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
    }
  } catch {
    // Hay dispositivos sin motor háptico: la alerta sigue sonando igual.
  }
}

export function stopVibration(): void {
  Vibration.cancel();
}
