import { LOADING_SEQUENCE, SHAPES, morphPath, shapePath, shapeRadius, wavyArcPath } from '../shapes';

const points = (path: string) =>
  [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));

describe('shapeRadius', () => {
  it('el círculo tiene radio 1 en todas direcciones', () => {
    for (let a = 0; a < 7; a += 0.5) expect(shapeRadius(SHAPES.circle, a)).toBe(1);
  });

  it('los lóbulos nunca pasan del radio máximo', () => {
    for (const shape of Object.values(SHAPES)) {
      for (let a = 0; a < 7; a += 0.01) {
        const r = shapeRadius(shape, a);
        expect(r).toBeLessThanOrEqual(1 + 1e-9);
        expect(r).toBeGreaterThan(0.5);
      }
    }
  });
});

describe('morphPath', () => {
  it('es un contorno cerrado con los puntos pedidos', () => {
    const path = morphPath(SHAPES.circle, SHAPES.burst12, 0.5, 50, 50, 40, 0, 36);
    expect(path.endsWith('Z')).toBe(true);
    expect(points(path)).toHaveLength(36);
  });

  it('en los extremos coincide con cada forma', () => {
    expect(morphPath(SHAPES.cookie6, SHAPES.burst12, 0, 50, 50, 40, 0, 120)).toBe(shapePath(SHAPES.cookie6, 50, 50, 40, 0, 120));
    expect(morphPath(SHAPES.cookie6, SHAPES.burst12, 1, 50, 50, 40, 0, 120)).toBe(shapePath(SHAPES.burst12, 50, 50, 40, 0, 120));
  });

  it('el círculo queda a la distancia del radio', () => {
    for (const { x, y } of points(shapePath(SHAPES.circle, 50, 50, 40))) {
      expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(40, 1);
    }
  });

  it('al rebotar se pasa un poco, pero no más de un 10 % del radio', () => {
    let maxDistance = 0;
    for (const from of Object.values(SHAPES)) {
      for (const to of Object.values(SHAPES)) {
        for (const { x, y } of points(morphPath(from, to, 5, 0, 0, 100))) {
          maxDistance = Math.max(maxDistance, Math.hypot(x, y));
        }
      }
    }
    expect(maxDistance).toBeGreaterThan(100);
    expect(maxDistance).toBeLessThanOrEqual(110);
  });

  it('las puntas de las formas con muchos lóbulos llevan puntos de sobra', () => {
    expect(points(shapePath(SHAPES.burst12, 0, 0, 100)).length).toBeGreaterThanOrEqual(12 * 16);
  });

  it('la secuencia de carga solo usa formas conocidas', () => {
    for (const name of LOADING_SEQUENCE) expect(SHAPES[name]).toBeDefined();
  });
});

describe('wavyArcPath', () => {
  const base = { cx: 100, cy: 100, radius: 80, amplitude: 0, wavelength: 30, phase: 0 };

  it('sin progreso no dibuja nada', () => {
    expect(wavyArcPath({ ...base, progress: 0 })).toBe('');
  });

  it('empieza arriba del todo', () => {
    const [first] = points(wavyArcPath({ ...base, progress: 0.25, amplitude: 6 }));
    expect(first.x).toBeCloseTo(100, 1);
    expect(first.y).toBeCloseTo(20, 1);
  });

  it('sin amplitud es un arco liso sobre el radio', () => {
    for (const { x, y } of points(wavyArcPath({ ...base, progress: 0.6 }))) {
      expect(Math.hypot(x - 100, y - 100)).toBeCloseTo(80, 1);
    }
  });

  it('con amplitud se sale del radio, pero no más que la amplitud', () => {
    const distances = points(wavyArcPath({ ...base, progress: 0.8, amplitude: 5 })).map(({ x, y }) =>
      Math.hypot(x - 100, y - 100)
    );
    expect(Math.max(...distances)).toBeGreaterThan(83);
    expect(Math.max(...distances)).toBeLessThanOrEqual(85.1);
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(74.9);
  });

  it('los extremos caen sobre la pista aunque haya onda', () => {
    const list = points(wavyArcPath({ ...base, progress: 0.5, amplitude: 6, phase: 1.3 }));
    for (const { x, y } of [list[0], list[list.length - 1]]) {
      expect(Math.hypot(x - 100, y - 100)).toBeCloseTo(80, 1);
    }
  });

  it('recorta el progreso a una vuelta', () => {
    const full = points(wavyArcPath({ ...base, progress: 1.7 }));
    const last = full[full.length - 1];
    expect(last.x).toBeCloseTo(100, 1);
    expect(last.y).toBeCloseTo(20, 1);
  });
});
