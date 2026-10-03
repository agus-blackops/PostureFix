jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { DEFAULT_PROFILES } from '../profiles';
import { DEFAULT_SETTINGS, LIMITS, activeProfileOf, migrateV1, sanitize, withProfile } from '../settings';

describe('sanitize (ajustes del móvil, v2)', () => {
  it('sin nada guardado devuelve los valores por defecto', () => {
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitize(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('conserva los valores válidos', () => {
    const stored = withProfile({ ...DEFAULT_SETTINGS, theme: 'light' as const, standReminder: true }, 'clase', { thresholdDeg: 30 });
    expect(sanitize(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it('un sí/no guardado como texto no se toma por verdadero', () => {
    const result = sanitize({ controlMode: 'true', voiceEnabled: 'false' });
    expect(result.controlMode).toBe(DEFAULT_SETTINGS.controlMode);
    expect(result.voiceEnabled).toBe(DEFAULT_SETTINGS.voiceEnabled);
  });

  it('recorta los números y descarta opciones desconocidas', () => {
    const result = sanitize({
      volume: 0,
      standEveryMinutes: 1000,
      theme: 'neón',
      activeProfile: 'tumbado',
      profiles: { sentado: { thresholdDeg: 500, maxAlertLevel: 'sirena' } },
    } as never);
    expect(result.volume).toBe(LIMITS.volume.min);
    expect(result.standEveryMinutes).toBe(LIMITS.standEveryMinutes.max);
    expect(result.theme).toBe('system');
    expect(result.activeProfile).toBe('sentado');
    expect(result.profiles.sentado.thresholdDeg).toBe(55);
    expect(result.profiles.sentado.maxAlertLevel).toBe(DEFAULT_PROFILES.sentado.maxAlertLevel);
  });

  it('no arrastra claves desconocidas', () => {
    expect(Object.keys(sanitize({ ...DEFAULT_SETTINGS, basura: 1 } as never)).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });

  it('cada perfil guarda lo suyo', () => {
    const settings = withProfile({ ...DEFAULT_SETTINGS, activeProfile: 'de-pie' }, 'de-pie', { graceSeconds: 8 });
    expect(activeProfileOf(settings).graceSeconds).toBe(8);
    expect(settings.profiles.sentado.graceSeconds).toBe(DEFAULT_PROFILES.sentado.graceSeconds);
  });
});

describe('migrateV1', () => {
  it('pasa la calibración y los límites de la 1.x al perfil «Sentado»', () => {
    const migrated = migrateV1({
      baseline: { x: 0, y: -0.98, z: 0.1 },
      thresholdDeg: 28,
      graceSeconds: 6,
      maxAlertLevel: 'count',
      volume: 0.6,
      controlMode: true,
    });
    expect(migrated.activeProfile).toBe('sentado');
    expect(migrated.profiles.sentado).toMatchObject({ thresholdDeg: 28, graceSeconds: 6, maxAlertLevel: 'count' });
    expect(migrated.profiles.sentado.frame?.forward).toBeNull();
    expect(migrated.profiles.sentado.frame?.up.y).toBeLessThan(-0.9);
    expect(migrated).toMatchObject({ volume: 0.6, controlMode: true });
    expect(migrated.profiles['de-pie']).toEqual(DEFAULT_PROFILES['de-pie']);
  });

  it('una 1.x sin calibrar deja el perfil sin calibrar', () => {
    expect(migrateV1({ baseline: null }).profiles.sentado.frame).toBeNull();
    expect(migrateV1(null)).toEqual(DEFAULT_SETTINGS);
  });
});
