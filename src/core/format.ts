/**
 * Formatos que comparten la app de móvil y la de portátil, que antes tenían
 * cada una su copia.
 */

/** Duración legible: «42s», «3 min 05s», «1 h 02 min». */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  }
  if (minutes > 0) {
    return `${minutes} min ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

/**
 * Porcentaje para leer, con espacio antes del signo como pide la tipografía en
 * español y coma decimal: 0,125 → «12,5 %».
 */
export function formatPercent(ratio: number, decimals = 1): string {
  const value = Number.isFinite(ratio) ? ratio * 100 : 0;
  return `${value.toFixed(decimals).replace('.', ',')} %`;
}

/** Grados enteros: 12,6 → «13°». */
export function formatDegrees(deg: number): string {
  return `${Math.round(Number.isFinite(deg) ? deg : 0)}°`;
}
