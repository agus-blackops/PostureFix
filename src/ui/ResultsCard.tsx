import { StyleSheet, Text, View } from 'react-native';

import { compareModes, type SessionRecord } from '../core/sessionLog';
import { Card, LinearIndicator } from './material';
import { colors, spacing, type } from './theme';

interface Props {
  history: SessionRecord[];
}

const percent = (ratio: number) => `${(ratio * 100).toFixed(1)} %`;

/**
 * Resultados del experimento: cuánto tiempo se pasa encorvado con avisos frente
 * a las sesiones de control, que miden sin avisar. Va en una tarjeta elevada de
 * Material 3 con dos indicadores lineales comparables de un vistazo.
 */
export function ResultsCard({ history }: Props) {
  if (history.length === 0) {
    return null;
  }

  const { control, withAlerts, improvement } = compareModes(history);
  const rows = [
    { label: 'Sin avisos (control)', summary: control, color: colors.warning },
    { label: 'Con avisos', summary: withAlerts, color: colors.success },
  ];

  return (
    <Card variant="elevated">
      <Text style={styles.title}>Resultados</Text>

      {rows.map(({ label, summary, color }) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.bar}>
            <LinearIndicator progress={summary.badRatio} color={color} />
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
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...type.titleLarge, color: colors.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { ...type.bodySmall, color: colors.onSurfaceVariant, width: 112 },
  bar: { flex: 1 },
  value: { ...type.labelLarge, color: colors.onSurface, width: 58, textAlign: 'right' },
  conclusion: { ...type.bodyMedium, color: colors.onSurface, marginTop: spacing.xs },
  footnote: { ...type.bodySmall, color: colors.onSurfaceVariant },
});
