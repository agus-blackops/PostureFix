import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

import type { ThemeMode } from '../core/settings';
import { DARK, LIGHT, type Palette } from './palettes';

/**
 * Tema de la 2.0. Los colores dependen del modo (claro u oscuro), así que no
 * se importan como constantes: se piden con `useTheme()` y los estilos se
 * crean con `makeStyles`, que los recalcula una vez por tema.
 */

type BlurTint =
  | 'systemThinMaterialDark'
  | 'systemMaterialDark'
  | 'systemThickMaterialDark'
  | 'systemThinMaterialLight'
  | 'systemMaterialLight'
  | 'systemThickMaterialLight';

export interface Material {
  tint: BlurTint;
  intensity: number;
  fallback: string;
}

export interface Theme {
  dark: boolean;
  colors: Palette;
  materials: Record<'thin' | 'regular' | 'thick', Material>;
  /** Intensidad de los resplandores del fondo. */
  glow: { base: number; accent: number };
}

export type MaterialName = keyof Theme['materials'];

const make = (dark: boolean): Theme => {
  const colors = dark ? DARK : LIGHT;
  const suffix = dark ? 'Dark' : 'Light';
  return {
    dark,
    colors,
    materials: {
      thin: { tint: `systemThinMaterial${suffix}` as BlurTint, intensity: dark ? 60 : 70, fallback: colors.glassFallback },
      regular: { tint: `systemMaterial${suffix}` as BlurTint, intensity: dark ? 75 : 80, fallback: colors.glassFallback },
      thick: { tint: `systemThickMaterial${suffix}` as BlurTint, intensity: 90, fallback: colors.glassFallbackThick },
    },
    glow: dark ? { base: 0.17, accent: 0.24 } : { base: 0.16, accent: 0.2 },
  };
};

export const DARK_THEME = make(true);
export const LIGHT_THEME = make(false);

const ThemeContext = createContext<Theme>(DARK_THEME);

export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'system' && system !== 'light');
  return <ThemeContext.Provider value={dark ? DARK_THEME : LIGHT_THEME}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Estilos que dependen del tema: se crean una vez por tema y se reutilizan. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T): () => T {
  const cache = new Map<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => {
      let styles = cache.get(theme);
      if (!styles) {
        styles = StyleSheet.create(factory(theme));
        cache.set(theme, styles);
      }
      return styles;
    }, [theme]);
  };
}

// ------------------------------------------------- medidas comunes a los dos temas ---

export const radius = { small: 10, medium: 14, large: 22, extraLarge: 30, capsule: 999 } as const;

/** Esquinas continuas de iOS; Android lo ignora sin romper nada. */
export const continuous: ViewStyle = { borderCurve: 'continuous' };

/** Rejilla de 4 pt. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;

/** Escala de Dynamic Type de Apple. */
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

/** Cifras en San Francisco redondeada, de ancho fijo para que no bailen. */
export const roundedNumbers: TextStyle = {
  fontVariant: ['tabular-nums'],
  ...(Platform.OS === 'ios' ? { fontFamily: 'ui-rounded' } : null),
};

/** Un color hexadecimal con otra opacidad, en rgba. */
export function withAlpha(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

/** Color de estado para cada fase del motor de avisos. */
export function phaseColor(colors: Palette, phase: string, controlMode: boolean): string {
  switch (phase) {
    case 'ok':
    case 'cooldown':
      return colors.green;
    case 'slouching':
      return colors.yellow;
    case 'scare':
    case 'countdown':
      return controlMode ? colors.yellow : colors.tint;
    case 'alarm':
      return controlMode ? colors.yellow : colors.red;
    default:
      return colors.neutral;
  }
}

/** Sombras: en claro, más suaves y del color del fondo; en oscuro, negras. */
export function shadowFor(theme: Theme, kind: 'tiny' | 'soft' | 'button', color?: string): ViewStyle {
  switch (kind) {
    case 'tiny':
      return {
        shadowColor: '#000000',
        shadowOpacity: theme.dark ? 0.2 : 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      };
    case 'soft':
      return {
        shadowColor: theme.dark ? '#000000' : '#5A3A28',
        shadowOpacity: theme.dark ? 0.28 : 0.1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      };
    case 'button':
      return {
        shadowColor: color ?? theme.colors.tint,
        shadowOpacity: theme.dark ? 0.4 : 0.3,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      };
  }
}
