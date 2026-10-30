import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';

import { useApp } from '../app/AppContext';
import { Button, CheckBox, Stepper } from '../components/controls';
import { Icon, type IconName } from '../components/Icon';
import { MorphShape, ProgressBar } from '../components/indicators';
import { Row, RowValue, Section } from '../components/lists';
import { Appear } from '../components/motion';
import { GlassSurface } from '../components/Surface';
import { EXPERIMENTS, FALLBACK_PRICES, annualSavings, type ExperimentKey, type LabsPlan } from '../core/labs';
import { LIMITS, clamp } from '../core/settings';
import { ROUTINES, routineDurationMs, type Routine } from '../core/stretches';
import { TRIAL_DAYS } from '../core/trial';
import { MANAGE_SUBSCRIPTION_URL } from '../services/purchases';
import { continuous, makeStyles, radius, roundedNumbers, spacing, type, useTheme, withAlpha } from '../theme';
import { Screen } from './Screen';

const ICONS: Record<ExperimentKey, { icon: IconName; tone: 'tint' | 'green' | 'yellow' }> = {
  labsStreaks: { icon: 'flame', tone: 'tint' },
  labsWeekly: { icon: 'chart', tone: 'green' },
  labsStretches: { icon: 'stretch', tone: 'yellow' },
};
const SHAPES = ['cookie9', 'flower8', 'cookie6'] as const;

const useStyles = makeStyles((t) => ({
  banner: { padding: spacing.lg, gap: spacing.md },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bannerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...continuous },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { ...type.headline, color: t.colors.label },
  bannerBody: { ...type.footnote, color: t.colors.secondaryLabel },
  list: { paddingHorizontal: spacing.lg },
  experiment: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  divider: { borderTopWidth: 0.5, borderTopColor: t.colors.separator },
  experimentText: { flex: 1, gap: 3 },
  experimentTitle: { ...type.headline, color: t.colors.label },
  experimentBody: { ...type.footnote, color: t.colors.secondaryLabel },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  routines: { gap: spacing.md },
  routine: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  routineShape: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...continuous },
  routineText: { flex: 1, gap: 2 },
  routineTitle: { ...type.headline, color: t.colors.label },
  routineSubtitle: { ...type.footnote, color: t.colors.secondaryLabel },
  routineTime: { ...type.subheadline, ...roundedNumbers, color: t.colors.secondaryLabel },
  sectionHeader: { ...type.title3, fontWeight: '700', color: t.colors.label, marginBottom: -spacing.sm },
  plans: { gap: spacing.md },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.large,
    borderWidth: 1.5,
    borderColor: t.colors.separator,
    backgroundColor: t.colors.quaternaryFill,
    ...continuous,
  },
  planOn: { borderColor: t.colors.tint, backgroundColor: withAlpha(t.colors.tint, 0.1) },
  planText: { flex: 1, gap: 2 },
  planTitle: { ...type.headline, color: t.colors.label },
  planDetail: { ...type.footnote, color: t.colors.secondaryLabel },
  planPrice: { alignItems: 'flex-end' },
  price: { ...type.headline, ...roundedNumbers, color: t.colors.label },
  period: { ...type.caption1, color: t.colors.secondaryLabel },
  saving: {
    position: 'absolute',
    top: -9,
    right: spacing.lg,
    backgroundColor: t.colors.green,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  savingText: { ...type.caption1, fontWeight: '700', color: t.colors.onStatus },
  fine: { ...type.caption1, color: t.colors.tertiaryLabel, textAlign: 'center', lineHeight: 17 },
  message: { ...type.subheadline, color: t.colors.label, textAlign: 'center' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
}));

