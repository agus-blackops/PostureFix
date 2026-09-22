import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Tokens de Material Design 3 en tema oscuro, generados a partir del naranja de
 * PostureFix (#FF7A29) como color fuente. Los nombres son los roles de M3
 * (primary / onPrimary / primaryContainer…) para que cada componente pida el rol
 * que le toca en vez de un color suelto.
 *
 * M3 no define un rol «correcto/incorrecto», así que se añaden dos familias
 * propias con la misma forma: `success` (postura bien) y `warning` (te estás
 * agachando). Así la app tiene un único vocabulario de color.
 */
export const colors = {
  primary: '#FFB68F',
  onPrimary: '#542100',
  primaryContainer: '#78310A',
  onPrimaryContainer: '#FFDBC8',

  secondary: '#E7BFA8',
  onSecondary: '#442B1B',
  secondaryContainer: '#5D4130',
  onSecondaryContainer: '#FFDBC8',

  tertiary: '#CFC891',
  onTertiary: '#353108',
  tertiaryContainer: '#4C471D',
  onTertiaryContainer: '#ECE4AB',

  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',

  success: '#6FDB94',
  onSuccess: '#00391B',
  successContainer: '#00522A',
  onSuccessContainer: '#8BF8AE',

  warning: '#F5BD4B',
  onWarning: '#412D00',
  warningContainer: '#5D4200',
  onWarningContainer: '#FFDEA6',

  surface: '#1A120D',
  onSurface: '#F1DFD6',
  onSurfaceVariant: '#D8C2B6',
  surfaceContainerLowest: '#120B07',
  surfaceContainerLow: '#221A15',
  surfaceContainer: '#271E19',
  surfaceContainerHigh: '#322823',
  surfaceContainerHighest: '#3D332D',

  outline: '#A08D82',
  outlineVariant: '#53433B',

  inverseSurface: '#F1DFD6',
  inverseOnSurface: '#392E28',
  scrim: '#000000',
} as const;

/** Color de rol para cada fase del motor de alertas. */
export const phaseColors: Record<string, string> = {
  idle: colors.onSurfaceVariant,
  ok: colors.success,
  slouching: colors.warning,
  scare: colors.primary,
  countdown: colors.primary,
  alarm: colors.error,
  cooldown: colors.success,
};

/** Escala de formas de M3: de la esquina apenas rota al contenedor de píldora. */
export const shape = {
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 999,
} as const;

/** Rejilla de 4 dp de Material. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Elevación de M3. En Android la sombra la pinta el sistema con `elevation`; en
 * iOS hay que describirla, así que cada nivel lleva las dos recetas.
 */
export const elevation: Record<'level0' | 'level1' | 'level2' | 'level3', ViewStyle> = {
  level0: {},
  level1: {
    elevation: 1,
    shadowColor: colors.scrim,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  level2: {
    elevation: 3,
    shadowColor: colors.scrim,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  level3: {
    elevation: 6,
    shadowColor: colors.scrim,
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
};

/**
 * Escala tipográfica de M3, recortada a los estilos que usa la app. Los pesos
 * van como literales para que TypeScript los acepte como `TextStyle`.
 */
export const type = {
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: '400', letterSpacing: -0.25 },
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: '400' },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '400' },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '400' },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '500' },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.5 },
} satisfies Record<string, TextStyle>;

/**
 * Capa de estado de M3: el color del contenido sobre el del contenedor con poca
 * opacidad (8 % al pasar por encima, 12 % al pulsar). Se devuelve en rgba para
 * poder superponerla sin tocar el color de fondo.
 */
export function stateLayer(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const STATE_PRESSED = 0.12;
export const STATE_HOVER = 0.08;
