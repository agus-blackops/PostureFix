import { StyleSheet, Text, View } from 'react-native';

import { formatPercent } from '../core/format';
import { compareModes, type SessionRecord } from '../core/sessionLog';
import { Card, ProgressBar } from './glass';
import { colors, roundedNumbers, spacing, type } from './theme';

interface Props {
  history: SessionRecord[];
}

/**
 * Resultados del experimento: cuánto tiempo se pasa encorvado con avisos frente
 * a las sesiones de control, que miden sin avisar. Dos barras comparables de un
 * vistazo y la conclusión en una frase.
 */
export function ResultsCard({ history }: Props) {
  if (history.length === 0) {
    return null;
  }

  const { control, withAlerts, improvement } = compareModes(history);
  const rows = [
    { label: 'Sin avisos (control)', summary: control, color: colors.yellow },
    { label: 'Con avisos', summary: withAlerts, color: colors.green },
  ];

  return (
    <Card>
      <Text style={styles.title} accessibilityRole="header">
        Resultados
      </Text>
      <Text style={styles.subtitle}>Tiempo que pasas encorvado</Text>

      {rows.map(({ label, summary, color }) => (
        <View key={label} style={styles.row}>
          <View style={styles.rowHeader}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, { color: summary.sessions > 0 ? color : colors.tertiaryLabel }]}>
              {summary.sessions > 0 ? formatPercent(summary.badRatio) : '—'}
            </Text>
          </View>
          <ProgressBar progress={summary.badRatio} color={color} height={10} />
        </View>
      ))}

      <Text style={styles.conclusion}>
        {improvement == null
          ? `Faltan datos para comparar: ${control.sessions} sesión(es) de control y ${withAlerts.sessions} con avisos.`
          : improvement > 0
            ? `Con los avisos pasas un ${formatPercent(improvement)} menos de tiempo encorvado.`
            : `Con los avisos no baja el tiempo encorvado (${formatPercent(-improvement)} más).`}
      </Text>
      <Text style={styles.footnote}>{history.length} sesión(es) guardada(s)</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title3, color: colors.label },
  subtitle: { ...type.subheadline, color: colors.secondaryLabel, marginTop: -spacing.sm },
  row: { gap: spacing.sm },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { ...type.subheadline, color: colors.label },
  value: { ...type.headline, ...roundedNumbers },
  conclusion: { ...type.callout, color: colors.label, marginTop: spacing.xs },
  footnote: { ...type.footnote, color: colors.tertiaryLabel },
});
