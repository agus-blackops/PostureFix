import { StyleSheet, Text, View } from 'react-native';

import type { Phase } from '../core/postureEngine';
import { LinearIndicator } from './material';
import { colors, phaseColors, shape, spacing, stateLayer, type } from './theme';

interface Props {
  deviationDeg: number;
  thresholdDeg: number;
  phase: Phase;
  /** 0-1: cuánto queda para que salte el pitido. */
  graceProgress: number;
  /** En una sesión de control se registra la mala postura sin anunciarla. */
  controlMode?: boolean;
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
 * Indicador principal, con la forma del progreso circular de Material 3: el
 * ángulo respecto a la postura calibrada dentro de un anillo, el estado en
 * texto y debajo la barra lineal con la marca del umbral.
 */
export function PostureGauge({ deviationDeg, thresholdDeg, phase, graceProgress, controlMode = false }: Props) {
  const alerting = phase === 'scare' || phase === 'countdown' || phase === 'alarm';
  // En control no conviene ni el rótulo rojo: el usuario lo leería como aviso.
  const color = controlMode && alerting ? colors.warning : (phaseColors[phase] ?? colors.onSurfaceVariant);
  const fill = Math.min(1, deviationDeg / MAX_ANGLE);
  const thresholdMark = Math.min(1, thresholdDeg / MAX_ANGLE);

  return (
    <View style={styles.container}>
      <View style={[styles.ringTrack, { borderColor: stateLayer(color, 0.18) }]}>
        <View style={[styles.ring, { borderColor: color }]}>
          <Text style={[styles.angle, { color }]}>{Math.round(deviationDeg)}°</Text>
          <Text style={styles.caption}>inclinación</Text>
        </View>
      </View>

      <View style={[styles.phasePill, { backgroundColor: stateLayer(color, 0.16) }]}>
        <Text style={[styles.phase, { color }]}>
          {controlMode && alerting ? 'Mala postura registrada (sin avisar)' : PHASE_LABEL[phase]}
        </Text>
      </View>

      <LinearIndicator progress={fill} color={color} markAt={thresholdMark} />
      <View style={styles.scale}>
        <Text style={styles.scaleText}>0°</Text>
        <Text style={styles.scaleText}>umbral {Math.round(thresholdDeg)}°</Text>
        <Text style={styles.scaleText}>{MAX_ANGLE}°</Text>
      </View>

      {graceProgress > 0 && phase === 'slouching' ? (
        <LinearIndicator progress={graceProgress} color={colors.warning} thin />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md, width: '100%' },
  ringTrack: {
    width: 204,
    height: 204,
    borderRadius: 102,
    borderWidth: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 182,
    height: 182,
    borderRadius: 91,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLow,
  },
  angle: { ...type.displayLarge, fontWeight: '500' },
  caption: { ...type.labelMedium, color: colors.onSurfaceVariant },
  phasePill: {
    borderRadius: shape.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  phase: { ...type.titleMedium, textAlign: 'center' },
  scale: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  scaleText: { ...type.labelSmall, color: colors.onSurfaceVariant, fontWeight: '400' },
});
