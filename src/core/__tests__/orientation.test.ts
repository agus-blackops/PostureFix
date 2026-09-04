import {
  angleBetweenDeg,
  averageVector,
  isTrustedSample,
  lowPass,
  magnitude,
  normalize,
} from '../orientation';

describe('orientation', () => {
  it('mide 0° entre un vector y sí mismo', () => {
    expect(angleBetweenDeg({ x: 0, y: -1, z: 0 }, { x: 0, y: -1, z: 0 })).toBeCloseTo(0, 5);
  });

  it('mide 90° entre ejes perpendiculares', () => {
    expect(angleBetweenDeg({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: -1 })).toBeCloseTo(90, 5);
  });

  it('ignora la escala del vector', () => {
    const angle = angleBetweenDeg({ x: 0, y: -1, z: 0 }, { x: 0, y: -0.5, z: -0.5 });
    expect(angle).toBeCloseTo(45, 5);
  });

  it('normaliza sin dividir por cero', () => {
    expect(normalize({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    expect(magnitude(normalize({ x: 3, y: 4, z: 0 }))).toBeCloseTo(1, 6);
  });

  it('el filtro converge hacia la lectura nueva', () => {
    let value = { x: 0, y: -1, z: 0 };
    const target = { x: 0, y: 0, z: -1 };
    for (let i = 0; i < 200; i++) {
      value = lowPass(value, target, 50, 300);
    }
    expect(angleBetweenDeg(value, target)).toBeLessThan(0.5);
  });

  it('la primera muestra pasa tal cual', () => {
    const sample = { x: 0.1, y: -0.9, z: 0.2 };
    expect(lowPass(null, sample, 50, 300)).toEqual(sample);
  });

  it('descarta lecturas con demasiada aceleración propia', () => {
    expect(isTrustedSample({ x: 0, y: -1, z: 0 }, 0.22)).toBe(true);
    expect(isTrustedSample({ x: 0, y: -1.8, z: 0 }, 0.22)).toBe(false);
  });

  it('promedia las muestras de calibración', () => {
    expect(averageVector([])).toBeNull();
    expect(averageVector([{ x: 0, y: -1, z: 0 }, { x: 0, y: -0.8, z: 0.2 }])).toEqual({
      x: 0,
      y: -0.9,
      z: 0.1,
    });
  });
});
