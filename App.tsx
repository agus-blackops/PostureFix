import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { usePostureMonitor } from './src/hooks/usePostureMonitor';
import { AlertOverlay } from './src/ui/AlertOverlay';
import { PostureGauge } from './src/ui/PostureGauge';
import { SettingsSheet } from './src/ui/SettingsSheet';
import { StatusChip } from './src/ui/StatusChip';
import { colors, radius, spacing } from './src/ui/theme';

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
}

export default function App() {
  const monitor = usePostureMonitor();
  const [settingsVisible, setSettingsVisible] = useState(false);

  const { engine, settings, running, calibration, headphones, alarmSound, sensorAvailable } = monitor;
  const calibrated = settings.baseline != null;
  const graceProgress = engine.badMs / Math.max(1, settings.graceSeconds * 1000);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>PostureFix</Text>
              <Text style={styles.tagline}>Si te agachas demasiado, te enteras.</Text>
            </View>
            <Pressable
              onPress={() => setSettingsVisible(true)}
              style={styles.gear}
              accessibilityLabel="Abrir ajustes">
              <Text style={styles.gearIcon}>⚙︎</Text>
            </Pressable>
          </View>

          <View style={styles.chips}>
            <StatusChip
              label={running ? 'Vigilando' : 'En pausa'}
              tone={running ? 'good' : 'neutral'}
            />
            <StatusChip
              label={headphones.connected ? 'Auriculares' : 'Altavoz'}
              tone={headphones.connected ? 'good' : 'neutral'}
            />
            <StatusChip label={alarmSound === 'eas' ? 'Alarma EAS' : 'Sirena'} tone="warn" />
            {sensorAvailable === false ? <StatusChip label="Sin acelerómetro" tone="danger" /> : null}
          </View>

          {calibrated ? null : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Antes de empezar</Text>
              <Text style={styles.cardBody}>
                1. Guarda el móvil en el bolsillo del pecho o del pantalón, o sujétalo al cinturón.{'\n'}
                2. Siéntate o ponte de pie con la espalda recta.{'\n'}
                3. Pulsa <Text style={styles.bold}>Calibrar postura</Text> y no te muevas 2 segundos.
              </Text>
            </View>
          )}

          <PostureGauge
            deviationDeg={engine.deviationDeg}
            thresholdDeg={settings.thresholdDeg}
            phase={engine.phase}
            graceProgress={graceProgress}
          />

          <Pressable
            onPress={() => (running ? monitor.stop() : void monitor.start())}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: running ? colors.danger : colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Text style={styles.primaryText}>{running ? 'Parar vigilancia' : 'Empezar a vigilar'}</Text>
          </Pressable>

          <View style={styles.secondaryRow}>
            <Pressable
              onPress={() => void monitor.calibrate()}
              style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.85 : 1 }]}>
              <Text style={styles.secondaryText}>
                {calibration === 'calibrating' ? 'Calibrando…' : 'Calibrar postura'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void monitor.previewAlarm()}
              style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.85 : 1 }]}>
              <Text style={styles.secondaryText}>Probar alerta</Text>
            </Pressable>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{engine.totalAlerts}</Text>
              <Text style={styles.statLabel}>alertas</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDuration(engine.sessionBadMs)}</Text>
              <Text style={styles.statLabel}>agachado</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDuration(engine.sessionMs)}</Text>
              <Text style={styles.statLabel}>sesión</Text>
            </View>
          </View>

          <Text style={styles.footer}>
            Con auriculares suena el tono de emergencia EAS (853 + 960 Hz); por altavoz, una sirena de dos
            tonos. La vigilancia necesita la app en primer plano: el sistema apaga el acelerómetro al
            bloquear el móvil.
          </Text>
        </ScrollView>

        <AlertOverlay phase={engine.phase} countsSpoken={engine.countsSpoken} />

        <SettingsSheet
          visible={settingsVisible}
          settings={settings}
          detectionAvailable={headphones.detectionAvailable}
          onChange={monitor.updateSettings}
          onClose={() => setSettingsVisible(false)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  gear: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { color: colors.text, fontSize: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  bold: { color: colors.text, fontWeight: '700' },
  primaryButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  primaryText: { color: '#0B1020', fontSize: 18, fontWeight: '800' },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  footer: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
