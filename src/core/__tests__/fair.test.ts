import { FAIR_PRESET, alertVolume, chooseAlarmSound, fairEngineConfig } from '../fair';
import {
  DEFAULT_ENGINE_CONFIG,
  createInitialState,
  startMonitoring,
  step,
  type EngineConfig,
  type EngineState,
} from '../postureEngine';

/** Recorre el motor a 20 Hz con una inclinación fija y devuelve las fases por las que pasa. */
function runFor(config: EngineConfig, deviationDeg: number, ms: number) {
  let state: EngineState = startMonitoring(createInitialState());
  const phases: { phase: string; at: number }[] = [];
  for (let t = 0; t <= ms; t += 50) {
    state = step(state, { deviationDeg, dtMs: 50, trusted: true }, config).state;
    if (phases.at(-1)?.phase !== state.phase) phases.push({ phase: state.phase, at: t });
  }
  return phases;
}

describe('fairEngineConfig', () => {
  it('acorta la secuencia y la deja entera', () => {
    const config = fairEngineConfig({ ...DEFAULT_ENGINE_CONFIG, graceMs: 8000, maxLevel: 'beep' });
    expect(config.graceMs).toBe(FAIR_PRESET.graceMs);
    expect(config.cooldownMs).toBe(FAIR_PRESET.cooldownMs);
    expect(config.maxAlarmMs).toBe(FAIR_PRESET.maxAlarmMs);
    expect(config.maxLevel).toBe('alarm');
  });

  it('nunca es menos sensible que 18°, pero respeta un perfil más sensible', () => {
    expect(fairEngineConfig({ ...DEFAULT_ENGINE_CONFIG, thresholdDeg: 30 }).thresholdDeg).toBe(18);
    expect(fairEngineConfig({ ...DEFAULT_ENGINE_CONFIG, thresholdDeg: 12 }).thresholdDeg).toBe(12);
  });

  it('pita al segundo de encorvarse y la alarma se corta sola', () => {
    const phases = runFor(fairEngineConfig(DEFAULT_ENGINE_CONFIG), 40, 20_000);
    const scare = phases.find((p) => p.phase === 'scare');
    const alarm = phases.find((p) => p.phase === 'alarm');
    const after = phases.find((p) => alarm && p.at > alarm.at);
    expect(scare!.at).toBeLessThanOrEqual(1100);
    expect(alarm).toBeDefined();
    expect(after!.at - alarm!.at).toBeLessThanOrEqual(FAIR_PRESET.maxAlarmMs + 100);
  });
});

describe('alertVolume', () => {
  it('baja el volumen sólo en modo feria', () => {
    expect(alertVolume(1, true)).toBe(FAIR_PRESET.maxVolume);
    expect(alertVolume(0.4, true)).toBe(0.4);
    expect(alertVolume(1, false)).toBe(1);
  });
});

describe('chooseAlarmSound', () => {
  const base = { easAlways: false, easWithHeadphones: true, fairMode: false };

  it('se comporta como antes fuera del modo feria', () => {
    expect(chooseAlarmSound(base, true)).toBe('eas');
    expect(chooseAlarmSound(base, false)).toBe('siren');
    expect(chooseAlarmSound({ ...base, easAlways: true }, false)).toBe('eas');
    expect(chooseAlarmSound({ ...base, easAlways: true, easWithHeadphones: false }, true)).toBe('eas');
    expect(chooseAlarmSound({ ...base, easWithHeadphones: false }, true)).toBe('siren');
  });

  it('en modo feria el tono EAS sólo suena con auriculares', () => {
    const fair = { ...base, easAlways: true, fairMode: true };
    expect(chooseAlarmSound(fair, false)).toBe('siren');
    expect(chooseAlarmSound(fair, true)).toBe('eas');
  });
});
