/**
 * Objetivo diario, rachas, insignias e informe semanal de PostureFix Labs.
 *
 * Todo sale del historial de sesiones que ya se guarda para el experimento: el
 * tiempo con buena postura de una sesión es lo que duró menos lo que se pasó
 * encorvado. Los días son días del calendario local, así que una sesión a las
 * 23:50 cuenta para ese día y no para el siguiente. Es puro, como sessionLog.
 */
import type { SessionRecord } from './sessionLog';

export interface DayStats {
  /** Día local en formato AAAA-MM-DD. */
  key: string;
  /** Medianoche local de ese día (epoch en ms). */
  date: number;
  goodMs: number;
  badMs: number;
  totalMs: number;
  alerts: number;
  sessions: number;
}

const MINUTE_MS = 60_000;

/** Medianoche local del día de `timestamp`. */
export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Suma días de calendario; con `Date` para no tropezar con los cambios de hora. */
export function addDays(timestamp: number, days: number): number {
  const date = new Date(startOfDay(timestamp));
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Tiempo con buena postura dentro de una sesión. */
export function goodMsOf(record: SessionRecord): number {
  return Math.max(0, record.durationMs - record.badMs);
}

const emptyDay = (timestamp: number): DayStats => ({
  key: dayKey(timestamp),
  date: startOfDay(timestamp),
  goodMs: 0,
  badMs: 0,
  totalMs: 0,
  alerts: 0,
  sessions: 0,
});

/** Totales por día, con las sesiones de control incluidas: también miden. */
export function dailyStats(history: SessionRecord[]): Map<string, DayStats> {
  const days = new Map<string, DayStats>();
  for (const record of history) {
    const key = dayKey(record.startedAt);
    const day = days.get(key) ?? emptyDay(record.startedAt);
    days.set(key, {
      ...day,
      goodMs: day.goodMs + goodMsOf(record),
      badMs: day.badMs + record.badMs,
      totalMs: day.totalMs + record.durationMs,
      alerts: day.alerts + record.alerts,
      sessions: day.sessions + 1,
    });
  }
  return days;
}

export interface GoalProgress {
  goodMs: number;
  goalMs: number;
  /** De 0 a 1. */
  ratio: number;
  met: boolean;
}

export function todayProgress(history: SessionRecord[], goalMinutes: number, now: number): GoalProgress {
  const goalMs = Math.max(1, goalMinutes) * MINUTE_MS;
  const goodMs = dailyStats(history).get(dayKey(now))?.goodMs ?? 0;
  return { goodMs, goalMs, ratio: Math.min(1, goodMs / goalMs), met: goodMs >= goalMs };
}

export interface Streak {
  /** Días seguidos cumpliendo el objetivo, hasta hoy o hasta ayer. */
  current: number;
  /** La racha más larga del historial. */
  best: number;
  /** Si hoy ya está cumplido. Si no, la racha sigue viva hasta medianoche. */
  todayMet: boolean;
}

export function streak(history: SessionRecord[], goalMinutes: number, now: number): Streak {
  const goalMs = Math.max(1, goalMinutes) * MINUTE_MS;
  const days = dailyStats(history);
  const met = (timestamp: number) => (days.get(dayKey(timestamp))?.goodMs ?? 0) >= goalMs;

  const todayMet = met(now);
  let current = 0;
  for (let day = todayMet ? startOfDay(now) : addDays(now, -1); met(day); day = addDays(day, -1)) {
    current += 1;
  }

  let best = 0;
  let run = 0;
  let previous: number | null = null;
  const metDays = [...days.values()]
    .filter((day) => day.goodMs >= goalMs)
    .map((day) => day.date)
    .sort((a, b) => a - b);
  for (const date of metDays) {
    run = previous != null && addDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  return { current, best: Math.max(best, current), todayMet };
}

export type BadgeId = 'primera' | 'objetivo' | 'racha3' | 'racha7' | 'racha30' | 'limpia';

export interface Badge {
  id: BadgeId;
  title: string;
  description: string;
  earned: boolean;
}

/** Una sesión limpia: al menos diez minutos con avisos y ni una alerta. */
const CLEAN_SESSION_MS = 10 * MINUTE_MS;

export function badges(history: SessionRecord[], goalMinutes: number, now: number): Badge[] {
  const { best } = streak(history, goalMinutes, now);
  const goalMs = Math.max(1, goalMinutes) * MINUTE_MS;
  const anyGoal = [...dailyStats(history).values()].some((day) => day.goodMs >= goalMs);
  const clean = history.some((record) => record.alertsEnabled && record.alerts === 0 && record.durationMs >= CLEAN_SESSION_MS);
  return [
    { id: 'primera', title: 'Primera sesión', description: 'Has vigilado tu postura por primera vez.', earned: history.length > 0 },
    { id: 'objetivo', title: 'Objetivo cumplido', description: 'Un día entero llegando a tu objetivo.', earned: anyGoal },
    { id: 'limpia', title: 'Sesión limpia', description: 'Diez minutos o más sin una sola alerta.', earned: clean },
    { id: 'racha3', title: 'Tres días', description: 'Tres días seguidos cumpliendo el objetivo.', earned: best >= 3 },
    { id: 'racha7', title: 'Una semana', description: 'Siete días seguidos cumpliendo el objetivo.', earned: best >= 7 },
    { id: 'racha30', title: 'Un mes', description: 'Treinta días seguidos. Espalda de acero.', earned: best >= 30 },
  ];
}

/** Iniciales de los días en español, empezando por el domingo como `getDay()`. */
const WEEKDAY_INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

export interface WeekDay extends DayStats {
  /** Inicial del día de la semana: L, M, X, J, V, S, D. */
  label: string;
  /** Proporción de tiempo encorvado ese día, de 0 a 1. */
  badRatio: number;
}

export interface WeeklyReport {
  /** Los siete últimos días, del más antiguo a hoy. */
  days: WeekDay[];
  totalMs: number;
  goodMs: number;
  badMs: number;
  badRatio: number;
  alerts: number;
  sessions: number;
  /** El día con menos tiempo encorvado (entre los que tienen datos). */
  bestDay: WeekDay | null;
  /** Proporción encorvada de los siete días anteriores, si los hay. */
  previousBadRatio: number | null;
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

export function weeklyReport(history: SessionRecord[], now: number): WeeklyReport {
  const stats = dailyStats(history);
  const days: WeekDay[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const date = addDays(now, offset);
    const day = stats.get(dayKey(date)) ?? emptyDay(date);
    days.push({ ...day, label: WEEKDAY_INITIALS[new Date(date).getDay()], badRatio: ratio(day.badMs, day.totalMs) });
  }

  const sum = (key: 'totalMs' | 'goodMs' | 'badMs' | 'alerts' | 'sessions') =>
    days.reduce((total, day) => total + day[key], 0);
  const withData = days.filter((day) => day.totalMs > 0);
  const bestDay = withData.reduce<WeekDay | null>((best, day) => (!best || day.badRatio < best.badRatio ? day : best), null);

  let previousTotal = 0;
  let previousBad = 0;
  for (let offset = -13; offset <= -7; offset++) {
    const day = stats.get(dayKey(addDays(now, offset)));
    previousTotal += day?.totalMs ?? 0;
    previousBad += day?.badMs ?? 0;
  }

  const totalMs = sum('totalMs');
  const badMs = sum('badMs');
  return {
    days,
    totalMs,
    goodMs: sum('goodMs'),
    badMs,
    badRatio: ratio(badMs, totalMs),
    alerts: sum('alerts'),
    sessions: sum('sessions'),
    bestDay,
    previousBadRatio: previousTotal > 0 ? previousBad / previousTotal : null,
  };
}
