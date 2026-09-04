import {
  DEFAULT_ENGINE_CONFIG,
  MESSAGES,
  createInitialState,
  startMonitoring,
  step,
  stopMonitoring,
  type EngineAction,
  type EngineConfig,
  type EngineState,
} from '../postureEngine';

const CONFIG: EngineConfig = { ...DEFAULT_ENGINE_CONFIG, graceMs: 1000, scareMs: 500, countStepMs: 500, recoverMs: 300 };
const TICK_MS = 50;

/** Avanza la máquina `durationMs` con una inclinación fija. */
function advance(
  state: EngineState,
  deviationDeg: number,
  durationMs: number,
  options: { trusted?: boolean; config?: EngineConfig } = {}
): { state: EngineState; actions: EngineAction[] } {
  const config = options.config ?? CONFIG;
  let current = state;
  const actions: EngineAction[] = [];
  for (let elapsed = 0; elapsed < durationMs; elapsed += TICK_MS) {
    const result = step(current, { deviationDeg, dtMs: TICK_MS, trusted: options.trusted ?? true }, config);
    current = result.state;
    actions.push(...result.actions);
  }
  return { state: current, actions };
}

const types = (actions: EngineAction[]) => actions.map((action) => action.type);
const spoken = (actions: EngineAction[]) =>
  actions.filter((action): action is Extract<EngineAction, { type: 'speak' }> => action.type === 'speak').map((a) => a.text);

const monitoring = () => startMonitoring(createInitialState());

describe('postureEngine', () => {
  it('no hace nada mientras está parado', () => {
    const result = advance(createInitialState(), 90, 10000);
    expect(result.state.phase).toBe('idle');
    expect(result.actions).toHaveLength(0);
  });

  it('mantiene la postura correcta por debajo del umbral', () => {
    const result = advance(monitoring(), CONFIG.thresholdDeg - 5, 5000);
    expect(result.state.phase).toBe('ok');
    expect(result.actions).toHaveLength(0);
  });

  it('pita tras el margen de gracia agachado', () => {
    const slouch = advance(monitoring(), 40, CONFIG.graceMs - TICK_MS);
    expect(slouch.state.phase).toBe('slouching');
    expect(slouch.actions).toHaveLength(0);

    const beep = advance(slouch.state, 40, TICK_MS * 2);
    expect(beep.state.phase).toBe('scare');
    expect(types(beep.actions)).toEqual(['beep', 'haptic']);
  });

  it('cuenta uno, dos, tres y luego dispara la alerta fuerte', () => {
    const run = advance(monitoring(), 40, CONFIG.graceMs + CONFIG.scareMs + 3 * CONFIG.countStepMs + TICK_MS);

    expect(run.state.phase).toBe('alarm');
    expect(spoken(run.actions)).toEqual([...MESSAGES.counts, MESSAGES.alarm]);
    expect(types(run.actions)).toContain('startAlarm');
    expect(types(run.actions)).toContain('notify');
    expect(run.state.totalAlerts).toBe(1);
  });

  it('cancela la secuencia si el usuario se endereza a tiempo', () => {
    const beeped = advance(monitoring(), 40, CONFIG.graceMs + TICK_MS);
    expect(beeped.state.phase).toBe('scare');

    const recovered = advance(beeped.state, 2, CONFIG.recoverMs + TICK_MS);
    expect(recovered.state.phase).toBe('ok');
    expect(types(recovered.actions)).toContain('silence');
    expect(spoken(recovered.actions)).toEqual([MESSAGES.recovered]);
  });

  it('apaga la alarma al enderezarse y pasa por el descanso', () => {
    const alarm = advance(monitoring(), 40, CONFIG.graceMs + CONFIG.scareMs + 3 * CONFIG.countStepMs + TICK_MS);
    expect(alarm.state.phase).toBe('alarm');

    const recovered = advance(alarm.state, 3, CONFIG.recoverMs + TICK_MS);
    expect(recovered.state.phase).toBe('cooldown');
    expect(types(recovered.actions)).toContain('silence');

    const afterCooldown = advance(recovered.state, 3, CONFIG.cooldownMs + TICK_MS);
    expect(afterCooldown.state.phase).toBe('ok');
  });

  it('corta la alarma por seguridad si nadie reacciona', () => {
    const alarm = advance(monitoring(), 40, CONFIG.graceMs + CONFIG.scareMs + 3 * CONFIG.countStepMs + TICK_MS);
    const stuck = advance(alarm.state, 40, CONFIG.maxAlarmMs + TICK_MS);
    expect(stuck.state.phase).toBe('cooldown');
    expect(types(stuck.actions)).toContain('silence');
  });

  it('aplica histéresis alrededor del umbral', () => {
    const slouching = advance(monitoring(), CONFIG.thresholdDeg + 2, 400);
    expect(slouching.state.slouching).toBe(true);

    // Justo por debajo del umbral sigue contando como agachado…
    const stillSlouching = advance(slouching.state, CONFIG.thresholdDeg - 2, 200);
    expect(stillSlouching.state.slouching).toBe(true);

    // …hasta recuperar también el margen de histéresis.
    const upright = advance(stillSlouching.state, CONFIG.thresholdDeg - CONFIG.hysteresisDeg - 2, 200);
    expect(upright.state.slouching).toBe(false);
  });

  it('congela los contadores con lecturas poco fiables (usuario en movimiento)', () => {
    const moving = advance(monitoring(), 40, 5000, { trusted: false });
    expect(moving.state.phase).toBe('ok');
    expect(moving.state.badMs).toBe(0);
    expect(moving.actions).toHaveLength(0);
  });

  it('acumula el tiempo agachado de la sesión', () => {
    const run = advance(monitoring(), 40, 1000);
    expect(run.state.sessionBadMs).toBe(1000);
    expect(run.state.sessionMs).toBe(1000);
  });

  it('al parar silencia todo y vuelve a reposo', () => {
    const alarm = advance(monitoring(), 40, CONFIG.graceMs + CONFIG.scareMs + 3 * CONFIG.countStepMs + TICK_MS);
    const stopped = stopMonitoring(alarm.state);
    expect(stopped.state.phase).toBe('idle');
    expect(types(stopped.actions)).toEqual(['silence']);
    expect(stopped.state.totalAlerts).toBe(1);
  });

  it('vuelve a avisar en el siguiente ciclo tras el descanso', () => {
    const first = advance(monitoring(), 40, CONFIG.graceMs + CONFIG.scareMs + 3 * CONFIG.countStepMs + TICK_MS);
    const recovered = advance(first.state, 2, CONFIG.recoverMs + CONFIG.cooldownMs + TICK_MS);
    expect(recovered.state.phase).toBe('ok');

    const second = advance(recovered.state, 40, CONFIG.graceMs + CONFIG.scareMs + 3 * CONFIG.countStepMs + TICK_MS);
    expect(second.state.phase).toBe('alarm');
    expect(second.state.totalAlerts).toBe(2);
  });
});
