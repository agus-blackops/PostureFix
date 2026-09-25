import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { formatDuration } from './src/core/format';
import { FALLBACK_PRICES } from './src/core/labs';
import { isAlerting } from './src/core/postureEngine';
import { useLabs } from './src/hooks/useLabs';
import { usePostureMonitor } from './src/hooks/usePostureMonitor';
import { AlertOverlay } from './src/ui/AlertOverlay';
import { StreakCard, WeeklyCard } from './src/ui/LabsCards';
import { LabsSheet } from './src/ui/LabsSheet';
import { Notice } from './src/ui/Notice';
import { PostureGauge } from './src/ui/PostureGauge';
import { ResultsCard } from './src/ui/ResultsCard';
import { SettingsSheet } from './src/ui/SettingsSheet';
import { StretchSheet } from './src/ui/StretchSheet';
import { Appear } from './src/ui/expressive';
import { AmbientBackground, Button, ButtonGroup, Card, GlassSurface, IconButton, StatusPill, setUiHaptics } from './src/ui/glass';
import { Icon } from './src/ui/things';
import { colors, continuous, phaseColors, radius, roundedNumbers, spacing, type } from './src/ui/theme';

/** Lo que tarda en bajar una hoja antes de subir la siguiente. */
const SHEET_SWAP_MS = 380;

const STEPS = [
  'Guarda el móvil en el bolsillo del pecho o del pantalón, o sujétalo al cinturón.',
  'Siéntate o ponte de pie con la espalda recta.',
  'Pulsa «Calibrar» y no te muevas un par de segundos.',
];

