/**
 * Detección de «me han movido el sensor».
 *
 * Es la causa número uno de alarmas falsas: el móvil se desliza en el bolsillo
 * al levantarse, o alguien mueve el portátil, y de golpe la referencia guardada
 * al calibrar ya no describe tu espalda sino la posición vieja del aparato. La
 * app se pondría a avisar de una mala postura que no existe.
 *
 * La pista es la secuencia: un tramo de lecturas no fiables (el meneo) y, justo
 * después, un ángulo que ha dado un salto grande. Encorvarse no se parece a
 * eso: es un cambio progresivo, con el sensor quieto y las lecturas fiables.
 *
 * Módulo puro; el estado se pasa y se devuelve.
 */
export interface RepositionConfig {
  /** Meneo mínimo (tiempo con lecturas no fiables) para sospechar. */
  disturbanceMs: number;
  /** Salto de ángulo tras el meneo que delata la recolocación. */
  jumpDeg: number;
  /**
   * Cuánto se sigue vigilando tras el meneo. El salto no se ve en la primera
   * lectura buena: el suavizado tarda unas décimas en ponerse al día, y juzgar
   * antes de eso es no ver nada.
   */
  watchMs: number;
}

export const DEFAULT_REPOSITION: RepositionConfig = {
  disturbanceMs: 400,
  jumpDeg: 25,
  watchMs: 2000,
};

export interface RepositionState {
  /** Última desviación fiable antes del meneo. */
  before: number | null;
  /** Tiempo acumulado del meneo en curso. */
  disturbanceMs: number;
  /** Lo que queda de la ventana en la que aún se juzga el salto. */
  watchMs: number;
  /** `true` mientras convenga recalibrar. */
  suspected: boolean;
}

export interface RepositionInput {
  deviationDeg: number;
  trusted: boolean;
  dtMs: number;
}

export const createReposition = (): RepositionState => ({
  before: null,
  disturbanceMs: 0,
  watchMs: 0,
  suspected: false,
});

/** Se llama al recalibrar o cuando el usuario descarta el aviso. */
export const clearReposition = (state: RepositionState): RepositionState => ({
  ...state,
  watchMs: 0,
  suspected: false,
});

export function repositionStep(
  state: RepositionState,
  input: RepositionInput,
  config: RepositionConfig = DEFAULT_REPOSITION
): RepositionState {
  const dtMs = Math.max(0, input.dtMs);

  if (!input.trusted) {
    return { ...state, disturbanceMs: state.disturbanceMs + dtMs };
  }

  // Al volver una lectura fiable tras un meneo largo se abre la ventana; si el
  // meneo fue corto, sólo se va agotando la ventana que hubiera abierta.
  const watchMs =
    state.disturbanceMs >= config.disturbanceMs
      ? config.watchMs
      : Math.max(0, state.watchMs - dtMs);
  const watching = watchMs > 0;

  const salto = state.before != null ? Math.abs(input.deviationDeg - state.before) : 0;
  const suspected = state.suspected || (watching && state.before != null && salto >= config.jumpDeg);

  return {
    // Mientras se vigila se conserva la referencia previa al meneo.
    before: watching && !suspected ? state.before : input.deviationDeg,
    disturbanceMs: 0,
    watchMs: suspected ? 0 : watchMs,
    suspected,
  };
}
