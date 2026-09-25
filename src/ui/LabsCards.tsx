import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { formatPercent } from '../core/format';
import { badges, streak, todayProgress, weeklyReport, type WeekDay } from '../core/progress';
import type { SessionRecord } from '../core/sessionLog';
import { MOTION, rnSpring } from '../core/spring';
import { Pop, useReducedMotion } from './expressive';
import { Card } from './glass';
import { CheckBox, Icon, PieProgress, SectionTitle } from './things';
import { colors, roundedNumbers, spacing, type, withAlpha } from './theme';

const minutes = (ms: number) => Math.floor(ms / 60_000);

// ------------------------------------------------------------------ hoy ---

/**
 * Objetivo del día al estilo de un proyecto de Things: el quesito que se llena
 * con los minutos de buena postura y, al cumplirlo, la casilla que se marca
 * sola. Debajo, la racha y las insignias.
 */
export function StreakCard({ history, goalMinutes, now }: { history: SessionRecord[]; goalMinutes: number; now: number }) {
  const today = todayProgress(history, goalMinutes, now);
  const { current, best, todayMet } = streak(history, goalMinutes, now);
  const earned = badges(history, goalMinutes, now);
  const left = Math.max(0, goalMinutes - minutes(today.goodMs));

  return (
    <Card style={styles.card}>
      <SectionTitle
        icon="flame"
        color={colors.tint}
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
          <Text style={styles.goalHint}>
            {today.met ? 'Objetivo cumplido. Buen trabajo.' : `Te faltan ${left} min con buena postura.`}
          </Text>
        </View>
      </View>

      <View style={styles.streakRow}>
        <Pop trigger={String(current)}>
          <Text style={styles.streakNumber}>{current}</Text>
        </Pop>
        <View style={styles.streakText}>
          <Text style={styles.streakLabel}>{current === 1 ? 'día seguido' : 'días seguidos'}</Text>
          <Text style={styles.streakHint}>
            {current > 0 && !todayMet ? 'Cumple hoy para no perder la racha' : `Tu mejor racha: ${best} ${best === 1 ? 'día' : 'días'}`}
          </Text>
        </View>
      </View>

      <View style={styles.badges}>
        {earned.map((badge) => (
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

// -------------------------------------------------------------- semana ---

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Una barra del gráfico: crece desde abajo con un muelle, escalonada por día. */
function Bar({ day, max, index, today }: { day: WeekDay; max: number; index: number; today: boolean }) {
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
          <View style={[styles.barBad, { flex: 1 - good }]} />
          <View style={[styles.barGood, { flex: good }]} />
        </Animated.View>
      </View>
      <Text style={[styles.barLabel, today && styles.barLabelToday]}>{day.label}</Text>
    </View>
  );
}

/** Los últimos siete días: minutos con buena y mala postura, y cómo va la semana. */
export function WeeklyCard({ history, now }: { history: SessionRecord[]; now: number }) {
  const report = weeklyReport(history, now);
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

const styles = StyleSheet.create({
  card: { gap: spacing.lg },

  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  goalText: { flex: 1, gap: 2 },
  goalNumber: { ...type.title1, ...roundedNumbers, color: colors.label },
  goalOf: { ...type.body, color: colors.secondaryLabel },
  goalHint: { ...type.footnote, color: colors.secondaryLabel },

  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  streakNumber: { ...type.title1, ...roundedNumbers, color: colors.tint, minWidth: 36, textAlign: 'center' },
  streakText: { flex: 1 },
  streakLabel: { ...type.headline, color: colors.label },
  streakHint: { ...type.footnote, color: colors.secondaryLabel },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.quaternaryFill,
  },
  badgeEarned: { backgroundColor: withAlpha(colors.yellow, 0.14) },
  badgeText: { ...type.caption1, color: colors.tertiaryLabel },
  badgeTextEarned: { color: colors.label, fontWeight: '600' },

  empty: { ...type.subheadline, color: colors.secondaryLabel },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 120 },
  barColumn: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, overflow: 'hidden', minHeight: 0 },
  barBad: { backgroundColor: colors.yellow },
  barGood: { backgroundColor: colors.green },
  barLabel: { ...type.caption1, color: colors.tertiaryLabel },
  barLabelToday: { color: colors.label, fontWeight: '700' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginLeft: spacing.xs },
  legendText: { ...type.caption1, color: colors.secondaryLabel, marginRight: spacing.sm },

  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: 2 },
  statValue: { ...type.title2, ...roundedNumbers, color: colors.label },
  statLabel: { ...type.footnote, color: colors.secondaryLabel },
  summary: { ...type.subheadline, color: colors.label },
});
