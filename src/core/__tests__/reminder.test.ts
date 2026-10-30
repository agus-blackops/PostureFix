import { createReminder, reminderStep, type ReminderConfig, type ReminderState } from '../reminder';

const config: ReminderConfig = { everyMs: 60_000, resetAfterMovingMs: 10_000 };

function run(state: ReminderState, ms: number, moving: boolean) {
  let current = state;
  let due = 0;
  for (let t = 0; t < ms; t += 1000) {
    const result = reminderStep(current, { dtMs: 1000, moving }, config);
    current = result.state;
    if (result.due) due += 1;
  }
  return { state: current, due };
}

describe('reminder', () => {
  it('avisa cada intervalo sentado', () => {
    expect(run(createReminder(), 59_000, false).due).toBe(0);
    expect(run(createReminder(), 125_000, false).due).toBe(2);
  });

  it('caminar un rato cuenta como descanso y reinicia la cuenta', () => {
    const sentado = run(createReminder(), 50_000, false).state;
    const paseo = run(sentado, 10_000, true).state;
    expect(paseo.sittingMs).toBe(0);
    expect(run(paseo, 50_000, false).due).toBe(0);
  });

  it('un movimiento corto no es un descanso', () => {
    const sentado = run(createReminder(), 50_000, false).state;
    const gesto = run(sentado, 3_000, true).state;
    expect(run(gesto, 8_000, false).due).toBe(1);
  });
});
