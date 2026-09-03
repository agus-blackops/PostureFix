import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { LIMITS, clamp, type Settings } from '../core/settings';
import { colors, radius, spacing } from './theme';

interface Props {
  visible: boolean;
  settings: Settings;
  detectionAvailable: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

interface StepperProps {
  label: string;
  hint?: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}

function Stepper({ label, hint, value, onDecrease, onIncrease }: StepperProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.stepper}>
        <Pressable accessibilityLabel={`Bajar ${label}`} onPress={onDecrease} style={styles.stepButton}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable accessibilityLabel={`Subir ${label}`} onPress={onIncrease} style={styles.stepButton}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
      />
    </View>
  );
}

/** Panel de ajustes: sensibilidad, sonidos y avisos. */
export function SettingsSheet({ visible, settings, detectionAvailable, onChange, onClose }: Props) {
  const bump = (key: 'thresholdDeg' | 'graceSeconds' | 'volume', direction: 1 | -1) => {
    const limits = LIMITS[key];
    onChange({ [key]: clamp(settings[key] + direction * limits.step, limits.min, limits.max) });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Ajustes</Text>
            <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Cerrar ajustes">
              <Text style={styles.closeText}>Listo</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.section}>Sensibilidad</Text>
            <Stepper
              label="Umbral de agachado"
              hint="Grados de inclinación que disparan la alerta."
              value={`${Math.round(settings.thresholdDeg)}°`}
              onDecrease={() => bump('thresholdDeg', -1)}
              onIncrease={() => bump('thresholdDeg', 1)}
            />
            <Stepper
              label="Margen antes del pitido"
              hint="Cuánto puedes estar agachado antes del susto."
              value={`${settings.graceSeconds.toFixed(1)} s`}
              onDecrease={() => bump('graceSeconds', -1)}
              onIncrease={() => bump('graceSeconds', 1)}
            />

            <Text style={styles.section}>Sonido</Text>
            <Stepper
              label="Volumen de las alertas"
              value={`${Math.round(settings.volume * 100)}%`}
              onDecrease={() => bump('volume', -1)}
              onIncrease={() => bump('volume', 1)}
            />
            <Toggle
              label="Tono EAS con auriculares"
              hint="El aviso de emergencia (853 + 960 Hz) directo a los oídos."
              value={settings.easWithHeadphones}
              onValueChange={(easWithHeadphones) => onChange({ easWithHeadphones })}
            />
            <Toggle
              label="Tono EAS siempre"
              hint="Úsalo también por el altavoz, en vez de la sirena."
              value={settings.easAlways}
              onValueChange={(easAlways) => onChange({ easAlways })}
            />
            <Toggle
              label="Voz (uno, dos, tres)"
              value={settings.voiceEnabled}
              onValueChange={(voiceEnabled) => onChange({ voiceEnabled })}
            />
            {detectionAvailable ? null : (
              <Toggle
                label="Llevo auriculares"
                hint="Esta build no detecta la salida de audio: márcalo a mano."
                value={settings.manualHeadphones}
                onValueChange={(manualHeadphones) => onChange({ manualHeadphones })}
              />
            )}

            <Text style={styles.section}>Avisos</Text>
            <Toggle
              label="Vibración"
              value={settings.vibrationEnabled}
              onValueChange={(vibrationEnabled) => onChange({ vibrationEnabled })}
            />
            <Toggle
              label="Notificación de alerta"
              hint="Mensaje de máxima prioridad al llegar a la alarma."
              value={settings.notificationsEnabled}
              onValueChange={(notificationsEnabled) => onChange({ notificationsEnabled })}
            />
            <Toggle
              label="Mantener la pantalla encendida"
              hint="El sensor se para si el móvil se bloquea."
              value={settings.keepAwake}
              onValueChange={(keepAwake) => onChange({ keepAwake })}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,7,16,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  close: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  closeText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  section: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.text, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  stepValue: { color: colors.text, fontSize: 15, fontWeight: '700', minWidth: 54, textAlign: 'center' },
});
