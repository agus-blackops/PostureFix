import { StyleSheet, Text, View } from 'react-native';

import type { Phase } from '../core/postureEngine';
import { colors, phaseColors, radius, spacing } from './theme';

interface Props {
  deviationDeg: number;
  thresholdDeg: number;
  phase: Phase;
  /** 0-1: cuánto queda para que salte el pitido. */
  graceProgress: number;
}

const MAX_ANGLE = 70;

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'En pausa',
  ok: 'Postura correcta',
  slouching: 'Te estás agachando…',
  scare: '¡Enderézate!',
  countdown: 'Cuenta atrás',
  alarm: '¡ALERTA DE POSTURA!',
  cooldown: 'Recuperado',
};

/**
 * Indicador principal: el ángulo respecto a la postura calibrada, una barra con
 * el umbral marcado y el progreso del margen antes del pitido.
 */
export function PostureGauge({ deviationDeg, thresholdDeg, phase, graceProgress }: Props) {
  const color = phaseColors[phase] ?? colors.textMuted;
  const fill = Math.min(1, deviationDeg / MAX_ANGLE);
  const thresholdMark = Math.min(1, thresholdDeg / MAX_ANGLE);

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { borderColor: color }]}>
        <Text style={[styles.angle, { color }]}>{Math.round(deviationDeg)}°</Text>
        <Text style={styles.caption}>inclinación</Text>
      </View>

      <Text style={[styles.phase, { color }]}>{PHASE_LABEL[phase]}</Text>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${fill * 100}%`, backgroundColor: color }]} />
        <View style={[styles.threshold, { left: `${thresholdMark * 100}%` }]} />
      </View>
      <View style={styles.scale}>
        <Text style={styles.scaleText}>0°</Text>
        <Text style={styles.scaleText}>umbral {Math.round(thresholdDeg)}°</Text>
        <Text style={styles.scaleText}>{MAX_ANGLE}°</Text>
      </View>

      {graceProgress > 0 && phase === 'slouching' ? (
        <View style={styles.graceTrack}>
          <View style={[styles.graceFill, { width: `${Math.min(1, graceProgress) * 100}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, width: '100%' },
  circle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  angle: { fontSize: 56, fontWeight: '800', letterSpacing: -1 },
  caption: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  phase: { fontSize: 18, fontWeight: '700', marginTop: spacing.xs, textAlign: 'center' },
  barTrack: {
    width: '100%',
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: { height: '100%', borderRadius: radius.pill },
  threshold: { position: 'absolute', width: 2, height: '100%', backgroundColor: colors.text, opacity: 0.7 },
  scale: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  scaleText: { color: colors.textMuted, fontSize: 11 },
  graceTrack: {
    width: '100%',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  graceFill: { height: '100%', backgroundColor: colors.warn },
});
