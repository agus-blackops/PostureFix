import Constants from 'expo-constants';
import { Text, View } from 'react-native';

import { useApp } from '../app/AppContext';
import { Button, ButtonGroup, Segmented } from '../components/controls';
import { Icon } from '../components/Icon';
import { LoadingIndicator, MorphShape, PieProgress, ProgressBar, WavyRing } from '../components/indicators';
import { Notice, Pill } from '../components/lists';
import { Appear, Pop } from '../components/motion';
import { Card } from '../components/Surface';
import { expressionFor } from '../core/expression';
import { formatDegrees, formatDuration } from '../core/format';
import { isAlerting, type Phase } from '../core/postureEngine';
import { PROFILE_IDS, PROFILE_NAMES, calibrationKind, type ProfileId } from '../core/profiles';
import { todayProgress } from '../core/progress';
import { DAY_NAMES, formatClock, weekdayIndex } from '../core/schedule';
import { makeStyles, phaseColor, radius, roundedNumbers, spacing, type, useTheme, withAlpha } from '../theme';
import { Screen } from './Screen';

/** Ángulo que llena el anillo entero. */
const MAX_ANGLE = 70;

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'En pausa',
  ok: 'Postura correcta',
  slouching: 'Te estás agachando',
  scare: '¡Enderézate!',
  countdown: 'Cuenta atrás',
  alarm: '¡Alerta de postura!',
  cooldown: 'Recuperado',
};

const PROFILE_OPTIONS = PROFILE_IDS.map((id) => ({ value: id, label: PROFILE_NAMES[id] }));

const useStyles = makeStyles((t) => ({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gaugeCard: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl },
  shape: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  degrees: { ...roundedNumbers, fontSize: 60, lineHeight: 66, fontWeight: '700', letterSpacing: -0.5, color: t.colors.label },
  caption: { ...type.subheadline, color: t.colors.secondaryLabel, marginTop: -2 },
  phase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.capsule,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseLabel: { ...type.headline },
  detail: { flexDirection: 'row', gap: spacing.xl },
  detailItem: { alignItems: 'center', gap: 2 },
  detailValue: { ...type.headline, ...roundedNumbers, color: t.colors.label },
  detailLabel: { ...type.caption1, color: t.colors.secondaryLabel },
  grace: { width: '100%', gap: spacing.sm },
  hint: { ...type.footnote, color: t.colors.tertiaryLabel, textAlign: 'center' },
  stats: { flexDirection: 'row', paddingVertical: spacing.lg, paddingHorizontal: 0, gap: 0 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm },
  statDivider: { borderLeftWidth: 0.5, borderLeftColor: t.colors.separator },
  statValue: { ...type.title2, ...roundedNumbers, color: t.colors.label },
  statLabel: { ...type.footnote, color: t.colors.secondaryLabel },
  goal: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  goalText: { flex: 1, gap: 2 },
  goalTitle: { ...type.headline, color: t.colors.label },
  goalBody: { ...type.footnote, color: t.colors.secondaryLabel },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  reminderText: { ...type.footnote, color: t.colors.secondaryLabel },
  footer: { ...type.footnote, color: t.colors.tertiaryLabel, textAlign: 'center', paddingHorizontal: spacing.lg },
}));

function whenText(date: Date | null): string {
  if (!date) return 'cuando vuelva a tocar';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const clock = formatClock(date.getHours() * 60 + date.getMinutes());
  return sameDay ? `hoy a las ${clock}` : `el ${DAY_NAMES[weekdayIndex(date)]} a las ${clock}`;
}

