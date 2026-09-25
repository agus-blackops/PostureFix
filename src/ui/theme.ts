import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Sistema de diseño de PostureFix 1.1.1: materiales de cristal al estilo de
 * Apple (Liquid Glass en iOS 26, los «materials» de desenfoque en versiones
 * anteriores) sobre un fondo casi negro que se tiñe con el estado de la postura.
 *
 * Los nombres siguen a Apple: `label` / `secondaryLabel` para el texto, `fill`
 * para los rellenos translúcidos, `separator` para las líneas finas y `tint`
 * para el acento de la marca. Los colores de estado son los del sistema en modo
 * oscuro (verde, amarillo, rojo), que ya están pensados para leerse sobre
 * cristal.
 */
export const colors = {
  /** Fondo de la app: negro cálido, para que el cristal tenga algo que teñir. */
  background: '#0A0706',

  /** Acento de la marca: el naranja de siempre, sin rebajar. */
  tint: '#FF7A29',
  /** Texto sobre el acento: oscuro, que el blanco sobre naranja no se lee bien. */
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

  /** Gris cálido de «en pausa»: no es verde porque no se está midiendo nada. */
  neutral: '#A39890',
  green: '#30D158',
  yellow: '#FFD60A',
  red: '#FF453A',
  /** Texto oscuro sobre los colores de estado: todos pasan de 4,5:1. */
  onStatus: '#141009',

  /** Lo que se ve cuando no hay cristal (Android, web): un tono cálido traslúcido. */
  glassFallback: 'rgba(44, 34, 29, 0.62)',
  glassFallbackThick: 'rgba(34, 26, 22, 0.86)',
  /** Filo de luz del cristal: el borde superior brilla más que el inferior. */
  glassHighlight: 'rgba(255, 255, 255, 0.14)',
  glassEdge: 'rgba(255, 255, 255, 0.06)',

  scrim: 'rgba(0, 0, 0, 0.5)',
} as const;

/** Color de estado para cada fase del motor de alertas. */
export const phaseColors: Record<string, string> = {
  idle: colors.neutral,
  ok: colors.green,
  slouching: colors.yellow,
  scare: colors.tint,
  countdown: colors.tint,
  alarm: colors.red,
  cooldown: colors.green,
};

/**
 * Esquinas continuas (la «squircle» de iOS): los radios van con
 * `borderCurve: 'continuous'`, que Android ignora sin romper nada.
 */
export const radius = {
  small: 10,
  medium: 14,
  large: 22,
  extraLarge: 30,
  capsule: 999,
} as const;

export const continuous: ViewStyle = { borderCurve: 'continuous' };

/** Rejilla de 4 pt. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

/**
 * Materiales de cristal, de más fino a más grueso, con su equivalencia en los
 * materiales de UIKit para iOS < 26 y la intensidad del desenfoque.
 */
export const materials = {
  thin: { tint: 'systemThinMaterialDark', intensity: 60, fallback: colors.glassFallback },
  regular: { tint: 'systemMaterialDark', intensity: 75, fallback: colors.glassFallback },
  thick: { tint: 'systemThickMaterialDark', intensity: 90, fallback: colors.glassFallbackThick },
  chrome: { tint: 'systemChromeMaterialDark', intensity: 90, fallback: colors.glassFallbackThick },
} as const;

export type MaterialName = keyof typeof materials;

/** Sombra suave y amplia, la que usa iOS bajo las superficies flotantes. */
export const shadow: Record<'soft' | 'floating', ViewStyle> = {
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
};

/**
 * Escala tipográfica de Apple (Dynamic Type, tamaño por defecto), con el
 * tracking que aplica San Francisco a cada tamaño. En Android la misma escala
 * cae en Roboto.
 */
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.07 },
} satisfies Record<string, TextStyle>;

/**
 * Cifras grandes en la variante redondeada de San Francisco (la de Salud y
 * Fitness) y con dígitos de ancho fijo para que no bailen al cambiar.
 */
export const roundedNumbers: TextStyle = {
  fontVariant: ['tabular-nums'],
  ...(Platform.OS === 'ios' ? { fontFamily: 'ui-rounded' } : null),
};

/** Muelles de animación: el rebote corto de iOS al pulsar y al cambiar de valor. */
export const springs = {
  press: { speed: 40, bounciness: 0 },
  release: { speed: 22, bounciness: 8 },
  value: { speed: 14, bounciness: 2 },
} as const;

/** Un color hexadecimal con otra opacidad, en rgba. */
export function withAlpha(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
