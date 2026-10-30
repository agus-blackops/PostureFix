import { ROUTINES, positionAt, routineDurationMs, stepStartMs } from '../stretches';

const routine = ROUTINES[0];

describe('stretches', () => {
  it('cada rutina dura unos dos minutos', () => {
    for (const each of ROUTINES) {
      expect(routineDurationMs(each)).toBeGreaterThanOrEqual(90_000);
      expect(routineDurationMs(each)).toBeLessThanOrEqual(150_000);
      expect(each.steps.every((step) => step.seconds > 0 && step.instruction.length > 0)).toBe(true);
    }
  });

  it('sabe en qué paso va', () => {
    expect(positionAt(routine, 0)).toMatchObject({ index: 0, stepElapsedMs: 0, done: false });
    const second = routine.steps[0].seconds * 1000 + 5000;
    expect(positionAt(routine, second)).toMatchObject({ index: 1, stepElapsedMs: 5000 });
    expect(positionAt(routine, second).stepRemainingMs).toBe(routine.steps[1].seconds * 1000 - 5000);
  });

  it('al acabar se queda en el último paso y marca la rutina como hecha', () => {
    const end = positionAt(routine, routineDurationMs(routine) + 10_000);
    expect(end).toMatchObject({ index: routine.steps.length - 1, done: true, progress: 1, stepRemainingMs: 0 });
  });

  it('un tiempo negativo cuenta como el principio', () => {
    expect(positionAt(routine, -500)).toMatchObject({ index: 0, progress: 0 });
  });

  it('calcula dónde empieza cada paso', () => {
    expect(stepStartMs(routine, 0)).toBe(0);
    expect(stepStartMs(routine, 2)).toBe((routine.steps[0].seconds + routine.steps[1].seconds) * 1000);
    expect(stepStartMs(routine, 99)).toBe(routineDurationMs(routine));
  });
});
