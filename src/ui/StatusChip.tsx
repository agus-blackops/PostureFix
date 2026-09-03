import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from './theme';

interface Props {
  label: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
}

const toneColor = {
  neutral: colors.textMuted,
  good: colors.good,
  warn: colors.warn,
  danger: colors.danger,
};

/** Etiqueta compacta para estados: auriculares, sensor, tipo de alarma... */
export function StatusChip({ label, tone = 'neutral' }: Props) {
  return (
    <View style={[styles.chip, { borderColor: toneColor[tone] }]}>
      <View style={[styles.dot, { backgroundColor: toneColor[tone] }]} />
      <Text style={[styles.label, { color: toneColor[tone] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
  },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  label: { fontSize: 12, fontWeight: '600' },
});
