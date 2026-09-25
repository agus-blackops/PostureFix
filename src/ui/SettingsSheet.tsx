import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AlertLevel } from '../core/postureEngine';
import { LIMITS, clamp, type Settings } from '../core/settings';
import { ListGroup, ListRow, Stepper, Toggle } from './glass';
import { Sheet } from './Sheet';
import { Icon, Segmented, type SegmentOption } from './things';
import { colors, roundedNumbers, spacing, type } from './theme';

interface Props {
  visible: boolean;
  settings: Settings;
  detectionAvailable: boolean;
  /** Sesiones guardadas, para poder ofrecer borrarlas. */
  sessionCount: number;
  onChange: (patch: Partial<Settings>) => void;
  onClearHistory: () => void;
  onClose: () => void;
  /** Suscripción a Labs activa, para decirlo en su fila. */
  labsActive: boolean;
  onOpenLabs: () => void;
}

const LEVELS: readonly SegmentOption<AlertLevel>[] = [
  { value: 'beep', label: 'Pitido' },
  { value: 'count', label: 'Cuenta' },
  { value: 'alarm', label: 'Alarma' },
];

const LEVEL_NOTES: Record<AlertLevel, string> = {
  beep: 'Solo el pitido, y vuelve a pitar si sigues agachado. Para clase o la biblioteca.',
  count: 'Pitido y la cuenta «uno, dos, tres», pero sin sirena ni notificación.',
  alarm: 'La secuencia entera: pitido, cuenta y alarma hasta que te enderezas.',
};

type NumericKey = 'thresholdDeg' | 'graceSeconds' | 'volume';
type ToggleKey =
  | 'easWithHeadphones'
  | 'easAlways'
  | 'voiceEnabled'
  | 'manualHeadphones'
  | 'vibrationEnabled'
  | 'notificationsEnabled'
  | 'keepAwake'
  | 'controlMode'
  | 'uiHaptics';

/**
 * Ajustes en una hoja de cristal al estilo de iOS: asa de arrastre, título
 * centrado con «Listo» a la derecha y las opciones en grupos con su nota al
 * pie, como en la app Ajustes. La hoja sube con un muelle y se cierra
 * arrastrándola hacia abajo.
 */
export function SettingsSheet({
  visible,
  settings,
  detectionAvailable,
  sessionCount,
  onChange,
  onClearHistory,
  onClose,
  labsActive,
  onOpenLabs,
}: Props) {

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

  const toggle = (key: ToggleKey, label: string) => (
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
    <Sheet visible={visible} title="Ajustes" onClose={onClose}>
      <ListGroup>
        <Pressable
          onPress={onOpenLabs}
          accessibilityRole="button"
          accessibilityHint="Abre PostureFix Labs"
          style={({ pressed }) => [styles.labsRow, pressed && styles.rowPressed]}>
          <View style={styles.labsIcon}>
            <Icon name="flask" color={colors.onTint} size={18} />
          </View>
          <View style={styles.labsText}>
            <Text style={styles.labsTitle}>PostureFix Labs</Text>
            <Text style={styles.labsSubtitle}>
              {labsActive ? 'Suscripción activa' : 'Rachas, informe semanal y estiramientos'}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </ListGroup>

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

      <ListGroup header="Hasta dónde avisa" footer={LEVEL_NOTES[settings.maxAlertLevel]}>
        <View style={styles.segmentRow}>
          <Segmented
            options={LEVELS}
            value={settings.maxAlertLevel}
            onChange={(maxAlertLevel) => onChange({ maxAlertLevel })}
            accessibilityLabel="Hasta dónde avisa"
          />
        </View>
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

      <ListGroup header="Interfaz" footer="Un toque suave al pulsar botones, interruptores y casillas. No afecta a la vibración de las alertas.">
        <ListRow title="Toques al pulsar" accessory={toggle('uiHaptics', 'Toques al pulsar')} />
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
            style={({ pressed }) => [styles.destructiveRow, pressed && styles.rowPressed]}>
            <Text style={styles.destructive}>Borrar las {sessionCount} sesiones guardadas</Text>
          </Pressable>
        </ListGroup>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  value: { ...type.body, ...roundedNumbers, color: colors.secondaryLabel, minWidth: 52, textAlign: 'right' },
  segmentRow: { padding: spacing.md },
  labsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  labsIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  labsText: { flex: 1, gap: 2 },
  labsTitle: { ...type.body, fontWeight: '600', color: colors.label },
  labsSubtitle: { ...type.footnote, color: colors.secondaryLabel },
  chevron: { fontSize: 26, lineHeight: 28, color: colors.tertiaryLabel },
  rowPressed: { backgroundColor: colors.quaternaryFill },
  destructiveRow: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  destructive: { ...type.body, color: colors.red },
});
