import { betterCamera, cameraAttempts, cameraLabel, isInfraredCamera, isPermissionError } from '../cameraPlan';

const NORMAL = { deviceId: 'web', label: 'USB2.0 HD UVC WebCam (13d3:56dd)' };
const IR = { deviceId: 'ir', label: 'USB2.0 HD IR UVC WebCam (13d3:56dc)' };
const EXTERNAL = { deviceId: 'ext', label: 'Logitech C920' };

const ids = (attempts: ReturnType<typeof cameraAttempts>) =>
  attempts.map((a) => (a === true ? 'true' : a.deviceId ? (a.deviceId as { exact: string }).exact : 'default'));

describe('isInfraredCamera', () => {
  it('reconoce las cámaras de infrarrojos por el nombre', () => {
    expect(isInfraredCamera(IR.label)).toBe(true);
    expect(isInfraredCamera('Integrated IR Camera')).toBe(true);
    expect(isInfraredCamera('Windows Hello Face Camera')).toBe(true);
    expect(isInfraredCamera('Cámara de infrarrojos')).toBe(true);
  });

  it('no confunde las normales', () => {
    expect(isInfraredCamera(NORMAL.label)).toBe(false);
    expect(isInfraredCamera('Integrated Camera')).toBe(false);
    expect(isInfraredCamera('HD Webcam (Firmware)')).toBe(false);
    expect(isInfraredCamera('')).toBe(false);
  });
});

describe('cameraAttempts', () => {
  it('con nombres, va directa a la normal y deja la de infrarrojos para el final', () => {
    expect(ids(cameraAttempts(null, [IR, NORMAL]))).toEqual(['web', 'default', 'true', 'ir']);
  });

  it('la elegida va primero', () => {
    expect(ids(cameraAttempts('ext', [IR, NORMAL, EXTERNAL]))).toEqual(['ext', 'web', 'default', 'true', 'ir']);
  });

  it('antes del permiso (sin nombres ni identificadores) prueba la de siempre y sin condiciones', () => {
    expect(ids(cameraAttempts(null, [{ deviceId: '', label: '' }]))).toEqual(['default', 'true']);
    expect(ids(cameraAttempts(null, []))).toEqual(['default', 'true']);
  });

  it('una elegida que ya no existe se intenta igual (y si falla, siguen las demás)', () => {
    expect(ids(cameraAttempts('vieja', [NORMAL]))).toEqual(['vieja', 'web', 'default', 'true']);
  });

  it('no repite cámaras', () => {
    const list = ids(cameraAttempts('web', [NORMAL, IR]));
    expect(new Set(list).size).toBe(list.length);
  });
});

describe('betterCamera', () => {
  it('si se abrió la de infrarrojos, propone la normal', () => {
    expect(betterCamera(IR.label, [IR, NORMAL])).toBe('web');
  });

  it('si se abrió una normal, o no hay otra, no cambia', () => {
    expect(betterCamera(NORMAL.label, [IR, NORMAL])).toBeNull();
    expect(betterCamera(IR.label, [IR])).toBeNull();
  });
});

describe('isPermissionError / cameraLabel', () => {
  it('distingue los errores de permiso', () => {
    expect(isPermissionError({ name: 'NotAllowedError' })).toBe(true);
    expect(isPermissionError({ name: 'NotReadableError' })).toBe(false);
    expect(isPermissionError(null)).toBe(false);
  });

  it('limpia el nombre y marca la de infrarrojos', () => {
    expect(cameraLabel(NORMAL, 0)).toBe('USB2.0 HD UVC WebCam');
    expect(cameraLabel(IR, 1)).toBe('USB2.0 HD IR UVC WebCam (infrarrojos)');
    expect(cameraLabel({ deviceId: 'x', label: '' }, 2)).toBe('Cámara 3');
  });
});
