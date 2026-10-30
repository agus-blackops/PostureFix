import {
  DEFAULT_REPOSITION,
  clearReposition,
  createReposition,
  repositionStep,
  type RepositionState,
} from '../reposition';

const TICK = 50;

/** Reproduce una tanda de lecturas. */
function reproducir(
  state: RepositionState,
  lecturas: { deviationDeg: number; trusted?: boolean; veces?: number }[]
): RepositionState {
  let actual = state;
  for (const { deviationDeg, trusted = true, veces = 1 } of lecturas) {
    for (let i = 0; i < veces; i++) {
      actual = repositionStep(actual, { deviationDeg, trusted, dtMs: TICK });
    }
  }
  return actual;
}

describe('reposition', () => {
  it('no sospecha de una postura estable', () => {
    const final = reproducir(createReposition(), [{ deviationDeg: 5, veces: 40 }]);
    expect(final.suspected).toBe(false);
  });

  it('no confunde encorvarse despacio con mover el sensor', () => {
    // Un encorvamiento progresivo, con el sensor quieto: lecturas fiables.
    const lecturas = Array.from({ length: 30 }, (_, i) => ({ deviationDeg: i * 1.5 }));
    expect(reproducir(createReposition(), lecturas).suspected).toBe(false);
  });

  it('tampoco sospecha si el usuario camina y vuelve a su postura', () => {
    const final = reproducir(createReposition(), [
      { deviationDeg: 6, veces: 10 },
      { deviationDeg: 40, trusted: false, veces: 20 }, // caminando: no fiable
      { deviationDeg: 8, veces: 10 }, // vuelve a sentarse igual
    ]);
    expect(final.suspected).toBe(false);
  });

  it('sospecha cuando tras el meneo el ángulo ha dado un salto', () => {
    const final = reproducir(createReposition(), [
      { deviationDeg: 5, veces: 10 },
      { deviationDeg: 50, trusted: false, veces: 20 }, // el móvil se desliza
      { deviationDeg: 38, veces: 5 }, // y ahora mide 38° con la espalda recta
    ]);
    expect(final.suspected).toBe(true);
  });

  it('ve el salto aunque el suavizado tarde en ponerse al día', () => {
    // El caso real: al volver la lectura buena, el valor filtrado todavía viene
    // del sitio anterior y sólo alcanza el nuevo unas décimas después.
    const final = reproducir(createReposition(), [
      { deviationDeg: 5, veces: 10 },
      { deviationDeg: 5, trusted: false, veces: 20 },
      { deviationDeg: 8, veces: 3 }, // el filtro aún no ha llegado
      { deviationDeg: 20, veces: 3 },
      { deviationDeg: 45, veces: 3 }, // y aquí ya se ve el salto
    ]);
    expect(final.suspected).toBe(true);
  });

  it('pero deja de vigilar pasada la ventana', () => {
    const final = reproducir(createReposition(), [
      { deviationDeg: 5, veces: 10 },
      { deviationDeg: 5, trusted: false, veces: 20 },
      { deviationDeg: 5, veces: 60 }, // 3 s con la misma postura: ventana agotada
      { deviationDeg: 45, veces: 5 }, // esto ya es encorvarse, no recolocar
    ]);
    expect(final.suspected).toBe(false);
  });

  it('un tirón muy corto no basta para sospechar', () => {
    const final = reproducir(createReposition(), [
      { deviationDeg: 5, veces: 10 },
      { deviationDeg: 50, trusted: false, veces: 2 }, // 100 ms, menos del mínimo
      { deviationDeg: 40, veces: 5 },
    ]);
    expect(final.suspected).toBe(false);
  });

  it('la sospecha se mantiene hasta que se recalibra', () => {
    let state = reproducir(createReposition(), [
      { deviationDeg: 5, veces: 10 },
      { deviationDeg: 50, trusted: false, veces: 20 },
      { deviationDeg: 40, veces: 5 },
    ]);
    expect(state.suspected).toBe(true);

    state = reproducir(state, [{ deviationDeg: 40, veces: 20 }]);
    expect(state.suspected).toBe(true);

    expect(clearReposition(state).suspected).toBe(false);
  });

  it('respeta los umbrales que se le pasen', () => {
    const exigente = { ...DEFAULT_REPOSITION, jumpDeg: 60 };
    let state = createReposition();
    for (const lectura of [
      { deviationDeg: 5, trusted: true },
      { deviationDeg: 5, trusted: false },
      { deviationDeg: 5, trusted: false },
      { deviationDeg: 5, trusted: false },
      { deviationDeg: 5, trusted: false },
      { deviationDeg: 5, trusted: false },
      { deviationDeg: 5, trusted: false },
      { deviationDeg: 5, trusted: false },
      { deviationDeg: 5, trusted: false },
      { deviationDeg: 5, trusted: false },
      { deviationDeg: 40, trusted: true }, // salto de 35°, por debajo de 60
    ]) {
      state = repositionStep(state, { ...lectura, dtMs: TICK }, exigente);
    }
    expect(state.suspected).toBe(false);
  });
});
