import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from './theme';

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

/** Aviso con acciones: sensor movido, calibración inestable y similares. */
export function Notice({ tone, title, body, actions = [] }: Props) {
  const color = tone === 'danger' ? colors.danger : colors.warn;
  return (
    <View style={[styles.card, { borderColor: color }]}>
      <Text style={[styles.title, { color }]}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((accion) => (
            <Pressable
              key={accion.label}
              onPress={accion.onPress}
              style={({ pressed }) => [styles.button, { borderColor: color, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.buttonText, { color }]}>{accion.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: { fontSize: 15, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  button: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  buttonText: { fontSize: 14, fontWeight: '700' },
});
