import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { formatDuration } from './src/core/format';
import { isAlerting } from './src/core/postureEngine';
import { usePostureMonitor } from './src/hooks/usePostureMonitor';
import { AlertOverlay } from './src/ui/AlertOverlay';
import { Notice } from './src/ui/Notice';
import { PostureGauge } from './src/ui/PostureGauge';
import { ResultsCard } from './src/ui/ResultsCard';
import { SettingsSheet } from './src/ui/SettingsSheet';
import { AmbientBackground, Button, Card, IconButton, StatusPill, setUiHaptics } from './src/ui/glass';
import { colors, phaseColors, roundedNumbers, spacing, type } from './src/ui/theme';

const STEPS = [
  'Guarda el móvil en el bolsillo del pecho o del pantalón, o sujétalo al cinturón.',
  'Siéntate o ponte de pie con la espalda recta.',
  'Pulsa «Calibrar» y no te muevas un par de segundos.',
];

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
    calibrationFailed,
    previewing,
    sensorMoved,
    headphones,
    alarmSound,
    sensorAvailable,
  } = monitor;
  const calibrated = settings.baseline != null;
  const calibrating = calibration === 'calibrating';
  const graceProgress = engine.badMs / Math.max(1, settings.graceSeconds * 1000);

  // Los toques suaves de la interfaz siguen el ajuste de vibración.
  useEffect(() => setUiHaptics(settings.vibrationEnabled), [settings.vibrationEnabled]);

  // El fondo se tiñe con el estado; en control no se enseña el rojo de alerta.
  const accent =
    settings.controlMode && isAlerting(engine.phase) ? colors.yellow : (phaseColors[engine.phase] ?? colors.neutral);

  const stats = [
    { value: String(engine.totalAlerts), label: 'alertas' },
    { value: formatDuration(engine.sessionBadMs), label: 'agachado' },
    { value: formatDuration(engine.sessionMs), label: 'sesión' },
  ];

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <AmbientBackground accent={accent} />

        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Título grande de iOS y el botón de ajustes en cristal. */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.brand} accessibilityRole="header">
                  PostureFix
                </Text>
                <Text style={styles.tagline}>Si te agachas demasiado, te enteras.</Text>
              </View>
              <IconButton glyph="⚙︎" onPress={() => setSettingsVisible(true)} accessibilityLabel="Abrir ajustes" />
            </View>

            <View style={styles.pills}>
              <StatusPill
                label={running ? 'Vigilando' : 'En pausa'}
                color={running ? colors.green : colors.neutral}
                emphasized={running}
              />
              <StatusPill
                label={headphones.connected ? 'Auriculares' : 'Altavoz'}
                color={headphones.connected ? colors.green : colors.neutral}
                emphasized={headphones.connected}
              />
              <StatusPill label={alarmSound === 'eas' ? 'Alarma EAS' : 'Sirena'} color={colors.tint} />
              {settings.controlMode ? <StatusPill label="Sesión de control" color={colors.yellow} emphasized /> : null}
              {sensorAvailable === false ? <StatusPill label="Sin acelerómetro" color={colors.red} emphasized /> : null}
            </View>

            {calibrated ? null : (
              <Card>
                <Text style={styles.cardTitle}>Antes de empezar</Text>
                {STEPS.map((step, index) => (
                  <View key={step} style={styles.step}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepNumber}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
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

            {calibrationFailed && !calibrating ? (
              <Notice
                tone="danger"
                title="No he podido calibrar"
                body="Te movías demasiado mientras calibraba y no ha quedado ninguna lectura fiable. Quédate quieto con la espalda recta y repite."
                actions={[{ label: 'Repetir', onPress: () => void monitor.calibrate() }]}
              />
            ) : null}

            {calibrationQuality && !calibrationQuality.steady && !sensorMoved && !calibrationFailed ? (
              <Notice
                tone="warn"
                title="Calibración poco fiable"
                body={`Las lecturas bailaban ±${calibrationQuality.spreadDeg
                  .toFixed(1)
                  .replace('.', ',')}° mientras calibrabas. Siéntate recto, quédate quieto y repite para que las medidas sean exactas.`}
                actions={[{ label: 'Repetir calibración', onPress: () => void monitor.calibrate() }]}
              />
            ) : null}

            <Card style={styles.gaugeCard}>
              <PostureGauge
                deviationDeg={engine.deviationDeg}
                thresholdDeg={settings.thresholdDeg}
                phase={engine.phase}
                graceProgress={graceProgress}
                graceSeconds={settings.graceSeconds}
                controlMode={settings.controlMode}
              />
            </Card>

            <Button
              label={running ? 'Parar vigilancia' : calibrating ? 'Calibrando…' : 'Empezar a vigilar'}
              onPress={() => (running ? monitor.stop() : void monitor.start())}
              variant="prominent"
              size="large"
              color={running ? colors.red : colors.tint}
              onColor={running ? colors.onStatus : colors.onTint}
              disabled={calibrating || sensorAvailable === false}
              haptic="medium"
              accessibilityHint={running ? 'Guarda la sesión y deja de avisar' : 'Empieza a medir tu postura'}
            />

            <View style={styles.secondaryRow}>
              <Button
                label={calibrating ? 'Calibrando…' : 'Calibrar'}
                onPress={() => void monitor.calibrate()}
                disabled={calibrating || sensorAvailable === false}
                stretch
                accessibilityHint="Guarda tu postura actual como la buena"
              />
              <Button
                label={previewing ? 'Sonando…' : 'Probar alerta'}
                onPress={() => void monitor.previewAlarm()}
                disabled={previewing}
                stretch
                accessibilityHint="Reproduce la secuencia de aviso completa"
              />
            </View>

            <Card style={styles.stats}>
              {stats.map((stat, index) => (
                <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivider]}>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                    {stat.value}
                  </Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </Card>

            <ResultsCard history={history} />

            <Text style={styles.footer}>
              PostureFix {Constants.expoConfig?.version ?? ''} · La vigilancia necesita la app en primer plano: el sistema
              apaga el acelerómetro al bloquear el móvil.
            </Text>
          </ScrollView>
        </SafeAreaView>

        <AlertOverlay phase={engine.phase} countsSpoken={engine.countsSpoken} controlMode={settings.controlMode} />

        <SettingsSheet
          visible={settingsVisible}
          settings={settings}
          detectionAvailable={headphones.detectionAvailable}
          sessionCount={history.length}
          onChange={monitor.updateSettings}
          onClearHistory={monitor.clearHistory}
          onClose={() => setSettingsVisible(false)}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 56, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flex: 1 },
  brand: { ...type.largeTitle, color: colors.label },
  tagline: { ...type.subheadline, color: colors.secondaryLabel },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardTitle: { ...type.headline, color: colors.label },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -1,
  },
  stepNumber: { ...type.footnote, ...roundedNumbers, fontWeight: '700', color: colors.onTint },
  stepText: { ...type.subheadline, color: colors.secondaryLabel, flex: 1 },
  gaugeCard: { paddingVertical: spacing.xxl },
  secondaryRow: { flexDirection: 'row', gap: spacing.md },
  stats: { flexDirection: 'row', paddingVertical: spacing.lg, paddingHorizontal: 0, gap: 0 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.separator },
  statValue: { ...type.title2, ...roundedNumbers, color: colors.label },
  statLabel: { ...type.footnote, color: colors.secondaryLabel },
  footer: { ...type.footnote, color: colors.tertiaryLabel, textAlign: 'center', paddingHorizontal: spacing.lg },
});
