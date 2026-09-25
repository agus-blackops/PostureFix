import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { EXPERIMENTS, FALLBACK_PRICES, annualSavings, type LabsPlan } from '../core/labs';
import { LIMITS, clamp, type Settings } from '../core/settings';
import type { Labs } from '../hooks/useLabs';
import { MANAGE_SUBSCRIPTION_URL } from '../services/purchases';
import { LoadingIndicator } from './expressive';
import { Button, GlassSurface, ListGroup, ListRow, Stepper } from './glass';
import { Sheet } from './Sheet';
import { CheckBox, Icon, type IconName } from './things';
import { colors, continuous, radius, roundedNumbers, spacing, type, withAlpha } from './theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  labs: Labs;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

const EXPERIMENT_ICONS: Record<(typeof EXPERIMENTS)[number]['key'], { icon: IconName; color: string }> = {
  labsStreaks: { icon: 'flame', color: colors.tint },
  labsWeekly: { icon: 'chart', color: colors.green },
  labsStretches: { icon: 'stretch', color: colors.yellow },
};

/**
 * PostureFix Labs: los experimentos y la suscripción que los abre. Con la
 * suscripción activa cada experimento se enciende o se apaga con su casilla;
 * sin ella, la misma lista hace de escaparate y debajo van los dos planes.
 */
