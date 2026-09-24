import { StyleSheet, Text, View } from 'react-native';

import type { Phase } from '../core/postureEngine';
import { formatDegrees } from '../core/format';
import { expressionFor } from '../core/expression';
import { LoadingIndicator, MorphShape, Pop, WavyRing } from './expressive';
import { BigNumber, ProgressBar } from './glass';
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
  /** Mientras se calibra, el centro enseña un indicador de carga. */
  calibrating?: boolean;
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
 * Indicador principal: el anillo ondulado de Material 3 Expressive se llena
 * con la inclinación y su onda crece con la urgencia; la marca blanca es el
 * umbral. En el centro, la cifra sobre una forma que cambia con el estado.
 * Debajo, el estado en una cápsula y, mientras te agachas, cuánto falta para
 * el pitido.
 */
export function PostureGauge({
  deviationDeg,
  thresholdDeg,
  phase,
  graceProgress,
  graceSeconds,
  controlMode = false,
  calibrating = false,
}: Props) {
  const alerting = phase === 'scare' || phase === 'countdown' || phase === 'alarm';
  // En control no conviene ni el rótulo rojo: el usuario lo leería como aviso.
  const color = controlMode && alerting ? colors.yellow : (phaseColors[phase] ?? colors.neutral);
  const label = controlMode && alerting ? 'Mala postura registrada (sin avisar)' : PHASE_LABEL[phase];
  const graceLeft = Math.max(0, (1 - graceProgress) * graceSeconds);
  const showGrace = graceProgress > 0 && phase === 'slouching';
  const { urgency, shape } = expressionFor(phase, controlMode);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Inclinación ${Math.round(deviationDeg)} grados, umbral ${Math.round(thresholdDeg)}. ${label}.`}
      accessibilityLiveRegion="polite">
      <WavyRing
        size={236}
        stroke={16}
        progress={deviationDeg / MAX_ANGLE}
        color={color}
        trackColor={withAlpha(color, 0.18)}
        markAt={thresholdDeg / MAX_ANGLE}
        urgency={urgency}>
        <View style={styles.shape}>
          <MorphShape shape={calibrating ? 'circle' : shape} size={148} color={withAlpha(color, 0.12)} spin={urgency * 0.25} />
        </View>
        {calibrating ? (
          <>
            <LoadingIndicator size={56} color={colors.tint} />
            <Text style={styles.caption}>No te muevas…</Text>
          </>
        ) : (
          <>
            <BigNumber color={colors.label} size={60}>
              {formatDegrees(deviationDeg)}
            </BigNumber>
            <Text style={styles.caption}>de inclinación</Text>
          </>
        )}
      </WavyRing>

      <Pop trigger={label}>
        <View style={[styles.phase, { backgroundColor: withAlpha(color, 0.16) }]}>
          <View style={[styles.phaseDot, { backgroundColor: color }]} />
          <Text style={[styles.phaseLabel, { color }]}>{label}</Text>
        </View>
      </Pop>

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
  shape: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
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