export function LabsScreen({ onStretch }: { onStretch: (routine: Routine) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { monitor, labs } = useApp();
  const { settings } = monitor;
  const [plan, setPlan] = useState<LabsPlan>('annual');
  const tone = (name: 'tint' | 'green' | 'yellow') => (name === 'tint' ? colors.tint : colors[name]);

  const trial = labs.trial;
  const monthly = labs.offer?.monthly?.product;
  const annual = labs.offer?.annual?.product;
  const prices = {
    monthly: { label: monthly?.priceString ?? FALLBACK_PRICES.monthly.label, period: 'al mes', amount: monthly?.price ?? FALLBACK_PRICES.monthly.amount },
    annual: { label: annual?.priceString ?? FALLBACK_PRICES.annual.label, period: 'al año', amount: annual?.price ?? FALLBACK_PRICES.annual.amount },
  };
  const saving = annualSavings(prices.monthly.amount, prices.annual.amount);
  const planAvailable = labs.offer?.[plan] != null;
  const goal = settings.dailyGoalMinutes;
  const bumpGoal = (direction: 1 | -1) =>
    monitor.updateSettings({
      dailyGoalMinutes: clamp(goal + direction * LIMITS.dailyGoalMinutes.step, LIMITS.dailyGoalMinutes.min, LIMITS.dailyGoalMinutes.max),
    });

  const banner = labs.subscribed
    ? { icon: 'check' as const, color: colors.green, title: 'Suscripción activa', body: 'Gracias por apoyar PostureFix.' }
    : trial?.active
      ? {
          icon: 'gift' as const,
          color: colors.tint,
          title: `Prueba gratis: te quedan ${trial.daysLeft} ${trial.daysLeft === 1 ? 'día' : 'días'}`,
          body: `Labs está abierto ${TRIAL_DAYS} días desde que estrenaste la 2.0, sin pagar nada ni dar ningún dato.`,
        }
      : trial
        ? { icon: 'lock' as const, color: colors.neutral, title: 'La prueba gratis ha terminado', body: 'Suscríbete para seguir con Labs.' }
        : null;

  return (
    <Screen title="Labs" subtitle="Experimentos para ir más allá de la alarma">
      {banner ? (
        <Appear index={1}>
          <GlassSurface material="regular" cornerRadius={radius.large} tintColor={withAlpha(banner.color, 0.12)} style={styles.banner}>
            <View style={styles.bannerHead}>
              <View style={[styles.bannerIcon, { backgroundColor: banner.color }]}>
                <Icon name={banner.icon} size={24} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                <Text style={styles.bannerBody}>{banner.body}</Text>
              </View>
            </View>
            {!labs.subscribed && trial?.active ? (
              <ProgressBar progress={trial.daysLeft / TRIAL_DAYS} color={colors.tint} height={6} />
            ) : null}
          </GlassSurface>
        </Appear>
      ) : null}

      <Appear index={2}>
        <GlassSurface material="regular" cornerRadius={radius.large} style={styles.list}>
          {EXPERIMENTS.map((experiment, index) => {
            const { icon, tone: t } = ICONS[experiment.key];
            return (
              <View key={experiment.key} style={[styles.experiment, index > 0 && styles.divider]}>
                <Icon name={icon} color={tone(t)} size={24} />
                <View style={styles.experimentText}>
                  <Text style={styles.experimentTitle}>{experiment.title}</Text>
                  <Text style={styles.experimentBody}>{experiment.description}</Text>
                </View>
                {labs.active ? (
                  <CheckBox
                    checked={settings[experiment.key]}
                    onToggle={(next) => monitor.updateSettings({ [experiment.key]: next })}
                    accessibilityLabel={experiment.title}
                  />
                ) : (
                  <Icon name="lock" color={colors.tertiaryLabel} size={20} />
                )}
              </View>
            );
          })}
        </GlassSurface>
      </Appear>

      {labs.active && settings.labsStretches ? (
        <Appear index={3} style={styles.routines}>
          <Text style={styles.sectionHeader} accessibilityRole="header">
            Estirar dos minutos
          </Text>
          {ROUTINES.map((routine, index) => (
            <Pressable
              key={routine.id}
              onPress={() => onStretch(routine)}
              accessibilityRole="button"
              accessibilityLabel={`${routine.title}, ${Math.round(routineDurationMs(routine) / 60000)} minutos`}
              style={({ pressed }) => pressed && styles.pressed}>
              <GlassSurface material="regular" cornerRadius={radius.large} style={styles.routine}>
                <View style={[styles.routineShape, { backgroundColor: withAlpha(colors.yellow, 0.16) }]}>
                  <MorphShape shape={SHAPES[index % SHAPES.length]} size={40} color={colors.yellow} />
                </View>
                <View style={styles.routineText}>
                  <Text style={styles.routineTitle}>{routine.title}</Text>
                  <Text style={styles.routineSubtitle}>{routine.subtitle}</Text>
                </View>
                <Text style={styles.routineTime}>{Math.round(routineDurationMs(routine) / 60000)} min</Text>
              </GlassSurface>
            </Pressable>
          ))}
        </Appear>
      ) : null}

      {labs.active && settings.labsStreaks ? (
        <Appear index={4}>
          <Section header="Objetivo diario" footer="Minutos con buena postura al día. Cumplirlo días seguidos hace crecer la racha.">
            <Row
              title="Buena postura al día"
              accessory={
                <View style={styles.stepperRow}>
                  <RowValue>{goal} min</RowValue>
                  <Stepper
                    label="el objetivo"
                    onDecrease={() => bumpGoal(-1)}
                    onIncrease={() => bumpGoal(1)}
                    canDecrease={goal > LIMITS.dailyGoalMinutes.min}
                    canIncrease={goal < LIMITS.dailyGoalMinutes.max}
                  />
                </View>
              }
            />
          </Section>
        </Appear>
      ) : null}

      {!labs.subscribed && labs.store === 'ready' ? (
        <Appear index={5} style={styles.plans}>
          <Text style={styles.sectionHeader} accessibilityRole="header">
            {trial?.active ? 'Cuando acabe la prueba' : 'Suscríbete a Labs'}
          </Text>
          {(['annual', 'monthly'] as const).map((key) => {
            const on = plan === key;
            return (
              <Pressable
                key={key}
                onPress={() => setPlan(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${key === 'annual' ? 'Anual' : 'Mensual'}, ${prices[key].label} ${prices[key].period}`}
                style={[styles.plan, on && styles.planOn]}>
                <CheckBox checked={on} accessibilityLabel={key === 'annual' ? 'Anual' : 'Mensual'} size={22} />
                <View style={styles.planText}>
                  <Text style={styles.planTitle}>{key === 'annual' ? 'Anual' : 'Mensual'}</Text>
                  <Text style={styles.planDetail}>
                    {key === 'annual' && annual?.pricePerMonthString
                      ? `Sale a ${annual.pricePerMonthString} al mes`
                      : key === 'annual'
                        ? 'Un pago al año'
                        : 'Cancela cuando quieras'}
                  </Text>
                </View>
                <View style={styles.planPrice}>
                  <Text style={styles.price}>{prices[key].label}</Text>
                  <Text style={styles.period}>{prices[key].period}</Text>
                </View>
                {key === 'annual' && saving ? (
                  <View style={styles.saving}>
                    <Text style={styles.savingText}>−{Math.round(saving * 100)} %</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          <Button
            label={labs.busy === 'buy' ? 'Abriendo la tienda…' : `Suscribirme por ${prices[plan].label}`}
            onPress={() => void labs.purchase(plan)}
            variant={trial?.active ? 'glass' : 'prominent'}
            size="large"
            disabled={!planAvailable || labs.busy != null}
            haptic="medium"
          />
          {!planAvailable ? (
            <>
              <Text style={styles.fine}>La tienda no ha devuelto este plan. Comprueba la conexión o vuelve a intentarlo en un rato.</Text>
              <Button label="Reintentar" onPress={labs.retry} variant="plain" size="small" />
            </>
          ) : null}
          <Button
            label={labs.busy === 'restore' ? 'Restaurando…' : 'Restaurar compras'}
            onPress={() => void labs.restore()}
            variant="plain"
            size="small"
            disabled={labs.busy != null}
          />
          {labs.busy ? <ActivityIndicator color={colors.secondaryLabel} /> : null}
          <Text style={styles.fine}>
            El pago se carga en tu cuenta de App Store o Google Play al confirmar la compra. La suscripción se renueva sola cada{' '}
            {plan === 'annual' ? 'año' : 'mes'} hasta que la canceles desde los ajustes de tu cuenta, al menos 24 horas antes de que acabe
            el periodo. Vigilar la postura y las alertas siguen siendo gratis.
          </Text>
        </Appear>
      ) : null}

      {!labs.subscribed && labs.store === 'unavailable' && !trial?.active ? (
        <Text style={styles.fine}>
          Las compras no están disponibles en esta versión de la app. Hace falta la versión instalada desde App Store o Google Play.
        </Text>
      ) : null}

      {labs.subscribed && labs.store === 'ready' ? (
        <Button
          label="Gestionar suscripción"
          onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
          variant="plain"
          accessibilityHint="Abre la tienda para cambiar o cancelar la suscripción"
        />
      ) : null}

      {labs.message ? (
        <Text style={[styles.message, labs.message.tone === 'error' && { color: colors.red }]}>{labs.message.text}</Text>
      ) : null}
    </Screen>
  );
}
