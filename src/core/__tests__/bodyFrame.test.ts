import { MIN_LEAN_DEG, buildFrame, sanitizeFrame, slouchDeg, tiltOf, type BodyFrame } from '../bodyFrame';
import type { Vector3 } from '../orientation';

const deg = (d: number) => (d * Math.PI) / 180;
/** Gravedad tras girar el móvil `a` grados alrededor del eje x (y hacia abajo de partida). */
const aroundX = (a: number): Vector3 => ({ x: 0, y: -Math.cos(deg(a)), z: Math.sin(deg(a)) });
/** Lo mismo alrededor del eje z. */
const aroundZ = (a: number): Vector3 => ({ x: Math.sin(deg(a)), y: -Math.cos(deg(a)), z: 0 });

function twoStep(): BodyFrame {
  const result = buildFrame(aroundX(0), aroundX(20));
  if (!('frame' in result)) throw new Error('debería calibrar');
  return result.frame;
}

describe('bodyFrame', () => {
  it('aprende hacia dónde es delante con el segundo paso', () => {
    const result = buildFrame(aroundX(0), aroundX(20));
    expect('frame' in result && result.frame.forward).toBeTruthy();
    expect(result.leanDeg).toBeCloseTo(20);
  });

  it('pide inclinarse más si el segundo paso apenas se movió', () => {
    expect(buildFrame(aroundX(0), aroundX(MIN_LEAN_DEG - 3))).toMatchObject({ error: 'lean-too-small' });
  });

  it('separa delante/atrás de lateral', () => {
    const frame = twoStep();
    const forward = tiltOf(frame, aroundX(25));
    expect(forward.pitchDeg).toBeCloseTo(25);
    expect(forward.rollDeg).toBeCloseTo(0);
    const back = tiltOf(frame, aroundX(-15));
    expect(back.pitchDeg).toBeCloseTo(-15);
    const side = tiltOf(frame, aroundZ(12));
    expect(Math.abs(side.rollDeg!)).toBeCloseTo(12);
    expect(side.pitchDeg).toBeCloseTo(0);
  });

  it('echarse hacia atrás no cuenta como encorvarse, salvo que se pida', () => {
    const frame = twoStep();
    expect(slouchDeg(tiltOf(frame, aroundX(-20)), true)).toBeCloseTo(0);
    expect(slouchDeg(tiltOf(frame, aroundX(-20)), false)).toBeCloseTo(20);
    expect(slouchDeg(tiltOf(frame, aroundX(30)), true)).toBeCloseTo(30);
  });

  it('con un solo paso usa el ángulo total, como la 1.x', () => {
    const result = buildFrame(aroundX(0));
    if (!('frame' in result)) throw new Error('debería calibrar');
    const tilt = tiltOf(result.frame, aroundX(-20));
    expect(tilt.pitchDeg).toBeNull();
    expect(slouchDeg(tilt, true)).toBeCloseTo(20);
  });

  it('valida los ejes leídos de disco', () => {
    expect(sanitizeFrame(null)).toBeNull();
    expect(sanitizeFrame({ up: { x: 0, y: 0, z: 0 } })).toBeNull();
    expect(sanitizeFrame({ up: { x: 0, y: -2, z: 0 } })).toEqual({ up: { x: 0, y: -1, z: 0 }, forward: null });
    // Un «delante» que no es perpendicular a «arriba» se descarta.
    expect(sanitizeFrame({ up: { x: 0, y: -1, z: 0 }, forward: { x: 0, y: -1, z: 0 } })?.forward).toBeNull();
    expect(sanitizeFrame(twoStep())?.forward).not.toBeNull();
  });
});
