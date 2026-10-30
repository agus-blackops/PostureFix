import { describeSchedule, isWithinSchedule, nextScheduleChange, sanitizeSchedule, type Schedule } from '../schedule';

/** 28 de septiembre de 2026 es lunes. */
const at = (day: number, h: number, m = 0) => new Date(2026, 8, 28 + day, h, m);
const weekdays: Schedule = { enabled: true, days: [true, true, true, true, true, false, false], startMin: 16 * 60, endMin: 20 * 60 };

describe('schedule', () => {
  it('sin horario activado siempre vigila', () => {
    expect(isWithinSchedule({ ...weekdays, enabled: false }, at(5, 3))).toBe(true);
  });

  it('respeta días y horas', () => {
    expect(isWithinSchedule(weekdays, at(0, 16))).toBe(true);
    expect(isWithinSchedule(weekdays, at(0, 19, 59))).toBe(true);
    expect(isWithinSchedule(weekdays, at(0, 20))).toBe(false);
    expect(isWithinSchedule(weekdays, at(0, 15, 59))).toBe(false);
    expect(isWithinSchedule(weekdays, at(5, 17))).toBe(false);
  });

  it('una franja que cruza la medianoche pertenece al día en que empieza', () => {
    const night: Schedule = { enabled: true, days: [false, false, false, false, true, false, false], startMin: 22 * 60, endMin: 60 };
    expect(isWithinSchedule(night, at(4, 23))).toBe(true); // viernes 23:00
    expect(isWithinSchedule(night, at(5, 0, 30))).toBe(true); // sábado 00:30, viene del viernes
    expect(isWithinSchedule(night, at(5, 23))).toBe(false); // el sábado no empieza otra
  });

  it('dice cuándo vuelve a tocar', () => {
    const next = nextScheduleChange(weekdays, at(4, 21));
    expect(next?.getDay()).toBe(1); // lunes
    expect(next?.getHours()).toBe(16);
    expect(nextScheduleChange(weekdays, at(0, 17))?.getHours()).toBe(20);
    expect(nextScheduleChange({ ...weekdays, enabled: false }, at(0, 17))).toBeNull();
  });

  it('lo describe en una línea', () => {
    expect(describeSchedule(weekdays)).toBe('L–V · 16:00–20:00');
    expect(describeSchedule({ ...weekdays, days: [true, false, true, false, true, false, false] })).toBe('L, X, V · 16:00–20:00');
    expect(describeSchedule({ ...weekdays, days: Array(7).fill(true), startMin: 0, endMin: 0 })).toBe('Todos los días · todo el día');
  });

  it('limpia lo leído de disco y redondea al cuarto de hora', () => {
    expect(sanitizeSchedule({ days: [1, 2], startMin: 'x', endMin: 977 })).toMatchObject({
      enabled: false,
      startMin: 16 * 60,
      endMin: 975,
    });
  });
});
