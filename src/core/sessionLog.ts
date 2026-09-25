/**
 * Registro de sesiones para poder medir si PostureFix sirve de algo.
 *
 * La idea del experimento: hacer sesiones **de control** (la app mide pero no
 * avisa) y sesiones normales (la app avisa), y comparar qué porcentaje del
 * tiempo pasa la persona encorvada en cada caso. Este módulo es puro: guarda,
 * resume y compara, sin tocar almacenamiento ni interfaz.
 */
export type SessionSource = 'movil' | 'webcam';

export interface SessionRecord {
  /** Marca de tiempo del inicio (epoch en ms). */
  startedAt: number;
  /** Duración vigilada. */
  durationMs: number;
  /** Tiempo con mala postura dentro de esa duración. */
  badMs: number;
  /** Alertas completas que llegaron a sonar (o que habrían sonado). */
  alerts: number;
  source: SessionSource;
  /** `false` en una sesión de control: se mide, pero no se avisa. */
  alertsEnabled: boolean;
}

export interface Summary {
  sessions: number;
  totalMs: number;
  badMs: number;
  /** Proporción de tiempo encorvado, de 0 a 1. */
  badRatio: number;
  alerts: number;
}

/** Sesiones guardadas como máximo; de sobra para una feria de ciencias. */
export const MAX_SESSIONS = 200;
/** Por debajo de medio minuto una sesión no dice nada, así que no se guarda. */
export const MIN_SESSION_MS = 30_000;

export const EMPTY_SUMMARY: Summary = { sessions: 0, totalMs: 0, badMs: 0, badRatio: 0, alerts: 0 };

export function isMeaningful(record: SessionRecord): boolean {
  return record.durationMs >= MIN_SESSION_MS;
}

/** Añade una sesión al historial (la más reciente primero) y recorta el exceso. */
export function addSession(history: SessionRecord[], record: SessionRecord): SessionRecord[] {
  if (!isMeaningful(record)) {
    return history;
  }
  return [record, ...history].sort((a, b) => b.startedAt - a.startedAt).slice(0, MAX_SESSIONS);
}

export function summarize(records: SessionRecord[]): Summary {
  if (records.length === 0) {
    return EMPTY_SUMMARY;
  }
  const totalMs = records.reduce((sum, record) => sum + record.durationMs, 0);
  const badMs = records.reduce((sum, record) => sum + record.badMs, 0);
  return {
    sessions: records.length,
    totalMs,
    badMs,
    badRatio: totalMs > 0 ? badMs / totalMs : 0,
    alerts: records.reduce((sum, record) => sum + record.alerts, 0),
  };
}

export interface Comparison {
  /** Sesiones en las que la app avisaba. */
  withAlerts: Summary;
  /** Sesiones de control: medía sin avisar. */
  control: Summary;
  /**
   * Cuánto baja la proporción de tiempo encorvado gracias a los avisos, de 0 a
   * 1 (0,4 = un 40 % menos). `null` mientras falte alguno de los dos grupos,
   * que es justo lo que hay que decirle a quien mira el póster.
   */
  improvement: number | null;
}

export function compareModes(history: SessionRecord[]): Comparison {
  const withAlerts = summarize(history.filter((record) => record.alertsEnabled));
  const control = summarize(history.filter((record) => !record.alertsEnabled));
  const comparable = withAlerts.sessions > 0 && control.sessions > 0 && control.badRatio > 0;
  return {
    withAlerts,
    control,
    improvement: comparable ? (control.badRatio - withAlerts.badRatio) / control.badRatio : null,
  };
}

/** Historial en CSV, para llevárselo a una hoja de cálculo o al póster. */
export function toCsv(history: SessionRecord[]): string {
  const rows = [
    ['fecha', 'origen', 'avisos', 'duracion_min', 'encorvado_min', 'porcentaje_encorvado', 'alertas'],
    ...history.map((record) => [
      new Date(record.startedAt).toISOString(),
      record.source,
      record.alertsEnabled ? 'si' : 'control',
      (record.durationMs / 60000).toFixed(2),
      (record.badMs / 60000).toFixed(2),
      (record.durationMs > 0 ? (record.badMs / record.durationMs) * 100 : 0).toFixed(1),
      String(record.alerts),
    ]),
  ];
  return rows.map((row) => row.join(',')).join('\n');
}

/** Filtra lo leído de disco: descarta cualquier registro incompleto o absurdo. */
export function sanitizeHistory(raw: unknown): SessionRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const clean: SessionRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Partial<SessionRecord>;
    const numbers = [record.startedAt, record.durationMs, record.badMs, record.alerts];
    if (!numbers.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) continue;
    if (record.durationMs! < record.badMs!) continue;
    clean.push({
      startedAt: record.startedAt!,
      durationMs: record.durationMs!,
      badMs: record.badMs!,
      alerts: record.alerts!,
      source: record.source === 'movil' ? 'movil' : 'webcam',
      alertsEnabled: record.alertsEnabled !== false,
    });
  }
  return clean.sort((a, b) => b.startedAt - a.startedAt).slice(0, MAX_SESSIONS);
}
