import { STANDARD_GRAVITY, isMoving, isTrustedReading, readingFromAccelerometer, readingFromDeviceMotion } from '../motion';

const g = STANDARD_GRAVITY;

describe('motion', () => {
  it('separa la gravedad del movimiento con la fusión de sensores', () => {
    // Caminando: la aceleración total lleva 0,3 g de empujón, la gravedad no.
    const reading = readingFromDeviceMotion({
      accelerationIncludingGravity: { x: 0.3 * g, y: -1 * g, z: 0 },
      acceleration: { x: 0.3 * g, y: 0, z: 0 },
    });
    expect(reading?.fused).toBe(true);
    expect(reading?.gravity.x).toBeCloseTo(0);
    expect(reading?.gravity.y).toBeCloseTo(-1);
    expect(reading?.userAccelG).toBeCloseTo(0.3);
    expect(isTrustedReading(reading!)).toBe(true);
    expect(isMoving(reading!)).toBe(true);
  });

  it('un golpe fuerte no es de fiar ni siquiera fusionado', () => {
    const reading = readingFromDeviceMotion({
      accelerationIncludingGravity: { x: 0.9 * g, y: -1 * g, z: 0 },
      acceleration: { x: 0.9 * g, y: 0, z: 0 },
    });
    expect(isTrustedReading(reading!)).toBe(false);
  });

  it('sin giroscopio cae al criterio de la 1.x', () => {
    const reading = readingFromDeviceMotion({ accelerationIncludingGravity: { x: 0, y: -1.3 * g, z: 0 }, acceleration: null });
    expect(reading).toMatchObject({ fused: false, userAccelG: null });
    expect(isTrustedReading(reading!)).toBe(false);
    expect(isTrustedReading(readingFromAccelerometer({ x: 0, y: -1.05, z: 0 }))).toBe(true);
  });

  it('descarta lecturas incompletas o absurdas', () => {
    expect(readingFromDeviceMotion({ acceleration: { x: 0, y: 0, z: 0 } })).toBeNull();
    expect(readingFromDeviceMotion({ accelerationIncludingGravity: { x: Number.NaN, y: 0, z: 0 } })).toBeNull();
    expect(
      readingFromDeviceMotion({ accelerationIncludingGravity: { x: 1, y: 0, z: 0 }, acceleration: { x: 1, y: 0, z: 0 } })
    ).toBeNull();
  });
});
