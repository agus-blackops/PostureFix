import {
  MAX_SESSIONS,
  MIN_SESSION_MS,
  addSession,
  compareModes,
  sanitizeHistory,
  summarize,
  toCsv,
  type SessionRecord,
} from '../sessionLog';

const minutes = (n: number) => n * 60_000;

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    startedAt: Date.UTC(2026, 8, 3, 10, 0, 0),
    durationMs: minutes(20),
    badMs: minutes(4),
    alerts: 2,
    source: 'webcam',
    alertsEnabled: true,
    ...overrides,
  };
}

describe('sessionLog', () => {
  it('descarta las sesiones demasiado cortas para decir nada', () => {
    const corta = session({ durationMs: MIN_SESSION_MS - 1 });
    expect(addSession([], corta)).toHaveLength(0);
    expect(addSession([], session({ durationMs: MIN_SESSION_MS }))).toHaveLength(1);
  });

  it('guarda la más reciente primero', () => {
    const vieja = session({ startedAt: 1000 });
    const nueva = session({ startedAt: 5000 });
    expect(addSession([vieja], nueva).map((s) => s.startedAt)).toEqual([5000, 1000]);
  });

  it('no crece sin límite', () => {
    let history: SessionRecord[] = [];
    for (let i = 0; i < MAX_SESSIONS + 25; i++) {
      history = addSession(history, session({ startedAt: 1000 + i }));
    }
    expect(history).toHaveLength(MAX_SESSIONS);
    // Se conservan las más recientes.
    expect(history[0].startedAt).toBe(1000 + MAX_SESSIONS + 24);
  });

  it('resume el conjunto de sesiones', () => {
    const resumen = summarize([
      session({ durationMs: minutes(10), badMs: minutes(5), alerts: 3 }),
      session({ durationMs: minutes(30), badMs: minutes(5), alerts: 1 }),
    ]);
    expect(resumen.sessions).toBe(2);
    expect(resumen.badRatio).toBeCloseTo(10 / 40, 5);
    expect(resumen.alerts).toBe(4);
  });

  it('el resumen vacío no divide por cero', () => {
    expect(summarize([]).badRatio).toBe(0);
  });

  it('compara las sesiones con avisos contra las de control', () => {
    const history = [
      session({ alertsEnabled: false, durationMs: minutes(20), badMs: minutes(8) }), // 40 %
      session({ alertsEnabled: true, durationMs: minutes(20), badMs: minutes(2) }), // 10 %
    ];
    const comparacion = compareModes(history);
    expect(comparacion.control.badRatio).toBeCloseTo(0.4, 5);
    expect(comparacion.withAlerts.badRatio).toBeCloseTo(0.1, 5);
    // Los avisos reducen el tiempo encorvado un 75 %.
    expect(comparacion.improvement).toBeCloseTo(0.75, 5);
  });

  it('no inventa una conclusión si falta un grupo', () => {
    expect(compareModes([session({ alertsEnabled: true })]).improvement).toBeNull();
    expect(compareModes([session({ alertsEnabled: false })]).improvement).toBeNull();
    expect(compareModes([])).toMatchObject({ improvement: null });
  });

  it('exporta un CSV con cabecera y una fila por sesión', () => {
    const csv = toCsv([session({ durationMs: minutes(20), badMs: minutes(5), alertsEnabled: false })]);
    const [cabecera, fila] = csv.split('\n');
    expect(cabecera).toBe('fecha,origen,avisos,duracion_min,encorvado_min,porcentaje_encorvado,alertas');
    expect(fila).toContain('control');
    expect(fila).toContain('20.00');
    expect(fila).toContain('25.0');
  });

  it('limpia lo que se lee de disco', () => {
    const historial = sanitizeHistory([
      session(),
      null,
      'basura',
      { startedAt: 1, durationMs: 'x' },
      { startedAt: 2, durationMs: minutes(1), badMs: minutes(9), alerts: 0 }, // encorvado > duración
      { startedAt: 3, durationMs: minutes(10), badMs: minutes(1), alerts: 1 }, // sin origen ni modo
    ]);
    expect(historial).toHaveLength(2);
    expect(historial.at(-1)).toMatchObject({ startedAt: 3, source: 'webcam', alertsEnabled: true });
  });

  it('no se rompe con un historial corrupto', () => {
    expect(sanitizeHistory(null)).toEqual([]);
    expect(sanitizeHistory({ vaya: 'no' })).toEqual([]);
  });
});
