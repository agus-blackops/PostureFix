import { addDays, badges, dayKey, dailyStats, streak, todayProgress, weeklyReport } from '../progress';
import type { SessionRecord } from '../sessionLog';

const MIN = 60_000;
/** Viernes 25 de septiembre de 2026 a las 18:00, hora local. */
const NOW = new Date(2026, 8, 25, 18, 0).getTime();

/** Sesión `daysAgo` días antes de hoy, con sus minutos buenos y malos. */
function session(daysAgo: number, goodMin: number, badMin = 0, extra: Partial<SessionRecord> = {}): SessionRecord {
  return {
    startedAt: addDays(NOW, -daysAgo) + 10 * 60 * MIN,
    durationMs: (goodMin + badMin) * MIN,
    badMs: badMin * MIN,
    alerts: 0,
    source: 'movil',
    alertsEnabled: true,
    ...extra,
  };
}

describe('progress', () => {
  it('agrupa por día local, también a última hora', () => {
    const lateNight = { ...session(0, 5), startedAt: new Date(2026, 8, 24, 23, 50).getTime() };
    const days = dailyStats([lateNight, session(0, 10)]);
    expect(days.get('2026-09-24')?.goodMs).toBe(5 * MIN);
    expect(days.get('2026-09-25')?.goodMs).toBe(10 * MIN);
    expect(dayKey(NOW)).toBe('2026-09-25');
  });

  it('suma el tiempo bueno de hoy frente al objetivo', () => {
    const progress = todayProgress([session(0, 12, 3), session(0, 8), session(1, 60)], 30, NOW);
    expect(progress.goodMs).toBe(20 * MIN);
    expect(progress.ratio).toBeCloseTo(20 / 30);
    expect(progress.met).toBe(false);
    expect(todayProgress([session(0, 45)], 30, NOW)).toMatchObject({ ratio: 1, met: true });
  });

  it('la racha sigue viva hasta medianoche aunque hoy aún no se haya cumplido', () => {
    const history = [session(1, 30), session(2, 40), session(3, 31)];
    expect(streak(history, 30, NOW)).toEqual({ current: 3, best: 3, todayMet: false });
    expect(streak([session(0, 30), ...history], 30, NOW).current).toBe(4);
  });

  it('un día sin cumplir corta la racha, pero la mejor se recuerda', () => {
    const history = [session(0, 30), session(1, 30), session(3, 30), session(4, 30), session(5, 30), session(6, 10)];
    expect(streak(history, 30, NOW)).toMatchObject({ current: 2, best: 3 });
    expect(streak([session(2, 30)], 30, NOW)).toMatchObject({ current: 0, best: 1 });
  });

  it('las sesiones de control también cuentan: miden igual', () => {
    expect(todayProgress([session(0, 30, 0, { alertsEnabled: false })], 30, NOW).met).toBe(true);
  });

  it('da las insignias que tocan', () => {
    const earned = (history: SessionRecord[]) =>
      badges(history, 30, NOW)
        .filter((badge) => badge.earned)
        .map((badge) => badge.id);
    expect(earned([])).toEqual([]);
    expect(earned([session(0, 5)])).toEqual(['primera']);
    expect(earned([session(0, 15)])).toEqual(['primera', 'limpia']);
    expect(earned([session(0, 15, 0, { alerts: 2 })])).toEqual(['primera']);
    expect(earned([session(0, 30), session(1, 30), session(2, 30)])).toEqual(['primera', 'objetivo', 'limpia', 'racha3']);
  });

  it('el informe semanal cubre los siete últimos días, hasta hoy', () => {
    const report = weeklyReport([session(0, 30, 10, { alerts: 2 }), session(3, 50, 0), session(6, 20, 20), session(9, 10, 10)], NOW);
    expect(report.days.map((day) => day.label)).toEqual(['S', 'D', 'L', 'M', 'X', 'J', 'V']);
    expect(report.totalMs).toBe(130 * MIN);
    expect(report.badRatio).toBeCloseTo(30 / 130);
    expect(report.alerts).toBe(2);
    expect(report.sessions).toBe(3);
    expect(report.bestDay?.key).toBe(dayKey(addDays(NOW, -3)));
    expect(report.previousBadRatio).toBeCloseTo(0.5);
  });

  it('sin datos el informe no inventa un mejor día ni una semana anterior', () => {
    const report = weeklyReport([], NOW);
    expect(report.days).toHaveLength(7);
    expect(report.bestDay).toBeNull();
    expect(report.previousBadRatio).toBeNull();
    expect(report.badRatio).toBe(0);
  });
});
