import {
  DEFAULT_ONE_EURO,
  createOneEuro,
  createOneEuroBank,
  createSmoother,
  createSmootherBank,
  oneEuroBankStep,
  oneEuroStep,
  smoothBankStep,
  smoothStep,
  type OneEuroState,
  type SmootherState,
} from '../oneEuro';

const DT = 50;

/** Pasa una serie por el filtro y devuelve la salida. */
function run(samples: number[], config = DEFAULT_ONE_EURO): number[] {
  let state: OneEuroState = createOneEuro();
  return samples.map((sample) => {
    const stepped = oneEuroStep(state, sample, DT, config);
    state = stepped.state;
    return stepped.value;
  });
}

/** Ruido reproducible, para que el test no dependa del azar. */
function pseudoNoise(index: number): number {
  return Math.sin(index * 12.9898) * 43758.5453 - Math.floor(Math.sin(index * 12.9898) * 43758.5453) - 0.5;
}

describe('oneEuro', () => {
  it('arranca en la primera muestra, sin inventarse un valor', () => {
    const { value, state } = oneEuroStep(createOneEuro(), 12.5, DT);
    expect(value).toBe(12.5);
    expect(state.value).toBe(12.5);
  });

  it('quita ruido de una señal quieta', () => {
    const ruidosa = Array.from({ length: 120 }, (_, i) => 20 + pseudoNoise(i) * 4);
    const filtrada = run(ruidosa);

    const dispersion = (serie: number[]) => {
      const media = serie.reduce((a, b) => a + b, 0) / serie.length;
      return Math.sqrt(serie.reduce((a, b) => a + (b - media) ** 2, 0) / serie.length);
    };

    // Se compara la segunda mitad, ya asentado el filtro.
    expect(dispersion(filtrada.slice(60))).toBeLessThan(dispersion(ruidosa.slice(60)) / 2.5);
  });

  it('sigue un cambio real sin quedarse atrás', () => {
    // Escalón de 0 a 40°, como quien se encorva de golpe.
    const escalon = [...Array(40).fill(0), ...Array(40).fill(40)];
    const filtrada = run(escalon);
    // Un segundo después del escalón ya ha alcanzado casi todo el recorrido.
    expect(filtrada[60]).toBeGreaterThan(38);
  });

  it('responde más rápido que un paso bajo fijo equivalente en reposo', () => {
    const escalon = [...Array(40).fill(0), ...Array(40).fill(40)];
    const conAdaptacion = run(escalon, DEFAULT_ONE_EURO);
    const sinAdaptacion = run(escalon, { ...DEFAULT_ONE_EURO, beta: 0 });

    // A los 200 ms del escalón, el que se adapta ya va por delante.
    expect(conAdaptacion[44]).toBeGreaterThan(sinAdaptacion[44]);
  });

  it('no se rompe con intervalos raros', () => {
    let state = createOneEuro();
    for (const dt of [0, -5, 1, 5000]) {
      const stepped = oneEuroStep(state, 10, dt);
      expect(Number.isFinite(stepped.value)).toBe(true);
      state = stepped.state;
    }
  });

  describe('suavizado completo: mediana + filtro adaptativo', () => {
    /** Pasa una serie por el suavizado completo. */
    function suavizar(samples: number[]): number[] {
      let state: SmootherState = createSmoother();
      return samples.map((sample) => {
        const stepped = smoothStep(state, sample, DT);
        state = stepped.state;
        return stepped.value;
      });
    }

    it('ignora por completo una lectura suelta disparatada', () => {
      // Un fotograma en el que el detector se inventa el hombro.
      const conPico = Array.from({ length: 60 }, (_, i) => (i === 30 ? 60 : 20));
      const suavizada = suavizar(conPico);
      expect(Math.max(...suavizada)).toBeCloseTo(20, 6);
    });

    it('pero deja pasar un cambio sostenido', () => {
      const escalon = [...Array(40).fill(0), ...Array(40).fill(40)];
      const suavizada = suavizar(escalon);
      // A los 200 ms ya casi ha llegado; el paso bajo de la 1.0.1 iba por 22,6.
      expect(suavizada[44]).toBeGreaterThan(35);
    });

    it('arranca en la primera muestra', () => {
      expect(smoothStep(createSmoother(), 7, DT).value).toBe(7);
    });

    it('suaviza un juego de medidas componente a componente', () => {
      let bank = createSmootherBank(['ancho', 'alto'] as const);
      let salida = { ancho: 0, alto: 0 };
      for (let i = 0; i < 60; i++) {
        // La componente "alto" trae un pico aislado a mitad de camino.
        const stepped = smoothBankStep(bank, { ancho: 2, alto: i === 30 ? 99 : 5 }, DT);
        bank = stepped.bank;
        salida = stepped.value;
      }
      expect(salida.ancho).toBeCloseTo(2, 3);
      expect(salida.alto).toBeCloseTo(5, 3);
    });
  });

  it('filtra cada componente de un vector por separado', () => {
    let bank = createOneEuroBank(['x', 'y', 'z'] as const);
    let salida = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 60; i++) {
      const stepped = oneEuroBankStep(bank, { x: 1, y: -1, z: 0.5 }, DT);
      bank = stepped.bank;
      salida = stepped.value;
    }
    expect(salida.x).toBeCloseTo(1, 3);
    expect(salida.y).toBeCloseTo(-1, 3);
    expect(salida.z).toBeCloseTo(0.5, 3);
  });
});
