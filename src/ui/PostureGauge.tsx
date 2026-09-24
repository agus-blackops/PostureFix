import { StyleSheet, Text, View } from 'react-native';

import type { Phase } from '../core/postureEngine';
import { formatDegrees } from '../core/format';
import { BigNumber, ProgressBar, ProgressRing } from './glass';
import { colors, phaseColors, radius, spacing, type, withAlpha } from './theme';

interface Props {
  deviationDeg: number;
  thresholdDeg: number;
  phase: Phase;
  /** 0-1: cuánto queda para que salte el pitido. */
  graceProgress: number;
  /** Segundos de margen, para decir cuánto falta en vez de solo enseñarlo. */
  graceSeconds: number;
  /** En una sesión de control se registra la mala postura sin anunciarla. */
  controlMode?: boolean;
}

/** Ángulo que llena el anillo entero. */
export const MAX_ANGLE = 70;

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'En pausa',
  ok: 'Postura correcta',
  slouching: 'Te estás agachando',
  scare: '¡Enderézate!',
  countdown: 'Cuenta atrás',
  alarm: '¡Alerta de postura!',
  cooldown: 'Recuperado',
};

/**
 * Indicador principal: un anillo al estilo de Actividad que se llena con la
 * inclinación, con una marca blanca en el umbral y la cifra en grande en el
 * centro. Debajo, el estado en una cápsula y, mientras te agachas, cuánto
 * falta para el pitido.
 */
export function PostureGauge({
  deviationDeg,
  thresholdDeg,
  phase,
  graceProgress,
  graceSeconds,
  controlMode = false,
}: Props) {
  const alerting = phase === 'scare' || phase === 'countdown' || phase === 'alarm';
  // En control no conviene ni el rótulo rojo: el usuario lo leería como aviso.
  const color = controlMode && alerting ? colors.yellow : (phaseColors[phase] ?? colors.neutral);
  const label = controlMode && alerting ? 'Mala postura registrada (sin avisar)' : PHASE_LABEL[phase];
  const graceLeft = Math.max(0, (1 - graceProgress) * graceSeconds);
  const showGrace = graceProgress > 0 && phase === 'slouching';

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Inclinación ${Math.round(deviationDeg)} grados, umbral ${Math.round(thresholdDeg)}. ${label}.`}
      accessibilityLiveRegion="polite">
      <ProgressRing
        size={228}
        stroke={20}
        progress={deviationDeg / MAX_ANGLE}
        color={color}
        trackColor={withAlpha(color, 0.18)}
        markAt={thresholdDeg / MAX_ANGLE}>
        <BigNumber color={colors.label} size={60}>
          {formatDegrees(deviationDeg)}
        </BigNumber>
        <Text style={styles.caption}>de inclinación</Text>
      </ProgressRing>

      <View style={[styles.phase, { backgroundColor: withAlpha(color, 0.16) }]}>
        <View style={[styles.phaseDot, { backgroundColor: color }]} />
        <Text style={[styles.phaseLabel, { color }]}>{label}</Text>
      </View>

      {showGrace ? (
        <View style={styles.grace}>
          <Text style={styles.graceText}>
            Pitido en {graceLeft.toFixed(1).replace('.', ',')} s si no te enderezas
          </Text>
          <ProgressBar progress={graceProgress} color={colors.yellow} height={6} />
        </View>
      ) : (
        <Text style={styles.hint}>
          Umbral {formatDegrees(thresholdDeg)} · la marca blanca del anillo
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.lg, width: '100%', paddingVertical: spacing.sm },
  caption: { ...type.subheadline, color: colors.secondaryLabel, marginTop: -2 },
  phase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.capsule,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseLabel: { ...type.headline, textAlign: 'center' },
  grace: { width: '100%', gap: spacing.sm },
  graceText: { ...type.footnote, color: colors.secondaryLabel, textAlign: 'center' },
  hint: { ...type.footnote, color: colors.tertiaryLabel, textAlign: 'center' },
});
