/**
 * Horario de vigilancia: la app sólo avisa los días y horas elegidos (por
 * ejemplo, de lunes a viernes de 16:00 a 20:00, mientras haces deberes). Fuera
 * de horario no pita ni cuenta tiempo encorvado. Admite franjas que cruzan la
 * medianoche (22:00–01:00). Puro.
 */
import { readBoolean, readNumber } from './validate';

export interface Schedule {
  enabled: boolean;
  /** Días activos, de lunes [0] a domingo [6]. */
  days: boolean[];
  /** Minutos desde medianoche. */
  startMin: number;
  endMin: number;
}

export const DAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
export const SCHEDULE_STEP_MIN = 15;
const DAY_MIN = 24 * 60;

export const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  days: [true, true, true, true, true, false, false],
  startMin: 16 * 60,
  endMin: 20 * 60,
};

/** Día de la semana empezando en lunes (0) para una fecha local. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** ¿Toca vigilar ahora? Sin horario activado, siempre. */
export function isWithinSchedule(schedule: Schedule, date: Date): boolean {
  if (!schedule.enabled) return true;
  if (!schedule.days.some(Boolean)) return false;
  const minute = date.getHours() * 60 + date.getMinutes();
  const today = weekdayIndex(date);
  const yesterday = (today + 6) % 7;
  const { startMin, endMin, days } = schedule;
  if (startMin === endMin) return days[today];
  if (startMin < endMin) return days[today] && minute >= startMin && minute < endMin;
  // Franja que cruza la medianoche: la noche pertenece al día en que empieza.
  return (days[today] && minute >= startMin) || (days[yesterday] && minute < endMin);
}

/**
 * Próximo momento en que cambia el estado (empieza o acaba la franja), para
 * decir «no avisará hasta el lunes a las 16:00». `null` sin horario.
 */
export function nextScheduleChange(schedule: Schedule, from: Date): Date | null {
  if (!schedule.enabled || !schedule.days.some(Boolean)) return null;
  const inside = isWithinSchedule(schedule, from);
  const probe = new Date(from);
  probe.setSeconds(0, 0);
  // Se avanza de cuarto en cuarto de hora (el paso del horario) hasta 8 días.
  const aligned = Math.ceil((probe.getHours() * 60 + probe.getMinutes() + 1) / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN;
  probe.setHours(0, aligned, 0, 0);
  for (let i = 0; i < (8 * DAY_MIN) / SCHEDULE_STEP_MIN; i++) {
    if (isWithinSchedule(schedule, probe) !== inside) return probe;
    probe.setMinutes(probe.getMinutes() + SCHEDULE_STEP_MIN);
  }
  return null;
}

export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** «L–V · 16:00–20:00», «L, X, V · 09:00–14:00», «Todos los días · …». */
export function describeSchedule(schedule: Schedule): string {
  const active = schedule.days.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
  let days: string;
  if (active.length === 7) days = 'Todos los días';
  else if (active.length === 0) days = 'Ningún día';
  else if (active.length > 2 && active.every((d, i) => i === 0 || d === active[i - 1] + 1)) {
    days = `${DAY_INITIALS[active[0]]}–${DAY_INITIALS[active[active.length - 1]]}`;
  } else days = active.map((d) => DAY_INITIALS[d]).join(', ');
  const hours =
    schedule.startMin === schedule.endMin ? 'todo el día' : `${formatClock(schedule.startMin)}–${formatClock(schedule.endMin)}`;
  return `${days} · ${hours}`;
}

export function sanitizeSchedule(raw: unknown): Schedule {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const days = Array.isArray(input.days) && input.days.length === 7 ? input.days.map((d) => d === true) : DEFAULT_SCHEDULE.days;
  const minutes = (value: unknown, fallback: number) =>
    Math.round(readNumber(value, fallback, 0, DAY_MIN - SCHEDULE_STEP_MIN) / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN;
  return {
    enabled: readBoolean(input.enabled, DEFAULT_SCHEDULE.enabled),
    days,
    startMin: minutes(input.startMin, DEFAULT_SCHEDULE.startMin),
    endMin: minutes(input.endMin, DEFAULT_SCHEDULE.endMin),
  };
}