export default function App() {
  const monitor = usePostureMonitor();
  const labs = useLabs();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [labsVisible, setLabsVisible] = useState(false);
  const [stretchVisible, setStretchVisible] = useState(false);

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

  // Los toques suaves de la interfaz tienen su propio ajuste desde la 1.1.3.
  useEffect(() => setUiHaptics(settings.uiHaptics), [settings.uiHaptics]);

  // Los experimentos de Labs sólo aparecen con la suscripción activa.
  const showStreaks = labs.active && settings.labsStreaks;
  const showWeekly = labs.active && settings.labsWeekly;
  const showStretches = labs.active && settings.labsStretches;
  const showTeaser = !labs.active && (labs.status === 'ready' || labs.devUnlock != null);
  const monthlyPrice = labs.offer?.monthly?.product.priceString ?? FALLBACK_PRICES.monthly.label;
  const now = Date.now();

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
            <Appear index={0} style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.brand} accessibilityRole="header">
                  PostureFix
                </Text>
                <Text style={styles.tagline}>Si te agachas demasiado, te enteras.</Text>
              </View>
              <View style={styles.headerButtons}>
                <IconButton
                  icon={<Icon name="flask" size={21} color={labs.active ? colors.tint : colors.label} />}
                  onPress={() => setLabsVisible(true)}
                  accessibilityLabel="Abrir PostureFix Labs"
                />
                <IconButton glyph="⚙︎" onPress={() => setSettingsVisible(true)} accessibilityLabel="Abrir ajustes" />
              </View>
            </Appear>

            <Appear index={1} style={styles.pills}>
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
            </Appear>

            {calibrated ? null : (
              <Appear index={2}>
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
              </Appear>
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

            <Appear index={3}>
              <Card style={styles.gaugeCard}>
                <PostureGauge
                  deviationDeg={engine.deviationDeg}
                  thresholdDeg={settings.thresholdDeg}
                  phase={engine.phase}
                  graceProgress={graceProgress}
                  graceSeconds={settings.graceSeconds}
                  controlMode={settings.controlMode}
                  calibrating={calibrating}
                />
              </Card>
            </Appear>

            <Appear index={4}>
              <Button
                label={running ? 'Parar vigilancia' : calibrating ? 'Calibrando…' : 'Empezar a vigilar'}
                onPress={() => (running ? monitor.stop() : void monitor.start())}
                variant="prominent"
                size="large"
                color={running ? colors.red : colors.tint}
                onColor={running ? colors.onStatus : colors.onTint}
                disabled={calibrating || sensorAvailable === false}
                selected={running}
                haptic="medium"
                accessibilityHint={running ? 'Guarda la sesión y deja de avisar' : 'Empieza a medir tu postura'}
              />
            </Appear>

            <Appear index={5}>
              <ButtonGroup
                items={[
                  {
                    label: calibrating ? 'Calibrando…' : 'Calibrar',
                    onPress: () => void monitor.calibrate(),
                    disabled: calibrating || sensorAvailable === false,
                    accessibilityHint: 'Guarda tu postura actual como la buena',
                  },
                  {
                    label: previewing ? 'Sonando…' : 'Probar alerta',
                    onPress: () => void monitor.previewAlarm(),
                    disabled: previewing,
                    accessibilityHint: 'Reproduce la secuencia de aviso completa',
                  },
                ]}
              />
            </Appear>

            {showStreaks ? (
              <Appear index={6}>
                <StreakCard history={history} goalMinutes={settings.dailyGoalMinutes} now={now} />
              </Appear>
            ) : null}

            {showStretches ? (
              <Appear index={6}>
                <Button
                  label="Estirar dos minutos"
                  onPress={() => setStretchVisible(true)}
                  variant="glass"
                  color={colors.yellow}
                  accessibilityHint="Abre los estiramientos guiados"
                />
              </Appear>
            ) : null}

            <Appear index={6}>
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
            </Appear>

            {showWeekly ? (
              <Appear index={7}>
                <WeeklyCard history={history} now={now} />
              </Appear>
            ) : null}

            <Appear index={7}>
              <ResultsCard history={history} />
            </Appear>

            {showTeaser ? (
              <Appear index={8}>
                <Pressable
                  onPress={() => setLabsVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`PostureFix Labs, desde ${monthlyPrice} al mes`}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <GlassSurface material="thin" cornerRadius={radius.large} style={styles.teaser}>
                    <View style={styles.teaserIcon}>
                      <Icon name="flask" size={20} color={colors.onTint} />
                    </View>
                    <View style={styles.teaserText}>
                      <Text style={styles.teaserTitle}>PostureFix Labs</Text>
                      <Text style={styles.teaserBody}>Rachas, informe semanal y estiramientos. Desde {monthlyPrice} al mes.</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </GlassSurface>
                </Pressable>
              </Appear>
            ) : null}

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
          labsActive={labs.active}
          onOpenLabs={() => {
            // Una hoja detrás de otra: iOS no presenta un modal mientras otro se cierra.
            setSettingsVisible(false);
            setTimeout(() => setLabsVisible(true), SHEET_SWAP_MS);
          }}
        />

        <LabsSheet
          visible={labsVisible}
          onClose={() => setLabsVisible(false)}
          labs={labs}
          settings={settings}
          onChange={monitor.updateSettings}
        />

        <StretchSheet
          visible={stretchVisible}
          onClose={() => setStretchVisible(false)}
          voiceEnabled={settings.voiceEnabled}
          vibrationEnabled={settings.vibrationEnabled}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 56, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flex: 1 },
  headerButtons: { flexDirection: 'row', gap: spacing.sm },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  teaser: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  teaserIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    ...continuous,
  },
  teaserText: { flex: 1, gap: 2 },
  teaserTitle: { ...type.headline, color: colors.label },
  teaserBody: { ...type.footnote, color: colors.secondaryLabel },
  chevron: { fontSize: 26, lineHeight: 28, color: colors.tertiaryLabel },
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
  stats: { flexDirection: 'row', paddingVertical: spacing.lg, paddingHorizontal: 0, gap: 0 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.separator },
  statValue: { ...type.title2, ...roundedNumbers, color: colors.label },
  statLabel: { ...type.footnote, color: colors.secondaryLabel },
  footer: { ...type.footnote, color: colors.tertiaryLabel, textAlign: 'center', paddingHorizontal: spacing.lg },
});
