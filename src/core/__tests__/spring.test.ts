import { MOTION, cssSpring, isSettled, rnSpring, settleTime, springPosition, stepSpring } from '../spring';

describe('springPosition', () => {
  it('sale de 0 y acaba en 1', () => {
    for (const spec of Object.values(MOTION)) {
      expect(springPosition(spec, 0)).toBe(0);
      expect(springPosition(spec, 5)).toBeCloseTo(1, 4);
    }
  });

  it('los muelles espaciales rebotan y los de efectos no', () => {
    const peak = (spec: { dampingRatio: number; stiffness: number }) => {
      let max = 0;
      for (let t = 0; t < 2; t += 0.001) max = Math.max(max, springPosition(spec, t));
      return max;
    };
    expect(peak(MOTION.spatialFast)).toBeGreaterThan(1.05);
    expect(peak(MOTION.effectsDefault)).toBeLessThanOrEqual(1.0000001);
  });

  it('también resuelve muelles sobreamortiguados', () => {
    const spec = { dampingRatio: 1.5, stiffness: 400 };
    expect(springPosition(spec, 0.05)).toBeGreaterThan(0);
    expect(springPosition(spec, 3)).toBeCloseTo(1, 4);
  });
});

describe('settleTime', () => {
  it('los más rígidos llegan antes', () => {
    expect(settleTime(MOTION.effectsFast)).toBeLessThan(settleTime(MOTION.effectsSlow));
    expect(settleTime(MOTION.spatialFast)).toBeLessThan(settleTime(MOTION.spatialSlow));
  });

  it('da duraciones razonables para una interfaz', () => {
    for (const spec of Object.values(MOTION)) {
      const seconds = settleTime(spec);
      expect(seconds).toBeGreaterThan(0.05);
      expect(seconds).toBeLessThan(1.5);
    }
  });
});

describe('cssSpring', () => {
  it('genera una curva linear() que empieza en 0 y termina en 1', () => {
    const { easing, durationMs } = cssSpring(MOTION.spatialDefault, 10);
    expect(easing.startsWith('linear(0 0%, ')).toBe(true);
    expect(easing.endsWith('1 100%)')).toBe(true);
    expect(easing.split(',').length).toBe(11);
    expect(durationMs).toBeGreaterThan(100);
  });
});

describe('rnSpring', () => {
  it('traduce la razón de amortiguamiento a la constante de React Native', () => {
    expect(rnSpring({ dampingRatio: 1, stiffness: 400 })).toEqual({ stiffness: 400, damping: 40, mass: 1 });
  });
});

describe('stepSpring', () => {
  it('llega al destino y se para', () => {
    let state = { value: 0, velocity: 0 };
    for (let i = 0; i < 120; i++) state = stepSpring(state, 1, MOTION.spatialDefault, 1 / 60);
    expect(state.value).toBeCloseTo(1, 3);
    expect(isSettled(state, 1)).toBe(true);
  });

  it('sigue estable aunque un fotograma llegue muy tarde', () => {
    const state = stepSpring({ value: 0, velocity: 0 }, 1, MOTION.effectsFast, 5);
    expect(Number.isFinite(state.value)).toBe(true);
    expect(Math.abs(state.value)).toBeLessThan(2);
  });

  it('con tiempo cero no se mueve', () => {
    expect(stepSpring({ value: 0.3, velocity: 1 }, 1, MOTION.spatialFast, 0)).toEqual({ value: 0.3, velocity: 1 });
  });
});
