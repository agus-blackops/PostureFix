import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

import { MESSAGES, type Phase } from '../core/postureEngine';
import { roundedNumbers, spacing, type } from '../theme';
import { MorphShape } from './indicators';

/**
 * La cuenta «1 · 2 · 3» y la alarma a pantalla completa. Es lo único que no
 * cambia con el tema: parpadea entre dos colores opacos para que el destello
 * se vea desde lejos aunque el móvil esté en silencio.
 */
const FLASH = {
  countdown: { from: '#FF7A29', to: '#FFD9C2', text: '#1F0C02' },
  alarm: { from: '#FF453A', to: '#FFE3E0', text: '#1A0503' },
} as const;

export function AlertOverlay({ phase, countsSpoken, controlMode }: { phase: Phase; countsSpoken: number; controlMode: boolean }) {
  const flash = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(0)).current;
  const visible = !controlMode && (phase === 'countdown' || phase === 'alarm');
  const { width } = useWindowDimensions();
  // El titular cabe en una línea en cualquier pantalla: el tamaño sale del ancho.
  const titleSize = Math.min(46, Math.floor((width - spacing.xxxl * 2) / 7.8));

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

  if (!visible) return null;

  const palette = phase === 'alarm' ? FLASH.alarm : FLASH.countdown;
  const backgroundColor = flash.interpolate({ inputRange: [0, 1], outputRange: [palette.from, palette.to] });
  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const count = Math.max(1, Math.min(3, countsSpoken));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor }]} accessibilityLiveRegion="assertive" pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.center]}>
        <MorphShape shape={phase === 'alarm' ? 'burst12' : 'flower8'} size={340} color="rgba(0, 0, 0, 0.08)" spin={phase === 'alarm' ? 0.35 : 0.15} />
      </Animated.View>
      <Animated.Text
        style={[
          phase === 'alarm' ? [styles.alarmTitle, { fontSize: titleSize, lineHeight: titleSize * 1.15 }] : styles.count,
          { color: palette.text, transform: [{ scale }] },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityRole="header">
        {phase === 'alarm' ? '¡ENDERÉZATE!' : MESSAGES.counts[count - 1].toUpperCase()}
      </Animated.Text>
      {phase === 'countdown' ? <Animated.Text style={[styles.countNumber, { color: palette.text }]}>{count}</Animated.Text> : null}
      <Animated.Text style={[styles.subtitle, { color: palette.text }]}>
        {phase === 'alarm' ? 'Ponte recto y la alarma se apaga sola.' : 'Endereza la espalda antes del tres.'}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, gap: spacing.md, zIndex: 100 },
  center: { alignItems: 'center', justifyContent: 'center' },
  alarmTitle: { fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  count: { ...type.title1, fontWeight: '800', letterSpacing: 2 },
  countNumber: { ...roundedNumbers, fontSize: 168, lineHeight: 180, fontWeight: '800' },
  subtitle: { ...type.headline, textAlign: 'center', opacity: 0.85 },
});
