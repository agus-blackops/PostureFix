/**
 * Paletas de la 2.0: oscura (la de siempre, negro cálido) y clara (papel
 * cálido). Los nombres siguen a Apple: `label` para el texto, `fill` para los
 * rellenos translúcidos, `separator` para las líneas y `tint` para el naranja
 * de la marca. En la clara los colores de estado se oscurecen para que el
 * texto se lea sobre fondo claro.
 */
export interface Palette {
  background: string;
  tint: string;
  /** El naranja cuando va como texto (en claro, más oscuro para que se lea). */
  tintText: string;
  /** Texto encima del naranja. */
  onTint: string;
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  quaternaryLabel: string;
  separator: string;
  fill: string;
  secondaryFill: string;
  tertiaryFill: string;
  quaternaryFill: string;
  /** Gris de «en pausa». */
  neutral: string;
  green: string;
  yellow: string;
  red: string;
  /** Texto encima de un color de estado. */
  onStatus: string;
  glassFallback: string;
  glassFallbackThick: string;
  glassHighlight: string;
  glassEdge: string;
  scrim: string;
}

export const DARK: Palette = {
  background: '#0A0706',
  tint: '#FF7A29',
  tintText: '#FF8A45',
  onTint: '#1F0C02',
  label: '#FFFFFF',
  secondaryLabel: 'rgba(246, 236, 230, 0.64)',
  tertiaryLabel: 'rgba(246, 236, 230, 0.38)',
  quaternaryLabel: 'rgba(246, 236, 230, 0.2)',
  separator: 'rgba(255, 240, 230, 0.12)',
  fill: 'rgba(130, 120, 118, 0.36)',
  secondaryFill: 'rgba(130, 120, 118, 0.28)',
  tertiaryFill: 'rgba(130, 120, 118, 0.2)',
  quaternaryFill: 'rgba(130, 120, 118, 0.14)',
  neutral: '#A39890',
  green: '#30D158',
  yellow: '#FFD60A',
  red: '#FF453A',
  onStatus: '#141009',
  glassFallback: 'rgba(44, 34, 29, 0.66)',
  glassFallbackThick: 'rgba(34, 26, 22, 0.9)',
  glassHighlight: 'rgba(255, 255, 255, 0.14)',
  glassEdge: 'rgba(255, 255, 255, 0.06)',
  scrim: 'rgba(0, 0, 0, 0.5)',
};

export const LIGHT: Palette = {
  background: '#F6F1ED',
  tint: '#F26B1D',
  tintText: '#B9480A',
  onTint: '#2A1104',
  label: '#1D1612',
  secondaryLabel: 'rgba(60, 42, 32, 0.7)',
  tertiaryLabel: 'rgba(60, 42, 32, 0.45)',
  quaternaryLabel: 'rgba(60, 42, 32, 0.24)',
  separator: 'rgba(60, 42, 32, 0.14)',
  fill: 'rgba(120, 100, 90, 0.22)',
  secondaryFill: 'rgba(120, 100, 90, 0.17)',
  tertiaryFill: 'rgba(120, 100, 90, 0.12)',
  quaternaryFill: 'rgba(120, 100, 90, 0.08)',
  neutral: '#857870',
  green: '#1E8A47',
  yellow: '#B06F00',
  red: '#D2362A',
  onStatus: '#FFFFFF',
  glassFallback: 'rgba(255, 255, 255, 0.74)',
  glassFallbackThick: 'rgba(255, 252, 250, 0.94)',
  glassHighlight: 'rgba(255, 255, 255, 0.95)',
  glassEdge: 'rgba(60, 42, 32, 0.09)',
  scrim: 'rgba(25, 15, 10, 0.32)',
};
