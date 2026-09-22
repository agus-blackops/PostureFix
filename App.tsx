import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { usePostureMonitor } from './src/hooks/usePostureMonitor';
import { AlertOverlay } from './src/ui/AlertOverlay';
import { Notice } from './src/ui/Notice';
import { PostureGauge } from './src/ui/PostureGauge';
import { ResultsCard } from './src/ui/ResultsCard';
import { SettingsSheet } from './src/ui/SettingsSheet';
import { StatusChip } from './src/ui/StatusChip';
import { Button, Card, ExtendedFab, IconButton } from './src/ui/material';
import { colors, spacing, type } from './src/ui/theme';

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
}

export default function App() {
  const monitor = usePostureMonitor();
  const [settingsVisible, setSettingsVisible] = useState(false);

  const {
    engine,
    settings,
    history,
    running,
    calibration,
    calibrationQuality,
    sensorMoved,
    headphones,
    alarmSound,
    sensorAvailable,
  } = monitor;
  const calibrated = settings.baseline != null;
  const graceProgress = engine.badMs / Math.max(1, settings.graceSeconds * 1000);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.content}>
          {/* Barra superior de Material 3: título grande y una acción a la derecha. */}
          <View style={styles.appBar}>
            <View style={styles.appBarText}>
              <Text style={styles.brand}>PostureFix</Text>
              <Text style={styles.tagline}>Si te agachas demasiado, te enteras.</Text>
            </View>
            <IconButton
              icon="⚙︎"
              onPress={() => setSettingsVisible(true)}
              accessibilityLabel="Abrir ajustes"
              tone={colors.onSurface}
            />
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
            {settings.controlMode ? <StatusChip label="Sesión de control" tone="warn" /> : null}
            {sensorAvailable === false ? <StatusChip label="Sin acelerómetro" tone="danger" /> : null}
          </View>

          {calibrated ? null : (
            <Card>
              <Text style={styles.cardTitle}>Antes de empezar</Text>
              <Text style={styles.cardBody}>
                1. Guarda el móvil en el bolsillo del pecho o del pantalón, o sujétalo al cinturón.{'\n'}
                2. Siéntate o ponte de pie con la espalda recta.{'\n'}
                3. Pulsa <Text style={styles.bold}>Calibrar postura</Text> y no te muevas 2 segundos.
              </Text>
            </Card>
          )}

          {sensorMoved ? (
            <Notice
              tone="danger"
              title="¿Has movido el móvil?"
              body="Después de un meneo el ángulo ha dado un salto grande, así que la postura que guardaste ya no describe tu espalda. La vigilancia está en pausa hasta que recalibres."
              actions={[
                { label: 'Recalibrar', onPress: () => void monitor.calibrate() },
                { label: 'No lo he movido', onPress: monitor.dismissSensorMoved },
              ]}
            />
          ) : null}

          {calibrationQuality && !calibrationQuality.steady && !sensorMoved ? (
            <Notice
              tone="warn"
              title="Calibración poco fiable"
              body={`Las lecturas bailaban ±${calibrationQuality.spreadDeg.toFixed(1)}° mientras calibrabas. Siéntate recto, quédate quieto y repite para que las medidas sean exactas.`}
              actions={[{ label: 'Repetir calibración', onPress: () => void monitor.calibrate() }]}
            />
          ) : null}

          <Card variant="elevated" style={styles.gaugeCard}>
            <PostureGauge
              deviationDeg={engine.deviationDeg}
              thresholdDeg={settings.thresholdDeg}
              phase={engine.phase}
              graceProgress={graceProgress}
              controlMode={settings.controlMode}
            />
          </Card>

          <ExtendedFab
            label={running ? 'Parar vigilancia' : 'Empezar a vigilar'}
            onPress={() => (running ? monitor.stop() : void monitor.start())}
            color={running ? colors.errorContainer : colors.primary}
            onColor={running ? colors.onErrorContainer : colors.onPrimary}
          />

          <View style={styles.secondaryRow}>
            <Button
              label={calibration === 'calibrating' ? 'Calibrando…' : 'Calibrar postura'}
              onPress={() => void monitor.calibrate()}
              variant="tonal"
              stretch
            />
            <Button
              label="Probar alerta"
              onPress={() => void monitor.previewAlarm()}
              variant="outlined"
              stretch
            />
          </View>

          <View style={styles.stats}>
            {[
              { value: String(engine.totalAlerts), label: 'alertas' },
              { value: formatDuration(engine.sessionBadMs), label: 'agachado' },
              { value: formatDuration(engine.sessionMs), label: 'sesión' },
            ].map((stat) => (
              <Card key={stat.label} style={styles.stat}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </Card>
            ))}
          </View>

          <ResultsCard history={history} />

          <Text style={styles.footer}>
            PostureFix {Constants.expoConfig?.version ?? ''} · Con auriculares suena el tono de emergencia EAS (853 + 960 Hz); por altavoz, una sirena de dos
            tonos. La vigilancia necesita la app en primer plano: el sistema apaga el acelerómetro al
            bloquear el móvil.
          </Text>
        </ScrollView>

        <AlertOverlay
          phase={engine.phase}
          countsSpoken={engine.countsSpoken}
          controlMode={settings.controlMode}
        />

        <SettingsSheet
          visible={settingsVisible}
          settings={settings}
          detectionAvailable={headphones.detectionAvailable}
          sessionCount={history.length}
          onChange={monitor.updateSettings}
          onClearHistory={monitor.clearHistory}
          onClose={() => setSettingsVisible(false)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    gap: spacing.md,
  },
  appBarText: { flex: 1 },
  brand: { ...type.headlineMedium, color: colors.onSurface, fontWeight: '500' },
  tagline: { ...type.bodyMedium, color: colors.onSurfaceVariant },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardTitle: { ...type.titleMedium, color: colors.onSurface },
  cardBody: { ...type.bodyMedium, color: colors.onSurfaceVariant },
  bold: { color: colors.onSurface, fontWeight: '700' },
  gaugeCard: { paddingVertical: spacing.xl },
  secondaryRow: { flexDirection: 'row', gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 0, paddingVertical: spacing.lg, paddingHorizontal: spacing.sm },
  statValue: { ...type.titleLarge, color: colors.onSurface },
  statLabel: { ...type.labelMedium, color: colors.onSurfaceVariant, fontWeight: '400' },
  footer: { ...type.bodySmall, color: colors.onSurfaceVariant },
});
