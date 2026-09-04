import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

import { MESSAGES, type Phase } from '../core/postureEngine';
import { colors, spacing } from './theme';

interface Props {
  phase: Phase;
  /** Números ya cantados (1, 2 o 3) durante la cuenta atrás. */
  countsSpoken: number;
  /** En una sesión de control se mide sin avisar: tampoco por pantalla. */
  controlMode?: boolean;
}

/**
 * Capa a pantalla completa que acompaña al sonido: la cuenta "1 · 2 · 3" y,
 * después, el aviso rojo parpadeante. La idea es que sea imposible ignorarla
 * aunque el móvil esté en silencio.
 */
export function AlertOverlay({ phase, countsSpoken, controlMode = false }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const visible = !controlMode && (phase === 'countdown' || phase === 'alarm');

  useEffect(() => {
    if (!visible) {
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 380, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 380, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, visible]);

  if (!visible) {
    return null;
  }

  const isAlarm = phase === 'alarm';
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: isAlarm ? [0.82, 0.98] : [0.7, 0.9] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { backgroundColor: isAlarm ? colors.danger : colors.accent, opacity }]}>
      {isAlarm ? (
        <>
          <Text style={styles.title}>¡ENDERÉZATE!</Text>
          <Text style={styles.subtitle}>{MESSAGES.notificationBody}</Text>
        </>
      ) : (
        <Animated.Text style={[styles.count, { transform: [{ scale }] }]}>
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
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { color: '#fff', fontSize: 46, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  subtitle: { color: '#fff', fontSize: 18, textAlign: 'center', fontWeight: '600' },
  count: { color: '#fff', fontSize: 190, fontWeight: '900' },
});