export function LabsSheet({ visible, onClose, labs, settings, onChange }: Props) {
  const [plan, setPlan] = useState<LabsPlan>('annual');

  const monthlyProduct = labs.offer?.monthly?.product;
  const annualProduct = labs.offer?.annual?.product;
  const prices: Record<LabsPlan, { label: string; period: string; amount: number }> = {
    monthly: {
      label: monthlyProduct?.priceString ?? FALLBACK_PRICES.monthly.label,
      period: FALLBACK_PRICES.monthly.period,
      amount: monthlyProduct?.price ?? FALLBACK_PRICES.monthly.amount,
    },
    annual: {
      label: annualProduct?.priceString ?? FALLBACK_PRICES.annual.label,
      period: FALLBACK_PRICES.annual.period,
      amount: annualProduct?.price ?? FALLBACK_PRICES.annual.amount,
    },
  };
  const saving = annualSavings(prices.monthly.amount, prices.annual.amount);
  const perMonth = annualProduct?.pricePerMonthString ?? null;
  const planAvailable = labs.offer?.[plan] != null;

  const goal = settings.dailyGoalMinutes;
  const bumpGoal = (direction: 1 | -1) =>
    onChange({
      dailyGoalMinutes: clamp(goal + direction * LIMITS.dailyGoalMinutes.step, LIMITS.dailyGoalMinutes.min, LIMITS.dailyGoalMinutes.max),
    });

  return (
    <Sheet visible={visible} title="PostureFix Labs" onClose={onClose}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon name="flask" color={colors.onTint} size={30} />
        </View>
        <Text style={styles.heroTitle}>PostureFix Labs</Text>
        <Text style={styles.heroText}>
          Experimentos para ir más allá de la alarma. Los probamos aquí antes de que lleguen a la app para todos.
        </Text>
      </View>

      <GlassSurface material="regular" cornerRadius={radius.large} style={styles.list}>
        {EXPERIMENTS.map((experiment, index) => {
          const { icon, color } = EXPERIMENT_ICONS[experiment.key];
          const on = settings[experiment.key];
          return (
            <View key={experiment.key} style={[styles.experiment, index > 0 && styles.experimentDivider]}>
              <Icon name={icon} color={color} size={24} />
              <View style={styles.experimentText}>
                <Text style={styles.experimentTitle}>{experiment.title}</Text>
                <Text style={styles.experimentBody}>{experiment.description}</Text>
              </View>
              {labs.active ? (
                <CheckBox
                  checked={on}
                  onToggle={(next) => onChange({ [experiment.key]: next })}
                  accessibilityLabel={experiment.title}
                />
              ) : (
                <Icon name="lock" color={colors.tertiaryLabel} size={20} />
              )}
            </View>
          );
        })}
      </GlassSurface>

      {labs.active ? (
        <>
          <ListGroup header="Objetivo diario" footer="Minutos con buena postura al día. Cumplirlo varios días seguidos es lo que hace crecer la racha.">
            <ListRow
              title="Buena postura al día"
              accessory={
                <View style={styles.stepperRow}>
                  <Text style={styles.value}>{goal} min</Text>
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
          </ListGroup>

          <View style={styles.activeBox}>
            <CheckBox checked accessibilityLabel="Suscripción activa" color={colors.green} />
            <Text style={styles.activeText}>Suscripción activa. Gracias por apoyar PostureFix.</Text>
          </View>
          {labs.status === 'ready' ? (
            <Button
              label="Gestionar suscripción"
              onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
              variant="plain"
              accessibilityHint="Abre la tienda para cambiar o cancelar la suscripción"
            />
          ) : null}
        </>
      ) : null}

      {!labs.active && labs.status === 'loading' ? (
        <View style={styles.loading}>
          <LoadingIndicator size={44} />
          <Text style={styles.fine}>Preguntando precios a la tienda…</Text>
        </View>
      ) : null}

      {!labs.active && labs.status === 'ready' ? (
        <View style={styles.plans}>
          {(['annual', 'monthly'] as const).map((key) => {
            const selected = plan === key;
            return (
              <Pressable
                key={key}
                onPress={() => setPlan(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${key === 'annual' ? 'Anual' : 'Mensual'}, ${prices[key].label} ${prices[key].period}`}
                style={[styles.plan, selected && styles.planSelected]}>
                <CheckBox checked={selected} accessibilityLabel={key === 'annual' ? 'Anual' : 'Mensual'} size={22} />
                <View style={styles.planText}>
                  <Text style={styles.planTitle}>{key === 'annual' ? 'Anual' : 'Mensual'}</Text>
                  <Text style={styles.planDetail}>
                    {key === 'annual' && perMonth ? `Sale a ${perMonth} al mes` : key === 'annual' ? 'Un pago al año' : 'Cancela cuando quieras'}
                  </Text>
                </View>
                <View style={styles.planPrice}>
                  <Text style={styles.price}>{prices[key].label}</Text>
                  <Text style={styles.period}>{prices[key].period}</Text>
                </View>
                {key === 'annual' && saving ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>−{Math.round(saving * 100)} %</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          <Button
            label={labs.busy === 'buy' ? 'Abriendo la tienda…' : `Suscribirme por ${prices[plan].label}`}
            onPress={() => void labs.purchase(plan)}
            variant="prominent"
            size="large"
            disabled={!planAvailable || labs.busy != null}
            haptic="medium"
          />
          {!planAvailable ? (
            <Text style={styles.fine}>
              La tienda no ha devuelto este plan. Comprueba la conexión o vuelve a intentarlo en un rato.
            </Text>
          ) : null}
          <View style={styles.row}>
            <Button
              label={labs.busy === 'restore' ? 'Restaurando…' : 'Restaurar compras'}
              onPress={() => void labs.restore()}
              variant="plain"
              size="small"
              disabled={labs.busy != null}
            />
            {!planAvailable ? <Button label="Reintentar" onPress={labs.retry} variant="plain" size="small" /> : null}
          </View>
          {labs.busy ? <ActivityIndicator color={colors.secondaryLabel} /> : null}
          <Text style={styles.fine}>
            El pago se carga en tu cuenta de App Store o Google Play al confirmar la compra. La suscripción se renueva sola
            cada {plan === 'annual' ? 'año' : 'mes'} hasta que la canceles desde los ajustes de tu cuenta, al menos 24 horas
            antes de que acabe el periodo. Vigilar la postura y las alertas siguen siendo gratis.
          </Text>
        </View>
      ) : null}

      {!labs.active && labs.status === 'unavailable' ? (
        <View style={styles.unavailable}>
          <Text style={styles.fine}>
            Las compras no están disponibles en esta versión de la app. Hace falta la versión instalada desde App Store o Google
            Play.
          </Text>
          {labs.devUnlock ? (
            <Button label="Probar Labs (solo desarrollo)" onPress={labs.devUnlock} variant="glass" />
          ) : null}
        </View>
      ) : null}

      {labs.message ? (
        <Text style={[styles.message, labs.message.tone === 'error' && styles.messageError]}>{labs.message.text}</Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    ...continuous,
  },
  heroTitle: { ...type.title1, color: colors.label, marginTop: spacing.xs },
  heroText: { ...type.subheadline, color: colors.secondaryLabel, textAlign: 'center', maxWidth: 320 },

  list: { paddingHorizontal: spacing.lg },
  experiment: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  experimentDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  experimentText: { flex: 1, gap: 3 },
  experimentTitle: { ...type.headline, color: colors.label },
  experimentBody: { ...type.footnote, color: colors.secondaryLabel },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  value: { ...type.body, ...roundedNumbers, color: colors.secondaryLabel, minWidth: 64, textAlign: 'right' },

  activeBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xs },
  activeText: { ...type.subheadline, color: colors.label, flex: 1 },

  loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },

  plans: { gap: spacing.md },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.large,
    borderWidth: 1.5,
    borderColor: colors.separator,
    backgroundColor: colors.quaternaryFill,
    ...continuous,
  },
  planSelected: { borderColor: colors.tint, backgroundColor: withAlpha(colors.tint, 0.1) },
  planText: { flex: 1, gap: 2 },
  planTitle: { ...type.headline, color: colors.label },
  planDetail: { ...type.footnote, color: colors.secondaryLabel },
  planPrice: { alignItems: 'flex-end' },
  price: { ...type.headline, ...roundedNumbers, color: colors.label },
  period: { ...type.caption1, color: colors.secondaryLabel },
  badge: {
    position: 'absolute',
    top: -9,
    right: spacing.lg,
    backgroundColor: colors.green,
    borderRadius: radius.capsule,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { ...type.caption1, fontWeight: '700', color: colors.onStatus },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  fine: { ...type.caption1, color: colors.tertiaryLabel, textAlign: 'center', lineHeight: 17 },

  unavailable: { gap: spacing.md },
  message: { ...type.subheadline, color: colors.label, textAlign: 'center' },
  messageError: { color: colors.red },
});
