import { StyleSheet, Text, View } from 'react-native';

import { Button } from './material';
import { colors, shape, spacing, type } from './theme';

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

/**
 * Aviso con acciones (sensor movido, calibración inestable) con la forma del
 * banner de Material 3: contenedor de color del rol, texto encima y los botones
 * de texto alineados a la derecha.
 */
export function Notice({ tone, title, body, actions = [] }: Props) {
  const container = tone === 'danger' ? colors.errorContainer : colors.warningContainer;
  const onContainer = tone === 'danger' ? colors.onErrorContainer : colors.onWarningContainer;

  return (
    <View style={[styles.banner, { backgroundColor: container }]}>
      <Text style={[styles.title, { color: onContainer }]}>{title}</Text>
      <Text style={[styles.body, { color: onContainer }]}>{body}</Text>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((accion) => (
            <Button
              key={accion.label}
              label={accion.label}
              onPress={accion.onPress}
              variant="text"
              color={onContainer}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: shape.large,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: { ...type.titleMedium },
  body: { ...type.bodyMedium, opacity: 0.92 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
});
