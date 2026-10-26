import { WINDOWS_CAMERA_SETTINGS, cameraErrorHelp } from '../cameraError';

const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';
const LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';

describe('cameraErrorHelp', () => {
  it('«Permission denied by system» en Windows lleva a la privacidad de la cámara', () => {
    const help = cameraErrorHelp({ name: 'NotAllowedError', message: 'Permission denied by system' }, WINDOWS);
    expect(help.title).toBe('Windows tiene la cámara bloqueada');
    expect(help.text).toContain('Privacidad y seguridad → Cámara');
    expect(help.text).toContain('aplicaciones de escritorio');
    expect(help.settingsUrl).toBe(WINDOWS_CAMERA_SETTINGS);
  });

  it('el bloqueo del sistema en Mac o Linux no ofrece el enlace de Windows', () => {
    const error = { name: 'NotAllowedError', message: 'Permission denied by system' };
    expect(cameraErrorHelp(error, MAC).text).toContain('Ajustes del Sistema');
    expect(cameraErrorHelp(error, MAC).settingsUrl).toBeNull();
    expect(cameraErrorHelp(error, LINUX).settingsUrl).toBeNull();
  });

  it('el permiso denegado en el navegador explica dónde darlo', () => {
    const help = cameraErrorHelp({ name: 'NotAllowedError', message: 'Permission denied' }, WINDOWS);
    expect(help.title).toBe('No hay permiso para usar la cámara');
    expect(help.settingsUrl).toBeNull();
  });

  it('cámara ocupada por otra aplicación', () => {
    expect(cameraErrorHelp({ name: 'NotReadableError', message: 'Could not start video source' }, WINDOWS).title).toBe(
      'La cámara está ocupada'
    );
  });

  it('sin cámara: menciona la tecla de la cámara y, en Windows, los ajustes', () => {
    const help = cameraErrorHelp({ name: 'NotFoundError', message: 'Requested device not found' }, WINDOWS);
    expect(help.title).toBe('No encuentro ninguna cámara');
    expect(help.text).toContain('F10');
    expect(help.settingsUrl).toBe(WINDOWS_CAMERA_SETTINGS);
  });

  it('un error desconocido conserva el mensaje original', () => {
    const help = cameraErrorHelp({ name: 'Error', message: 'Algo raro' }, WINDOWS);
    expect(help.title).toBe('No se pudo abrir la cámara');
    expect(help.text).toContain('Algo raro');
    expect(cameraErrorHelp(null, WINDOWS).text).toContain('Error desconocido');
  });
});
