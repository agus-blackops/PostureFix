import {
  MAX_CALIBRATION_SPREAD_DEG,
  calibrateVectors,
  median,
  medianDistance,
  medianRecord,
  medianVector,
} from '../calibration';
import { angleBetweenDeg, type Vector3 } from '../orientation';

/** Vector de gravedad para un cuerpo inclinado `grados` hacia delante. */
function gravedad(grados: number): Vector3 {
  const rad = (grados * Math.PI) / 180;
  return { x: 0, y: -Math.cos(rad), z: -Math.sin(rad) };
}

describe('calibration', () => {
  it('calcula la mediana con listas pares e impares', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it('la mediana aguanta lo que la media no', () => {
    // Cuatro lecturas buenas y una disparatada.
    const conBasura = [10, 10, 10, 10, 1000];
    const media = conBasura.reduce((a, b) => a + b, 0) / conBasura.length;
    expect(median(conBasura)).toBe(10);
    expect(media).toBeGreaterThan(200);
  });

  it('calibra ignorando un respingo al final de la cuenta', () => {
    const quieto = Array.from({ length: 9 }, () => gravedad(0));
    const respingo = [gravedad(35), gravedad(40)];
    const calibracion = calibrateVectors([...quieto, ...respingo])!;

    // La referencia se queda en la postura buena, no a medio camino.
    expect(angleBetweenDeg(calibracion.baseline, gravedad(0))).toBeLessThan(1);
  });

  it('avisa cuando la persona no se estuvo quieta', () => {
    const quieta = calibrateVectors(Array.from({ length: 10 }, (_, i) => gravedad(i % 2)))!;
    expect(quieta.steady).toBe(true);
    expect(quieta.spreadDeg).toBeLessThan(MAX_CALIBRATION_SPREAD_DEG);

    const inquieta = calibrateVectors(Array.from({ length: 10 }, (_, i) => gravedad(i * 3)))!;
    expect(inquieta.steady).toBe(false);
    expect(inquieta.spreadDeg).toBeGreaterThan(MAX_CALIBRATION_SPREAD_DEG);
  });

  it('no calibra sin muestras', () => {
    expect(calibrateVectors([])).toBeNull();
    expect(medianVector([])).toBeNull();
    expect(medianRecord([], ['a'] as const)).toBeNull();
  });

  it('saca la mediana de cada medida de la webcam', () => {
    const muestras = [
      { ancho: 0.10, alto: 1.5 },
      { ancho: 0.11, alto: 1.4 },
      { ancho: 0.90, alto: 1.6 }, // fotograma malo
    ];
    expect(medianRecord(muestras, ['ancho', 'alto'] as const)).toEqual({ ancho: 0.11, alto: 1.5 });
  });

  it('mide la dispersión como mediana de distancias', () => {
    const centro = 10;
    expect(medianDistance([9, 10, 11], centro, (s, c) => Math.abs(s - c))).toBe(1);
    expect(medianDistance([], centro, (s, c) => Math.abs(s - c))).toBe(0);
  });
});
