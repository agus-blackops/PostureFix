import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { continuous, makeStyles, radius, spacing, useTheme, withAlpha, type MaterialName } from '../theme';

/**
 * Superficies de cristal. En iOS 26, Liquid Glass de verdad; en iOS anterior,
 * los materiales de desenfoque de UIKit; en Android, un cristal translúcido
 * con su filo de luz. Las tres siguen el tema claro u oscuro.
 */

export const LIQUID_GLASS = (() => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

const useStyles = makeStyles((t) => ({
  clip: { overflow: 'hidden' },
  edge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.glassEdge,
    borderTopColor: t.colors.glassHighlight,
  },
  card: { padding: spacing.xl, gap: spacing.md },
  background: { backgroundColor: t.colors.background },
}));

export function GlassSurface({
  children,
  material = 'regular',
  cornerRadius = radius.large,
  tintColor,
  interactive = false,
  style,
}: {
  children?: ReactNode;
  material?: MaterialName;
  cornerRadius?: number;
  tintColor?: string;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const shape: StyleProp<ViewStyle> = [{ borderRadius: cornerRadius }, continuous, styles.clip];

  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={theme.dark ? 'dark' : 'light'}
        tintColor={tintColor}
        isInteractive={interactive}
        style={[shape, style]}>
        {children}
      </GlassView>
    );
  }

  const spec = theme.materials[material];
  return (
    <View style={[shape, styles.edge, Platform.OS === 'android' && { backgroundColor: spec.fallback }, style]}>
      {Platform.OS === 'android' ? null : (
        <BlurView tint={spec.tint} intensity={spec.intensity} style={StyleSheet.absoluteFill} pointerEvents="none" />
      )}
      {tintColor ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} /> : null}
      {children}
    </View>
  );
}

/** Relleno de cristal sin forma propia: lo recorta su contenedor (los botones). */
export function GlassFill({ material = 'thin' }: { material?: MaterialName }) {
  const theme = useTheme();
  if (LIQUID_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme={theme.dark ? 'dark' : 'light'} isInteractive style={StyleSheet.absoluteFill} />
    );
  }
  const spec = theme.materials[material];
  if (Platform.OS === 'android') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: spec.fallback }]} />;
  }
  return <BlurView tint={spec.tint} intensity={spec.intensity} style={StyleSheet.absoluteFill} pointerEvents="none" />;
}

export function Card({
  children,
  material = 'regular',
  tintColor,
  style,
}: {
  children: ReactNode;
  material?: MaterialName;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <GlassSurface material={material} tintColor={tintColor} style={[styles.card, style]}>
      {children}
    </GlassSurface>
  );
}

/** El degradado va por la propiedad nativa en iOS/Android y por CSS en la web. */
const gradientStyle = (image: string): ViewStyle =>
  (Platform.OS === 'web' ? { backgroundImage: image } : { experimental_backgroundImage: image }) as ViewStyle;

/**
 * Fondo de la app: dos resplandores sobre el color de fondo del tema. El de
 * arriba es el naranja de la marca; el de abajo toma el color del estado y
 * cambia con un fundido cuando cambia `accent`.
 */
export function Background({ accent }: { accent: string }) {
  const theme = useTheme();
  const styles = useStyles();
  const fade = useRef(new Animated.Value(1)).current;
  const previous = useRef(accent);
  const shown = useRef({ from: accent, to: accent });

  if (previous.current !== accent) {
    shown.current = { from: previous.current, to: accent };
    previous.current = accent;
    fade.setValue(0);
  }

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [accent, fade]);

  const glow = (color: string) =>
    `radial-gradient(circle at 90% 100%, ${withAlpha(color, theme.glow.accent)} 0%, ${withAlpha(color, 0)} 60%)`;
  const base = `radial-gradient(circle at 0% 0%, ${withAlpha(theme.colors.tint, theme.glow.base)} 0%, ${withAlpha(
    theme.colors.tint,
    0
  )} 55%)`;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.background]}>
      <View style={[StyleSheet.absoluteFill, gradientStyle(base)]} />
      <View style={[StyleSheet.absoluteFill, gradientStyle(glow(shown.current.from))]} />
      <Animated.View style={[StyleSheet.absoluteFill, gradientStyle(glow(shown.current.to)), { opacity: fade }]} />
    </View>
  );
}
