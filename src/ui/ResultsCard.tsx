import { StyleSheet, Text, View } from 'react-native';

import { compareModes, type SessionRecord } from '../core/sessionLog';
import { colors, radius, spacing } from './theme';

interface Props {
  history: SessionRecord[];
}

const percent = (ratio: number) => `${(ratio * 100).toFixed(1)} %`;

/**
 * Resultados del experimento: cuánto tiempo se pasa encorvado con avisos frente
 * a las sesiones de control, que miden sin avisar.
 */
export function ResultsCard({ history }: Props) {
  if (history.length === 0) {
    return null;
  }

  const { control, withAlerts, improvement } = compareModes(history);
  const rows = [
    { label: 'Sin avisos (control)', summary: control, color: colors.warn },
    { label: 'Con avisos', summary: withAlerts, color: colors.good },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Resultados</Text>

      {rows.map(({ label, summary, color }) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, summary.badRatio * 100)}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.value}>{summary.sessions > 0 ? percent(summary.badRatio) : '—'}</Text>
        </View>
      ))}

      <Text style={styles.conclusion}>
        {improvement == null
          ? `Faltan datos para comparar: ${control.sessions} sesión(es) de control y ${withAlerts.sessions} con avisos.`
          : improvement > 0
            ? `Con los avisos se pasa un ${percent(improvement)} menos de tiempo encorvado.`
            : `Con los avisos no baja el tiempo encorvado (${percent(-improvement)} más).`}
      </Text>
      <Text style={styles.footnote}>
        {history.length} sesión(es) guardada(s) · la barra es el porcentaje del tiempo encorvado
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 12, width: 110 },
  track: { flex: 1, height: 16, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm },
  value: { color: colors.text, fontSize: 13, fontWeight: '700', width: 58, textAlign: 'right' },
  conclusion: { color: colors.text, fontSize: 14, lineHeight: 20 },
  footnote: { color: colors.textMuted, fontSize: 11 },
});
