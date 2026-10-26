/**
 * Qué decir cuando la cámara no se abre. El navegador da un error en inglés
 * («Permission denied by system») que no explica qué tocar; aquí se traduce a
 * pasos concretos según la causa. Puro, para poder probarlo sin cámara.
 */

/** Pantalla de Windows con los permisos de la cámara. */
export const WINDOWS_CAMERA_SETTINGS = 'ms-settings:privacy-webcam';

export interface CameraHelp {
  title: string;
  text: string;
  /** Enlace a los ajustes del sistema que lo arreglan, si los hay. */
  settingsUrl: string | null;
}

export function cameraErrorHelp(error: { name?: string; message?: string } | null | undefined, userAgent: string): CameraHelp {
  const name = error?.name ?? '';
  const message = error?.message ?? '';
  const windows = /Windows/i.test(userAgent);
  const mac = /Mac OS X|Macintosh/i.test(userAgent);

  // Lo bloquea el sistema, no el navegador: en Windows, la privacidad de la cámara.
  if (name === 'NotAllowedError' && /system/i.test(message)) {
    if (windows) {
      return {
        title: 'Windows tiene la cámara bloqueada',
        text:
          'Abre Configuración → Privacidad y seguridad → Cámara y activa «Acceso a la cámara», ' +
          '«Permitir que las aplicaciones accedan a la cámara» y «Permitir que las aplicaciones de escritorio ' +
          'accedan a la cámara». En portátiles ASUS mira también la tecla con el dibujo de una cámara (suele ' +
          'ser F10) y la tapita de la webcam. Luego pulsa «Calibrar» otra vez.',
        settingsUrl: WINDOWS_CAMERA_SETTINGS,
      };
    }
    return {
      title: 'El sistema tiene la cámara bloqueada',
      text: mac
        ? 'Abre Ajustes del Sistema → Privacidad y seguridad → Cámara, deja que esta app o el navegador la usen, ' +
          'y vuelve a abrirlo. Luego pulsa «Calibrar».'
        : 'Revisa los permisos de cámara del sistema operativo y que no esté tapada o apagada con una tecla. ' +
          'Luego pulsa «Calibrar» otra vez.',
      settingsUrl: null,
    };
  }

  // Lo ha denegado el navegador (o la persona, al pulsar «Bloquear»).
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return {
      title: 'No hay permiso para usar la cámara',
      text:
        'Pulsa el candado o el icono de la cámara junto a la dirección, elige «Permitir» para la cámara ' +
        'y recarga la página. Luego pulsa «Calibrar».',
      settingsUrl: null,
    };
  }

  // Otra aplicación la tiene ocupada.
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return {
      title: 'La cámara está ocupada',
      text:
        'Otra aplicación la está usando (Teams, Zoom, la app Cámara, otra pestaña…). Ciérrala y pulsa ' +
        '«Calibrar» otra vez.',
      settingsUrl: null,
    };
  }

  // No hay cámara, o está apagada.
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return {
      title: 'No encuentro ninguna cámara',
      text:
        'Comprueba que el portátil tiene webcam y que no está apagada: en muchos portátiles hay una tecla con ' +
        'el dibujo de una cámara (en ASUS suele ser F10) o una tapita. Luego pulsa «Calibrar».',
      settingsUrl: windows ? WINDOWS_CAMERA_SETTINGS : null,
    };
  }

  return {
    title: 'No se pudo abrir la cámara',
    text: `${message || 'Error desconocido'}. Revisa el permiso de cámara del navegador o si otra aplicación la está usando, y pulsa «Calibrar» otra vez.`,
    settingsUrl: null,
  };
}
