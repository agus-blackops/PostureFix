import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { MESSAGES, type Phase } from '../core/postureEngine';
import { colors, spacing, type } from './theme';

interface Props {
  phase: Phase;
  /** Números ya cantados (1, 2 o 3) durante la cuenta atrás. */
  countsSpoken: number;
  /** En una sesión de control se mide sin avisar: tampoco por pantalla. */
  controlMode?: boolean;
}

/**
 * Capa a pantalla completa que acompaña al sonido: la cuenta «1 · 2 · 3» y,
 * después, el aviso parpadeante. Usa los roles de color de Material 3 a toda
 * pantalla (primary para la cuenta, error para la alarma) y parpadea alternando
 * dos colores opacos, no bajando la opacidad: así tapa la app entera y el
 * destello se ve desde lejos aunque el móvil esté en silencio.
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
          Animated.timing(value, { toValue: 1, duration: 380, easing: Easing.linear, useNativeDriver }),
          Animated.timing(value, { toValue: 0, duration: 380, easing: Easing.linear, useNativeDriver }),
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
  const foreground = isAlarm ? colors.onError : colors.onPrimary;
  const backgroundColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: isAlarm
      ? [colors.error, colors.onErrorContainer]
      : [colors.primary, colors.onPrimaryContainer],
  });
  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { backgroundColor }]}>
      {isAlarm ? (
        <>
          <Animated.Text style={[styles.title, { color: foreground, transform: [{ scale }] }]}>
            ¡ENDERÉZATE!
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, { color: foreground }]}>
            {MESSAGES.notificationBody}
          </Animated.Text>
        </>
      ) : (
        <Animated.Text style={[styles.count, { color: foreground, transform: [{ scale }] }]}>
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
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  title: { ...type.displayMedium, fontWeight: '700', textAlign: 'center', letterSpacing: 1 },
  subtitle: { ...type.titleMedium, textAlign: 'center', maxWidth: 420 },
  count: { fontSize: 190, lineHeight: 210, fontWeight: '500' },
});