export function TodayScreen({ onCalibrate, onOpenProgress }: { onCalibrate: () => void; onOpenProgress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { monitor, labs } = useApp();
  const { settings, profile, engine, tilt, running } = monitor;
  const kind = calibrationKind(profile);
  const calibrated = kind !== 'none';
  const controlMode = settings.controlMode;
  const color = phaseColor(colors, engine.phase, controlMode);
  const alerting = isAlerting(engine.phase);
  const label = controlMode && alerting ? 'Mala postura registrada (sin avisar)' : PHASE_LABEL[engine.phase];
  const { urgency, shape } = expressionFor(engine.phase, controlMode);
  const graceProgress = engine.badMs / Math.max(1, profile.graceSeconds * 1000);
  const graceLeft = Math.max(0, (1 - graceProgress) * profile.graceSeconds);
  const showGrace = engine.phase === 'slouching' && graceProgress > 0;
  const calibrating = monitor.calibration.step !== 'idle' && monitor.calibration.step !== 'done' && monitor.calibration.step !== 'failed';
  const profileName = PROFILE_NAMES[settings.activeProfile];

  const stats = [
    { value: String(engine.totalAlerts), label: 'alertas' },
    { value: formatDuration(engine.sessionBadMs), label: 'encorvado' },
    { value: formatDuration(engine.sessionMs), label: 'sesión' },
  ];
  const today = todayProgress(monitor.history, settings.dailyGoalMinutes, Date.now());

  return (
    <Screen title="PostureFix" subtitle={running ? `Vigilando · ${profileName}` : 'Si te agachas demasiado, te enteras.'}>
      <Appear index={1} style={styles.pills}>
        <Pill label={running ? 'Vigilando' : 'En pausa'} color={running ? colors.green : colors.neutral} emphasized={running} />
        {monitor.fused ? <Pill label="Giroscopio + acelerómetro" color={colors.tint} /> : null}
        <Pill
          label={monitor.headphones.connected ? 'Auriculares' : 'Altavoz'}
          color={monitor.headphones.connected ? colors.green : colors.neutral}
          emphasized={monitor.headphones.connected}
        />
        {controlMode ? <Pill label="Sesión de control" color={colors.yellow} emphasized /> : null}
        {running && monitor.outsideSchedule ? <Pill label="Fuera de horario" color={colors.neutral} emphasized /> : null}
      </Appear>

      <Appear index={2}>
        <Segmented
          options={PROFILE_OPTIONS}
          value={settings.activeProfile}
          onChange={(id: ProfileId) => monitor.setActiveProfile(id)}
          accessibilityLabel="Perfil"
          disabled={running}
        />
      </Appear>

      {monitor.sensorAvailable === false ? (
        <Notice
          tone="danger"
          title="Sin sensores de movimiento"
          body="Este dispositivo no tiene acelerómetro, así que no puede medir la postura. Prueba la versión del portátil, que mide con la cámara."
        />
      ) : null}

      {!calibrated && monitor.sensorAvailable !== false ? (
        <Notice
          tone="info"
          title={`Calibra el perfil «${profileName}»`}
          body="Guarda el móvil en el bolsillo del pecho o del pantalón, o sujétalo al cinturón. La calibración te guía con la voz: primero recto y luego un poco hacia delante."
          actions={[{ label: 'Calibrar ahora', onPress: onCalibrate }]}
        />
      ) : null}

      {monitor.sensorMoved ? (
        <Notice
          tone="danger"
          title="¿Has movido el móvil?"
          body="Después de un meneo el ángulo ha dado un salto grande: la postura guardada ya no describe tu espalda. La vigilancia no avisará hasta que recalibres."
          actions={[
            { label: 'Recalibrar', onPress: onCalibrate },
            { label: 'No lo he movido', onPress: monitor.dismissSensorMoved },
          ]}
        />
      ) : null}

      {running && monitor.outsideSchedule ? (
        <Notice
          tone="info"
          title="Fuera de tu horario"
          body={`No avisará ni contará tiempo hasta ${whenText(monitor.nextScheduleChange)}.`}
        />
      ) : null}

      {calibrated && profile.spreadDeg != null && profile.spreadDeg > 4 && !monitor.sensorMoved ? (
        <Notice
          tone="warn"
          title="Calibración poco fiable"
          body={`Las lecturas bailaban ±${profile.spreadDeg.toFixed(1).replace('.', ',')}° al calibrar. Quédate quieto y repite para medir con precisión.`}
          actions={[{ label: 'Repetir calibración', onPress: onCalibrate }]}
        />
      ) : null}

      <Appear index={3}>
        <Card style={styles.gaugeCard}>
          <View
            accessible
            accessibilityLabel={`Inclinación ${Math.round(engine.deviationDeg)} grados, umbral ${Math.round(profile.thresholdDeg)}. ${label}.`}
            accessibilityLiveRegion="polite">
            <WavyRing
              size={236}
              stroke={16}
              progress={engine.deviationDeg / MAX_ANGLE}
              color={color}
              markAt={profile.thresholdDeg / MAX_ANGLE}
              urgency={urgency}>
              <View style={styles.shape}>
                <MorphShape shape={calibrating ? 'circle' : shape} size={148} color={withAlpha(color, 0.13)} spin={urgency * 0.25} />
              </View>
              {calibrating ? (
                <>
                  <LoadingIndicator size={56} />
                  <Text style={styles.caption}>Calibrando…</Text>
                </>
              ) : (
                <>
                  <Text style={styles.degrees}>{formatDegrees(engine.deviationDeg)}</Text>
                  <Text style={styles.caption}>{kind === 'two-step' ? 'de mala postura' : 'de inclinación'}</Text>
                </>
              )}
            </WavyRing>
          </View>

          <Pop trigger={label}>
            <View style={[styles.phase, { backgroundColor: withAlpha(color, 0.16) }]}>
              <View style={[styles.phaseDot, { backgroundColor: color }]} />
              <Text style={[styles.phaseLabel, { color: engine.phase === 'idle' ? colors.secondaryLabel : color }]}>{label}</Text>
            </View>
          </Pop>

          {tilt && tilt.pitchDeg != null && tilt.rollDeg != null ? (
            <View style={styles.detail}>
              <View style={styles.detailItem}>
                <Text style={styles.detailValue}>{formatDegrees(Math.abs(tilt.pitchDeg))}</Text>
                <Text style={styles.detailLabel}>{tilt.pitchDeg >= 0 ? 'hacia delante' : 'hacia atrás'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailValue}>{formatDegrees(Math.abs(tilt.rollDeg))}</Text>
                <Text style={styles.detailLabel}>de lado</Text>
              </View>
            </View>
          ) : null}

          {showGrace ? (
            <View style={styles.grace}>
              <Text style={styles.hint}>Pitido en {graceLeft.toFixed(1).replace('.', ',')} s si no te enderezas</Text>
              <ProgressBar progress={graceProgress} color={colors.yellow} height={6} />
            </View>
          ) : (
            <Text style={styles.hint}>Umbral {formatDegrees(profile.thresholdDeg)} · la marca del anillo</Text>
          )}
        </Card>
      </Appear>

      <Appear index={4}>
        <Button
          label={running ? 'Parar vigilancia' : calibrated ? 'Empezar a vigilar' : 'Calibra antes de empezar'}
          onPress={() => (running ? monitor.stop() : void monitor.start())}
          variant="prominent"
          size="large"
          color={running ? colors.red : colors.tint}
          onColor={running ? '#FFFFFF' : colors.onTint}
          disabled={!calibrated || calibrating || monitor.sensorAvailable === false}
          selected={running}
          haptic="medium"
        />
      </Appear>

      <Appear index={5}>
        <ButtonGroup
          items={[
            { label: calibrating ? 'Calibrando…' : 'Calibrar', onPress: onCalibrate, disabled: monitor.sensorAvailable === false },
            { label: monitor.previewing ? 'Sonando…' : 'Probar alerta', onPress: () => void monitor.previewAlarm(), disabled: monitor.previewing },
          ]}
        />
      </Appear>

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
        {monitor.reminderLeftMs != null && !monitor.outsideSchedule ? (
          <View style={[styles.reminder, { marginTop: spacing.sm }]}>
            <Icon name="clock" size={15} color={colors.secondaryLabel} />
            <Text style={styles.reminderText}>Próximo descanso en {Math.ceil(monitor.reminderLeftMs / 60_000)} min</Text>
          </View>
        ) : null}
      </Appear>

      {labs.active && settings.labsStreaks ? (
        <Appear index={7}>
          <Card style={styles.goal}>
            <PieProgress progress={today.ratio} size={44} color={today.met ? colors.green : colors.tint} />
            <View style={styles.goalText}>
              <Text style={styles.goalTitle}>
                {Math.floor(today.goodMs / 60_000)} de {settings.dailyGoalMinutes} min rectos hoy
              </Text>
              <Text style={styles.goalBody} onPress={onOpenProgress}>
                {today.met ? 'Objetivo cumplido. Mira tu racha en Progreso.' : 'Tu objetivo diario. Mira tu racha en Progreso.'}
              </Text>
            </View>
          </Card>
        </Appear>
      ) : null}

      <Text style={styles.footer}>
        PostureFix {Constants.expoConfig?.version ?? ''} · Vigila con la app abierta: el sistema apaga los sensores al bloquear el
        móvil.
      </Text>
    </Screen>
  );
}
