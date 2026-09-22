import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { LIMITS, clamp, type Settings } from '../core/settings';
import { Button, Divider, ListItem, Subheader } from './material';
import { STATE_PRESSED, colors, shape, spacing, stateLayer, type } from './theme';

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

interface StepperProps {
  label: string;
  hint?: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}

/** Botón circular de 40 dp para los pasos, con contorno como los icon buttons de M3. */
function StepButton({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        pressed && { backgroundColor: stateLayer(colors.onSurface, STATE_PRESSED) },
      ]}>
      <Text style={styles.stepGlyph}>{glyph}</Text>
    </Pressable>
  );
}

function Stepper({ label, hint, value, onDecrease, onIncrease }: StepperProps) {
  return (
    <ListItem
      headline={label}
      supporting={hint}
      trailing={
        <View style={styles.stepper}>
          <StepButton glyph="−" label={`Bajar ${label}`} onPress={onDecrease} />
          <Text style={styles.stepValue}>{value}</Text>
          <StepButton glyph="+" label={`Subir ${label}`} onPress={onIncrease} />
        </View>
      }
    />
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
    <ListItem
      headline={label}
      supporting={hint}
      trailing={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.surfaceContainerHighest, true: colors.primary }}
          thumbColor={value ? colors.onPrimary : colors.outline}
          ios_backgroundColor={colors.surfaceContainerHighest}
        />
      }
    />
  );
}

/**
 * Ajustes en una hoja inferior de Material 3: asa de arrastre, título grande y
 * las opciones agrupadas en secciones con filas de lista.
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
  const bump = (key: 'thresholdDeg' | 'graceSeconds' | 'volume', direction: 1 | -1) => {
    const limits = LIMITS[key];
    onChange({ [key]: clamp(settings[key] + direction * limits.step, limits.min, limits.max) });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Ajustes</Text>
            <Button label="Listo" onPress={onClose} variant="text" accessibilityLabel="Cerrar ajustes" />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Subheader>Sensibilidad</Subheader>
            <Stepper
              label="Umbral de agachado"
              hint="Grados de inclinación que disparan la alerta."
              value={`${Math.round(settings.thresholdDeg)}°`}
              onDecrease={() => bump('thresholdDeg', -1)}
              onIncrease={() => bump('thresholdDeg', 1)}
            />
            <Divider />
            <Stepper
              label="Margen antes del pitido"
              hint="Cuánto puedes estar agachado antes del susto."
              value={`${settings.graceSeconds.toFixed(1)} s`}
              onDecrease={() => bump('graceSeconds', -1)}
              onIncrease={() => bump('graceSeconds', 1)}
            />

            <Subheader>Sonido</Subheader>
            <Stepper
              label="Volumen de las alertas"
              value={`${Math.round(settings.volume * 100)}%`}
              onDecrease={() => bump('volume', -1)}
              onIncrease={() => bump('volume', 1)}
            />
            <Divider />
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

            <Subheader>Avisos</Subheader>
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

            <Subheader>Experimento</Subheader>
            <Toggle
              label="Sesión de control"
              hint="Mide y registra sin avisar. Es el grupo con el que comparar."
              value={settings.controlMode}
              onValueChange={(controlMode) => onChange({ controlMode })}
            />
            {sessionCount > 0 ? (
              <View style={styles.dangerRow}>
                <Button
                  label={`Borrar las ${sessionCount} sesiones guardadas`}
                  onPress={onClearHistory}
                  variant="outlined"
                  color={colors.error}
                  stretch
                />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopLeftRadius: shape.extraLarge,
    borderTopRightRadius: shape.extraLarge,
    maxHeight: '90%',
  },
  handleArea: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.sm },
  handle: {
    width: 32,
    height: 4,
    borderRadius: shape.full,
    backgroundColor: stateLayer(colors.onSurfaceVariant, 0.4),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...type.headlineSmall, color: colors.onSurface },
  content: { paddingBottom: spacing.xxl },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: shape.full,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: { ...type.titleLarge, color: colors.onSurface, lineHeight: 26 },
  stepValue: { ...type.labelLarge, color: colors.onSurface, minWidth: 56, textAlign: 'center' },
  dangerRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
});
