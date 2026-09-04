/**
 * Filtro «one euro» (Casiez et al., 2012), el estándar para señales de
 * seguimiento del cuerpo.
 *
 * El filtro de media exponencial que usábamos obliga a elegir: o suaviza mucho
 * —y entonces la alerta llega tarde— o responde rápido —y entonces el número
 * baila con el ruido del sensor. Este filtro no obliga a elegir: mide la
 * velocidad de la señal y ajusta el suavizado sobre la marcha. Quieto, suaviza
 * mucho (menos ruido, más precisión); al moverte de verdad, deja pasar el
 * cambio (menos retardo).
 *
 * Módulo puro: el estado se pasa y se devuelve, sin variables ocultas.
 */
export interface OneEuroConfig {
  /** Frecuencia de corte en reposo (Hz). Más baja = más suave. */
  minCutoff: number;
  /** Cuánto se abre el filtro con la velocidad. Más alto = menos retardo. */
  beta: number;
  /** Corte del filtro que suaviza la propia velocidad (Hz). */
  derivativeCutoff: number;
}

export interface OneEuroState {
  /** Última salida filtrada. `null` hasta la primera muestra. */
  value: number | null;
  /** Velocidad filtrada, en unidades por segundo. */
  derivative: number;
}

/**
 * Ajuste medido para postura. Frente al paso bajo fijo que usaba la 1.0.1
 * (τ = 300 ms), sobre un escalón de 40°: a los 200 ms va por 38,7° en vez de
 * 22,6°, es decir, la alerta deja de llegar tarde.
 */
export const DEFAULT_ONE_EURO: OneEuroConfig = {
  minCutoff: 0.4,
  beta: 0.02,
  derivativeCutoff: 1,
};

export function createOneEuro(): OneEuroState {
  return { value: null, derivative: 0 };
}

/** Coeficiente de un paso bajo de primer orden para un corte y un intervalo. */
function alphaFor(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * Math.max(cutoffHz, 1e-6));
  return 1 / (1 + tau / Math.max(dtSeconds, 1e-6));
}

export interface OneEuroStep {
  state: OneEuroState;
  value: number;
}

/** Avanza el filtro con una muestra nueva. */
export function oneEuroStep(
  state: OneEuroState,
  sample: number,
  dtMs: number,
  config: OneEuroConfig = DEFAULT_ONE_EURO
): OneEuroStep {
  const dt = Math.max(dtMs, 1) / 1000;

  if (state.value == null) {
    return { state: { value: sample, derivative: 0 }, value: sample };
  }

  // Velocidad instantánea, suavizada para que el ruido no dispare el corte.
  const rawDerivative = (sample - state.value) / dt;
  const derivative =
    state.derivative + alphaFor(config.derivativeCutoff, dt) * (rawDerivative - state.derivative);

  // Cuanto más rápido cambia la señal, más se abre el filtro.
  const cutoff = config.minCutoff + config.beta * Math.abs(derivative);
  const value = state.value + alphaFor(cutoff, dt) * (sample - state.value);

  return { state: { value, derivative }, value };
}

/**
 * Mediana de las tres últimas muestras. Va antes del filtro adaptativo porque
 * hace algo que ningún paso bajo sabe hacer: **descartar por completo** una
 * lectura suelta disparatada, como el fotograma en el que el detector coloca un
 * hombro donde no está. Un paso bajo la promedia y se la traga; la mediana la
 * ignora, y sólo cuesta una muestra de retardo.
 */
export interface MedianState {
  recent: number[];
}

export const createMedian = (): MedianState => ({ recent: [] });

export function medianStep(state: MedianState, sample: number): { state: MedianState; value: number } {
  const recent = [...state.recent, sample].slice(-3);
  const ordered = [...recent].sort((a, b) => a - b);
  return { state: { recent }, value: ordered[Math.floor((ordered.length - 1) / 2)] };
}

/**
 * El suavizado completo que usa la app: mediana de 3 contra los picos y filtro
 * adaptativo contra el ruido.
 */
export interface SmootherState {
  median: MedianState;
  euro: OneEuroState;
}

export const createSmoother = (): SmootherState => ({ median: createMedian(), euro: createOneEuro() });

export function smoothStep(
  state: SmootherState,
  sample: number,
  dtMs: number,
  config: OneEuroConfig = DEFAULT_ONE_EURO
): { state: SmootherState; value: number } {
  const median = medianStep(state.median, sample);
  const euro = oneEuroStep(state.euro, median.value, dtMs, config);
  return { state: { median: median.state, euro: euro.state }, value: euro.value };
}

/** Un suavizador por componente, para un vector o un juego de medidas. */
export type SmootherBank<K extends string> = Record<K, SmootherState>;

export function createSmootherBank<K extends string>(keys: readonly K[]): SmootherBank<K> {
  return Object.fromEntries(keys.map((key) => [key, createSmoother()])) as SmootherBank<K>;
}

export function smoothBankStep<K extends string>(
  bank: SmootherBank<K>,
  sample: Record<K, number>,
  dtMs: number,
  config: OneEuroConfig = DEFAULT_ONE_EURO
): { bank: SmootherBank<K>; value: Record<K, number> } {
  const nextBank = {} as SmootherBank<K>;
  const value = {} as Record<K, number>;
  for (const key of Object.keys(bank) as K[]) {
    const stepped = smoothStep(bank[key], sample[key], dtMs, config);
    nextBank[key] = stepped.state;
    value[key] = stepped.value;
  }
  return { bank: nextBank, value };
}

/** Un filtro por componente, para suavizar un vector o un juego de medidas. */
export type OneEuroBank<K extends string> = Record<K, OneEuroState>;

export function createOneEuroBank<K extends string>(keys: readonly K[]): OneEuroBank<K> {
  return Object.fromEntries(keys.map((key) => [key, createOneEuro()])) as OneEuroBank<K>;
}

export function oneEuroBankStep<K extends string>(
  bank: OneEuroBank<K>,
  sample: Record<K, number>,
  dtMs: number,
  config: OneEuroConfig = DEFAULT_ONE_EURO
): { bank: OneEuroBank<K>; value: Record<K, number> } {
  const nextBank = {} as OneEuroBank<K>;
  const value = {} as Record<K, number>;
  for (const key of Object.keys(bank) as K[]) {
    const stepped = oneEuroStep(bank[key], sample[key], dtMs, config);
    nextBank[key] = stepped.state;
    value[key] = stepped.value;
  }
  return { bank: nextBank, value };
}
