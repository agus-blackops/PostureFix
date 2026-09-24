import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { MESSAGES, type Phase } from '../core/postureEngine';
import { colors, roundedNumbers, spacing, type } from './theme';

interface Props {
  phase: Phase;
  /** Números ya cantados (1, 2 o 3) durante la cuenta atrás. */
  countsSpoken: number;
  /** En una sesión de control se mide sin avisar: tampoco por pantalla. */
  controlMode?: boolean;
}

/** Los dos colores entre los que parpadea cada pantalla, y el del texto. */
const FLASH = {
  countdown: { from: colors.tint, to: '#FFD9C2', text: colors.onTint },
  alarm: { from: colors.red, to: '#FFE3E0', text: '#1A0503' },
} as const;

/**
 * Capa a pantalla completa que acompaña al sonido: la cuenta «1 · 2 · 3» y,
 * después, el aviso parpadeante. Es la única parte de la app sin cristal:
 * parpadea alternando dos colores opacos para tapar la pantalla entera y que
 * el destello se vea desde lejos aunque el móvil esté en silencio.
 */
export function AlertOverlay({ phase, countsSpoken, controlMode = false }: Props) {
  // Dos animaciones: el color no puede ir por el hilo nativo, la escala sí.
  const flash = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(0)).current;
  const visible = !controlMode && (phase === 'countdown' || phase === 'alarm');

  useEffect(() => {
    if (!visible) {
      flash.setValue(0);
      beat.setValue(0);
      return;
    }
    const loop = (value: Animated.Value, useNativeDriver: boolean) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver }),
          Animated.timing(value, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        ])
      );
    const animations = [loop(flash, false), loop(beat, true)];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [beat, flash, visible]);

  if (!visible) {
    return null;
  }

  const isAlarm = phase === 'alarm';
  const palette = isAlarm ? FLASH.alarm : FLASH.countdown;
  const backgroundColor = flash.interpolate({ inputRange: [0, 1], outputRange: [palette.from, palette.to] });
  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { backgroundColor }]}
      accessibilityLiveRegion="assertive"
      accessibilityLabel={isAlarm ? `¡Enderézate! ${MESSAGES.notificationBody}` : `Cuenta atrás: ${Math.max(1, countsSpoken)}`}>
      {isAlarm ? (
        <>
          <Animated.Text
            style={[styles.title, { color: palette.text, transform: [{ scale }] }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            ¡ENDERÉZATE!
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, { color: palette.text }]}>{MESSAGES.notificationBody}</Animated.Text>
        </>
      ) : (
        <Animated.Text style={[styles.count, { color: palette.text, transform: [{ scale }] }]}>
          {Math.max(1, countsSpoken)}
        </Animated.Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    gap: spacing.lg,
  },
  title: { fontSize: 46, lineHeight: 52, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  subtitle: { ...type.title3, textAlign: 'center', maxWidth: 420 },
  count: { ...roundedNumbers, fontSize: 200, lineHeight: 220, fontWeight: '700' },
});
