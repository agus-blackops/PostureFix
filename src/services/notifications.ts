import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'posture-alerts';

/** La alerta se muestra siempre, también con la app abierta. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false, // el sonido lo controla la propia app
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

/**
 * Pide permiso y crea el canal de Android con la importancia máxima para que la
 * alerta salte por encima de lo que el usuario esté haciendo.
 *
 * @returns `true` si se puede notificar.
 */
export async function prepareNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Alertas de postura',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 250, 600],
        lightColor: '#FF7A29',
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: null, // el tono lo pone la app, no el sistema
      });
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false, allowCriticalAlerts: true },
    });
    return requested.granted;
  } catch {
    return false;
  }
}

/** Mensaje de alerta fuerte que acompaña a la sirena. */
export async function sendPostureAlert(title: string, body: string, enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: false,
        vibrate: [0, 600, 250, 600],
        priority: Notifications.AndroidNotificationPriority.MAX,
        interruptionLevel: 'critical',
        color: '#FF3B30',
        sticky: false,
      },
      // En Android hay que nombrar el canal para heredar su importancia máxima;
      // en iOS `null` significa "ahora mismo".
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  } catch {
    // La notificación es un extra: la alarma sonora ya está sonando.
  }
}
