import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LIMITS, clamp, type Settings } from '../core/settings';
import { Button, GlassSurface, ListGroup, ListRow, Stepper, Toggle } from './glass';
import { colors, radius, roundedNumbers, spacing, type } from './theme';

interface Props {
  visible: boolean;
  settings: Settings;
  detectionAvailable: boolean;
  /** Sesiones guardadas, para poder ofrecer borrarlas. */
  sessionCount: number;
  onChange: (patch: Partial<Settings>) => void;
  onClearHistory: () => void;
  onClose: () => void;
}

type NumericKey = 'thresholdDeg' | 'graceSeconds' | 'volume';

/**
 * Ajustes en una hoja de cristal al estilo de iOS: asa de arrastre, título
 * centrado con «Listo» a la derecha y las opciones en grupos con su nota al
 * pie, como en la app Ajustes.
 */
export function SettingsSheet({
  visible,
  settings,
  detectionAvailable,
  sessionCount,
  onChange,
  onClearHistory,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const bump = (key: NumericKey, direction: 1 | -1) => {
    const limits = LIMITS[key];
    // Redondeo al paso: 0,1 + 0,2 no debe acabar en 0,30000000000000004.
    const next = Math.round((settings[key] + direction * limits.step) / limits.step) * limits.step;
    onChange({ [key]: clamp(Number(next.toFixed(3)), limits.min, limits.max) });
  };

  const stepper = (key: NumericKey, label: string, value: string) => (
    <View style={styles.stepperRow}>
      <Text style={styles.value}>{value}</Text>
      <Stepper
        label={label}
        onDecrease={() => bump(key, -1)}
        onIncrease={() => bump(key, 1)}
        canDecrease={settings[key] > LIMITS[key].min}
        canIncrease={settings[key] < LIMITS[key].max}
      />
    </View>
  );

  const toggle = (key: 'easWithHeadphones' | 'easAlways' | 'voiceEnabled' | 'manualHeadphones' | 'vibrationEnabled' | 'notificationsEnabled' | 'keepAwake' | 'controlMode', label: string) => (
    <Toggle value={settings[key]} onValueChange={(next) => onChange({ [key]: next })} accessibilityLabel={label} />
  );

  const confirmClear = () =>
    Alert.alert(
      '¿Borrar el historial?',
      `Se eliminarán las ${sessionCount} sesiones guardadas y los resultados del experimento. No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: onClearHistory },
      ]
    );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar ajustes" />
        <GlassSurface material="thick" cornerRadius={radius.extraLarge} style={styles.sheet}>
          <View style={styles.grabberArea}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerSide} />
            <Text style={styles.title} accessibilityRole="header">
              Ajustes
            </Text>
            <View style={[styles.headerSide, styles.headerRight]}>
              <Button label="Listo" onPress={onClose} variant="plain" size="small" accessibilityLabel="Cerrar ajustes" />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}
            showsVerticalScrollIndicator={false}>
            <ListGroup
              header="Sensibilidad"
              footer="El umbral son los grados que te puedes inclinar respecto a la postura calibrada; el margen, cuánto aguantas así antes del pitido.">
              <ListRow
                title="Umbral de agachado"
                accessory={stepper('thresholdDeg', 'el umbral', `${Math.round(settings.thresholdDeg)}°`)}
              />
              <ListRow
                title="Margen antes del pitido"
                accessory={stepper('graceSeconds', 'el margen', `${settings.graceSeconds.toFixed(1).replace('.', ',')} s`)}
              />
            </ListGroup>

            <ListGroup
              header="Sonido"
              footer="Con auriculares suena el tono de emergencia EAS (853 + 960 Hz) directo a los oídos; por el altavoz, una sirena de dos tonos.">
              <ListRow title="Volumen" accessory={stepper('volume', 'el volumen', `${Math.round(settings.volume * 100)} %`)} />
              <ListRow title="Tono EAS con auriculares" accessory={toggle('easWithHeadphones', 'Tono EAS con auriculares')} />
              <ListRow title="Tono EAS siempre" subtitle="También por el altavoz" accessory={toggle('easAlways', 'Tono EAS siempre')} />
              <ListRow title="Voz: uno, dos, tres" accessory={toggle('voiceEnabled', 'Voz')} />
              {detectionAvailable ? null : (
                <ListRow
                  title="Llevo auriculares"
                  subtitle="Esta versión no los detecta sola"
                  accessory={toggle('manualHeadphones', 'Llevo auriculares')}
                />
              )}
            </ListGroup>

            <ListGroup
              header="Avisos"
              footer="Con la pantalla bloqueada el sistema apaga el acelerómetro: mantenerla encendida es lo que deja vigilar sin tocar el móvil.">
              <ListRow title="Vibración" accessory={toggle('vibrationEnabled', 'Vibración')} />
              <ListRow title="Notificación de alerta" accessory={toggle('notificationsEnabled', 'Notificación de alerta')} />
              <ListRow title="Mantener la pantalla encendida" accessory={toggle('keepAwake', 'Mantener la pantalla encendida')} />
            </ListGroup>

            <ListGroup
              header="Experimento"
              footer="Una sesión de control mide y registra igual, pero sin pitar, hablar ni vibrar. Es el grupo con el que comparar para saber si los avisos sirven.">
              <ListRow title="Sesión de control" accessory={toggle('controlMode', 'Sesión de control')} />
            </ListGroup>

            {sessionCount > 0 ? (
              <ListGroup>
                <Pressable
                  onPress={confirmClear}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.destructiveRow, pressed && styles.destructivePressed]}>
                  <Text style={styles.destructive}>Borrar las {sessionCount} sesiones guardadas</Text>
                </Pressable>
              </ListGroup>
            ) : null}
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  grabberArea: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs },
  grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: colors.tertiaryLabel },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    minHeight: 44,
  },
  headerSide: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  title: { ...type.headline, color: colors.label },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xxl, paddingTop: spacing.sm },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  value: { ...type.body, ...roundedNumbers, color: colors.secondaryLabel, minWidth: 52, textAlign: 'right' },
  destructiveRow: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  destructivePressed: { backgroundColor: colors.quaternaryFill },
  destructive: { ...type.body, color: colors.red },
});
