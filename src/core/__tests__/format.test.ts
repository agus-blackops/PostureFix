import { formatDegrees, formatDuration, formatPercent } from '../format';

describe('formatDuration', () => {
  it('muestra segundos por debajo del minuto', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(42_000)).toBe('42s');
  });

  it('redondea antes de partir en minutos', () => {
    // 59,6 s son 60 s: tiene que salir «1 min 00s», no «60s».
    expect(formatDuration(59_600)).toBe('1 min 00s');
    expect(formatDuration(185_000)).toBe('3 min 05s');
  });

  it('pasa a horas en sesiones largas', () => {
    expect(formatDuration(3_720_000)).toBe('1 h 02 min');
  });

  it('no enseña valores negativos ni NaN', () => {
    expect(formatDuration(-5000)).toBe('0s');
    expect(formatDuration(Number.NaN)).toBe('0s');
  });
});

describe('formatPercent', () => {
  it('usa coma decimal y espacio antes del signo', () => {
    expect(formatPercent(0.125)).toBe('12,5 %');
    expect(formatPercent(1)).toBe('100,0 %');
    expect(formatPercent(0.5, 0)).toBe('50 %');
  });

  it('trata lo que no es número como cero', () => {
    expect(formatPercent(Number.NaN)).toBe('0,0 %');
  });
});

describe('formatDegrees', () => {
  it('redondea a grados enteros', () => {
    expect(formatDegrees(12.6)).toBe('13°');
    expect(formatDegrees(Number.POSITIVE_INFINITY)).toBe('0°');
  });
});
