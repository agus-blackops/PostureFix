import { useEffect, useRef } from 'react';
import { Alert, Animated, Text, View } from 'react-native';

import { useApp } from '../app/AppContext';
import { Button, CheckBox } from '../components/controls';
import { Icon } from '../components/Icon';
import { PieProgress, ProgressBar } from '../components/indicators';
import { Row, Section, SectionTitle } from '../components/lists';
import { Appear, Pop, useReducedMotion } from '../components/motion';
import { Card } from '../components/Surface';
import { formatDuration, formatPercent } from '../core/format';
import { PROFILE_NAMES, type ProfileId } from '../core/profiles';
import { badges, streak, todayProgress, weeklyReport, type WeekDay } from '../core/progress';
import { compareModes, type SessionRecord } from '../core/sessionLog';
import { MOTION, rnSpring } from '../core/spring';
import { makeStyles, roundedNumbers, spacing, type, useTheme, withAlpha } from '../theme';
import { Screen } from './Screen';

const minutes = (ms: number) => Math.floor(ms / 60_000);
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const useStyles = makeStyles((t) => ({
  card: { gap: spacing.lg },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  goalText: { flex: 1, gap: 2 },
  goalNumber: { ...type.title1, ...roundedNumbers, color: t.colors.label },
  goalOf: { ...type.body, color: t.colors.secondaryLabel },
  hint: { ...type.footnote, color: t.colors.secondaryLabel },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: t.colors.separator,
  },
  streakNumber: { ...type.title1, ...roundedNumbers, color: t.colors.tintText, minWidth: 36, textAlign: 'center' },
  streakText: { flex: 1 },
  streakLabel: { ...type.headline, color: t.colors.label },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: t.colors.quaternaryFill,
  },
  badgeEarned: { backgroundColor: withAlpha(t.colors.yellow, 0.16) },
  badgeText: { ...type.caption1, color: t.colors.tertiaryLabel },
  badgeTextEarned: { color: t.colors.label, fontWeight: '600' },
  empty: { ...type.subheadline, color: t.colors.secondaryLabel },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 120 },
  barColumn: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, overflow: 'hidden' },
  barLabel: { ...type.caption1, color: t.colors.tertiaryLabel },
  barLabelToday: { color: t.colors.label, fontWeight: '700' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginLeft: spacing.xs },
  legendText: { ...type.caption1, color: t.colors.secondaryLabel, marginRight: spacing.sm },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: 2 },
  statValue: { ...type.title2, ...roundedNumbers, color: t.colors.label },
  statLabel: { ...type.footnote, color: t.colors.secondaryLabel },
  summary: { ...type.subheadline, color: t.colors.label },
  resultRow: { gap: spacing.sm },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  resultLabel: { ...type.subheadline, color: t.colors.label },
  resultValue: { ...type.headline, ...roundedNumbers },
  conclusion: { ...type.callout, color: t.colors.label },
  teaser: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  teaserText: { flex: 1, gap: 2 },
  teaserTitle: { ...type.headline, color: t.colors.label },
  value: { ...type.subheadline, ...roundedNumbers, color: t.colors.secondaryLabel },
}));

