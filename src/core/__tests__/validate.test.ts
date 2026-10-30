import { readBoolean, readChoice, readNumber } from '../validate';

describe('readNumber', () => {
  it('acepta números y cadenas numéricas dentro del rango', () => {
    expect(readNumber(12, 5, 0, 20)).toBe(12);
    expect(readNumber('12.5', 5, 0, 20)).toBe(12.5);
  });

  it('recorta a los límites', () => {
    expect(readNumber(99, 5, 0, 20)).toBe(20);
    expect(readNumber(-3, 5, 0, 20)).toBe(0);
  });

  it('respeta el cero como valor válido', () => {
    expect(readNumber(0, 1, 0, 1)).toBe(0);
  });

  it('vuelve al valor por defecto con basura', () => {
    expect(readNumber('abc', 5, 0, 20)).toBe(5);
    expect(readNumber(null, 5, 0, 20)).toBe(5);
    expect(readNumber(undefined, 5, 0, 20)).toBe(5);
    expect(readNumber(Number.NaN, 5, 0, 20)).toBe(5);
    expect(readNumber({}, 5, 0, 20)).toBe(5);
  });
});

describe('readBoolean', () => {
  it('solo acepta booleanos de verdad', () => {
    expect(readBoolean(false, true)).toBe(false);
    expect(readBoolean(true, false)).toBe(true);
    expect(readBoolean('false', true)).toBe(true);
    expect(readBoolean(1, false)).toBe(false);
    expect(readBoolean(null, true)).toBe(true);
  });
});

describe('readChoice', () => {
  it('se queda con los valores permitidos', () => {
    expect(readChoice('lite', ['full', 'lite'] as const, 'full')).toBe('lite');
    expect(readChoice('ultra', ['full', 'lite'] as const, 'full')).toBe('full');
    expect(readChoice(undefined, ['full', 'lite'] as const, 'full')).toBe('full');
  });
});
