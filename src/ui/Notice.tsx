import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from './glass';
import { colors, spacing, type, withAlpha } from './theme';

interface Accion {
  label: string;
  onPress: () => void;
}

interface Props {
  tone: 'warn' | 'danger';
  title: string;
  body: string;
  actions?: Accion[];
}

const TONE = {
  warn: { color: colors.yellow, glyph: '!' },
  danger: { color: colors.red, glyph: '!' },
} as const;

/**
 * Aviso con acciones (sensor movido, calibración floja o fallida): cristal
 * teñido del color del aviso, un distintivo redondo a la izquierda y los
 * botones abajo, la primera acción destacada.
 */
export function Notice({ tone, title, body, actions = [] }: Props) {
  const { color, glyph } = TONE[tone];

  return (
    <Card tintColor={withAlpha(color, 0.12)} style={styles.card}>
      <View style={styles.header} accessible accessibilityRole="alert" accessibilityLabel={`${title}. ${body}`}>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeGlyph}>{glyph}</Text>
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((accion, index) => (
            <Button
              key={accion.label}
              label={accion.label}
              onPress={accion.onPress}
              size="small"
              variant={index === 0 ? 'prominent' : 'glass'}
              color={index === 0 ? color : undefined}
              onColor={colors.onStatus}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  badgeGlyph: { ...type.headline, color: colors.onStatus, fontWeight: '800' },
  text: { flex: 1, gap: 2 },
  title: { ...type.headline, color: colors.label },
  body: { ...type.subheadline, color: colors.secondaryLabel },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
});