function StreakCard({ history, goalMinutes }: { history: SessionRecord[]; goalMinutes: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = Date.now();
  const today = todayProgress(history, goalMinutes, now);
  const { current, best, todayMet } = streak(history, goalMinutes, now);
  const left = Math.max(0, goalMinutes - minutes(today.goodMs));
  return (
    <Card style={styles.card}>
      <SectionTitle
        icon="flame"
        color={colors.tintText}
        title="Hoy"
        trailing={<CheckBox checked={today.met} accessibilityLabel="Objetivo de hoy cumplido" color={colors.green} />}
      />
      <View style={styles.goalRow}>
        <PieProgress progress={today.ratio} size={52} color={today.met ? colors.green : colors.tint} />
        <View style={styles.goalText}>
          <Text style={styles.goalNumber}>
            {minutes(today.goodMs)}
            <Text style={styles.goalOf}> de {goalMinutes} min</Text>
          </Text>
          <Text style={styles.hint}>{today.met ? 'Objetivo cumplido. Buen trabajo.' : `Te faltan ${left} min con buena postura.`}</Text>
        </View>
      </View>
      <View style={styles.streakRow}>
        <Pop trigger={String(current)}>
          <Text style={styles.streakNumber}>{current}</Text>
        </Pop>
        <View style={styles.streakText}>
          <Text style={styles.streakLabel}>{current === 1 ? 'día seguido' : 'días seguidos'}</Text>
          <Text style={styles.hint}>
            {current > 0 && !todayMet ? 'Cumple hoy para no perder la racha' : `Tu mejor racha: ${best} ${best === 1 ? 'día' : 'días'}`}
          </Text>
        </View>
      </View>
      <View style={styles.badges}>
        {badges(history, goalMinutes, now).map((badge) => (
          <View
            key={badge.id}
            style={[styles.badge, badge.earned && styles.badgeEarned]}
            accessible
            accessibilityLabel={`${badge.title}: ${badge.description}${badge.earned ? '' : ' Aún sin conseguir.'}`}>
            <Icon name={badge.earned ? 'star' : 'lock'} size={14} color={badge.earned ? colors.yellow : colors.tertiaryLabel} />
            <Text style={[styles.badgeText, badge.earned && styles.badgeTextEarned]}>{badge.title}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function Bar({ day, max, index, today }: { day: WeekDay; max: number; index: number; today: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const grow = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const total = max > 0 ? day.totalMs / max : 0;
  const good = day.totalMs > 0 ? day.goodMs / day.totalMs : 0;
  useEffect(() => {
    if (reduced) {
      grow.setValue(1);
      return;
    }
    Animated.spring(grow, { toValue: 1, delay: index * 45, useNativeDriver: false, ...rnSpring(MOTION.spatialSlow) }).start();
  }, [grow, index, reduced]);
  const height = grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(total * 100, day.totalMs > 0 ? 6 : 0)}%`] });
  return (
    <View style={styles.barColumn}>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.bar, { height }]}>
          <View style={{ flex: 1 - good, backgroundColor: colors.yellow }} />
          <View style={{ flex: good, backgroundColor: colors.green }} />
        </Animated.View>
      </View>
      <Text style={[styles.barLabel, today && styles.barLabelToday]}>{day.label}</Text>
    </View>
  );
}

function WeeklyCard({ history }: { history: SessionRecord[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const report = weeklyReport(history, Date.now());
  const max = Math.max(...report.days.map((day) => day.totalMs));
  const change = report.previousBadRatio == null || report.totalMs === 0 ? null : report.previousBadRatio - report.badRatio;
  return (
    <Card style={styles.card}>
      <SectionTitle icon="chart" color={colors.green} title="Tu semana" />
      {report.totalMs === 0 ? (
        <Text style={styles.empty}>Aún no hay sesiones esta semana. Cuando vigiles tu postura, aquí verás cómo te va cada día.</Text>
      ) : (
        <>
          <View style={styles.chart} accessible accessibilityLabel={`Encorvado el ${formatPercent(report.badRatio)} del tiempo esta semana`}>
            {report.days.map((day, index) => (
              <Bar key={day.key} day={day} max={max} index={index} today={index === report.days.length - 1} />
            ))}
          </View>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
            <Text style={styles.legendText}>Buena postura</Text>
            <View style={[styles.legendDot, { backgroundColor: colors.yellow }]} />
            <Text style={styles.legendText}>Encorvado</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatPercent(report.badRatio, 0)}</Text>
              <Text style={styles.statLabel}>encorvado</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{minutes(report.goodMs)}</Text>
              <Text style={styles.statLabel}>min rectos</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{report.alerts}</Text>
              <Text style={styles.statLabel}>alertas</Text>
            </View>
          </View>
          <Text style={styles.summary}>
            {report.bestDay ? `Tu mejor día fue el ${DAY_NAMES[new Date(report.bestDay.date).getDay()]}. ` : ''}
            {change == null
              ? 'La semana que viene podrás compararla con esta.'
              : change > 0.005
                ? `Te encorvas ${Math.round(change * 100)} puntos menos que la semana pasada.`
                : change < -0.005
                  ? `Te encorvas ${Math.round(-change * 100)} puntos más que la semana pasada.`
                  : 'Igual que la semana pasada.'}
          </Text>
        </>
      )}
    </Card>
  );
}

function ResultsCard({ history }: { history: SessionRecord[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { control, withAlerts, improvement } = compareModes(history);
  const rows = [
    { label: 'Sin avisos (control)', summary: control, color: colors.yellow },
    { label: 'Con avisos', summary: withAlerts, color: colors.green },
  ];
  return (
    <Card style={styles.card}>
      <SectionTitle icon="check" color={colors.green} title="El experimento" />
      <Text style={styles.hint}>Tiempo que pasas encorvado con avisos frente a las sesiones de control, que miden sin avisar.</Text>
      {rows.map(({ label, summary, color }) => (
        <View key={label} style={styles.resultRow}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultLabel}>{label}</Text>
            <Text style={[styles.resultValue, { color: summary.sessions > 0 ? color : colors.tertiaryLabel }]}>
              {summary.sessions > 0 ? formatPercent(summary.badRatio) : '—'}
            </Text>
          </View>
          <ProgressBar progress={summary.badRatio} color={color} height={10} />
        </View>
      ))}
      <Text style={styles.conclusion}>
        {improvement == null
          ? `Faltan datos para comparar: ${control.sessions} de control y ${withAlerts.sessions} con avisos.`
          : improvement > 0
            ? `Con los avisos pasas un ${formatPercent(improvement)} menos de tiempo encorvado.`
            : `Con los avisos no baja el tiempo encorvado (${formatPercent(-improvement)} más).`}
      </Text>
    </Card>
  );
}

const dateLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1} · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export function ProgressScreen({ onOpenLabs }: { onOpenLabs: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { monitor, labs } = useApp();
  const { history, settings } = monitor;

  const confirmClear = () =>
    Alert.alert('¿Borrar el historial?', `Se eliminarán las ${history.length} sesiones guardadas. No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: monitor.clearHistory },
    ]);

  return (
    <Screen title="Progreso" subtitle={history.length > 0 ? `${history.length} sesiones guardadas` : 'Aún no hay sesiones'}>
      {labs.active ? (
        <>
          {settings.labsStreaks ? (
            <Appear index={1}>
              <StreakCard history={history} goalMinutes={settings.dailyGoalMinutes} />
            </Appear>
          ) : null}
          {settings.labsWeekly ? (
            <Appear index={2}>
              <WeeklyCard history={history} />
            </Appear>
          ) : null}
        </>
      ) : (
        <Appear index={1}>
          <Card>
            <View style={styles.teaser}>
              <Icon name="flask" color={colors.tintText} size={26} />
              <View style={styles.teaserText}>
                <Text style={styles.teaserTitle}>Rachas e informe semanal</Text>
                <Text style={styles.hint}>Están en PostureFix Labs.</Text>
              </View>
            </View>
            <Button label="Ver Labs" onPress={onOpenLabs} variant="glass" />
          </Card>
        </Appear>
      )}

      <Appear index={3}>
        <ResultsCard history={history} />
      </Appear>

      {history.length > 0 ? (
        <Appear index={4}>
          <Section header="Últimas sesiones">
            {history.slice(0, 12).map((record) => (
              <Row
                key={record.startedAt}
                title={`${record.profile ? PROFILE_NAMES[record.profile as ProfileId] ?? 'Móvil' : record.source === 'movil' ? 'Móvil' : 'Portátil'}${
                  record.alertsEnabled ? '' : ' · control'
                }`}
                subtitle={`${dateLabel(record.startedAt)} · ${formatDuration(record.durationMs)}`}
                accessory={
                  <Text style={styles.value}>
                    {formatPercent(record.durationMs > 0 ? record.badMs / record.durationMs : 0, 0)} encorvado
                  </Text>
                }
              />
            ))}
          </Section>
          <View style={{ marginTop: spacing.md }}>
            <Button label={`Borrar las ${history.length} sesiones`} onPress={confirmClear} variant="plain" color={colors.red} />
          </View>
        </Appear>
      ) : null}
    </Screen>
  );
}
