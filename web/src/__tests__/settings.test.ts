import { DEFAULT_SETTINGS, LIMITS, sanitize } from '../settings';

describe('sanitize (ajustes de la versión webcam)', () => {
  it('sin nada guardado devuelve los valores por defecto', () => {
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('un volumen corrupto ya no llega como NaN al audio', () => {
    expect(sanitize({ volume: 'alto' }).volume).toBe(DEFAULT_SETTINGS.volume);
    expect(sanitize({ volume: 0 }).volume).toBe(0);
  });

  it('valida los sí/no y el modelo', () => {
    const result = sanitize({ headphones: 'yes', modelQuality: 'ultra' });
    expect(result.headphones).toBe(DEFAULT_SETTINGS.headphones);
    expect(result.modelQuality).toBe('full');
    expect(sanitize({ modelQuality: 'lite' }).modelQuality).toBe('lite');
  });

  it('redondea y recorta los fotogramas por segundo', () => {
    expect(sanitize({ fps: 12.7 }).fps).toBe(13);
    expect(sanitize({ fps: 400 }).fps).toBe(LIMITS.fps.max);
  });

  it('solo acepta una calibración completa', () => {
    const baseline = { shoulderWidth: 0.3, headLift: 0.5, shoulderY: 0.6, tiltDeg: 1 };
    expect(sanitize({ baseline }).baseline).toEqual(baseline);
    expect(sanitize({ baseline: { ...baseline, headLift: 'x' } }).baseline).toBeNull();
    expect(sanitize({ baseline: 'hola' }).baseline).toBeNull();
  });
});
