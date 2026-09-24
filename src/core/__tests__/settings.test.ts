jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { DEFAULT_SETTINGS, LIMITS, sanitize } from '../settings';

describe('sanitize (ajustes del móvil)', () => {
  it('sin nada guardado devuelve los valores por defecto', () => {
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitize(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('conserva los valores válidos', () => {
    const stored = { ...DEFAULT_SETTINGS, thresholdDeg: 30, voiceEnabled: false, baseline: { x: 0, y: -1, z: 0 } };
    expect(sanitize(stored)).toEqual(stored);
  });

  it('un sí/no guardado como texto no se toma por verdadero', () => {
    const result = sanitize({ controlMode: 'true', voiceEnabled: 'false' });
    expect(result.controlMode).toBe(DEFAULT_SETTINGS.controlMode);
    expect(result.voiceEnabled).toBe(DEFAULT_SETTINGS.voiceEnabled);
  });

  it('los números corruptos vuelven a su valor por defecto', () => {
    const result = sanitize({ volume: 'mucho', thresholdDeg: null, graceSeconds: {} });
    expect(result.volume).toBe(DEFAULT_SETTINGS.volume);
    expect(result.thresholdDeg).toBe(DEFAULT_SETTINGS.thresholdDeg);
    expect(result.graceSeconds).toBe(DEFAULT_SETTINGS.graceSeconds);
  });

  it('recorta los valores fuera de rango', () => {
    const result = sanitize({ thresholdDeg: 500, volume: 0 });
    expect(result.thresholdDeg).toBe(LIMITS.thresholdDeg.max);
    expect(result.volume).toBe(LIMITS.volume.min);
  });

  it('descarta una calibración a medias', () => {
    expect(sanitize({ baseline: { x: 0, y: Number.NaN, z: 1 } }).baseline).toBeNull();
    expect(sanitize({ baseline: { x: 0, y: 1 } }).baseline).toBeNull();
  });

  it('no arrastra claves desconocidas', () => {
    expect(Object.keys(sanitize({ ...DEFAULT_SETTINGS, basura: 1 } as never)).sort()).toEqual(
      Object.keys(DEFAULT_SETTINGS).sort()
    );
  });
});
