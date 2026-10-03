import Constants from 'expo-constants';
import { View } from 'react-native';

import { useApp } from '../app/AppContext';
import { DayChips, Segmented, Stepper, Toggle, type SegmentOption } from '../components/controls';
import { Row, RowValue, Section, SectionBlock } from '../components/lists';
import { Appear } from '../components/motion';
import type { AlertLevel } from '../core/postureEngine';
import { PROFILE_IDS, PROFILE_LIMITS, PROFILE_NAMES, calibrationKind, type ProfileId } from '../core/profiles';
import { DAY_INITIALS, SCHEDULE_STEP_MIN, describeSchedule, formatClock } from '../core/schedule';
import { LIMITS, clamp, type Settings, type ThemeMode } from '../core/settings';
import { makeStyles, spacing, useTheme } from '../theme';
import { Screen } from './Screen';

const LEVELS: readonly SegmentOption<AlertLevel>[] = [
  { value: 'beep', label: 'Pitido' },
  { value: 'count', label: 'Cuenta' },
  { value: 'alarm', label: 'Alarma' },
];
const LEVEL_NOTES: Record<AlertLevel, string> = {
  beep: 'Solo el pitido, y vuelve a pitar si sigues agachado. Para clase o la biblioteca.',
  count: 'Pitido y la cuenta «uno, dos, tres», sin sirena ni notificación.',
  alarm: 'La secuencia entera: pitido, cuenta y alarma hasta que te enderezas.',
};
const THEMES: readonly SegmentOption<ThemeMode>[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];
const PROFILE_OPTIONS = PROFILE_IDS.map((id) => ({ value: id, label: PROFILE_NAMES[id] }));

type ToggleKey =
  | 'easWithHeadphones'
  | 'easAlways'
  | 'voiceEnabled'
  | 'manualHeadphones'
  | 'vibrationEnabled'
  | 'notificationsEnabled'
  | 'keepAwake'
  | 'controlMode'
  | 'uiHaptics'
  | 'standReminder';

const useStyles = makeStyles(() => ({
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
}));

const fmt = (n: number, decimals = 0) => n.toFixed(decimals).replace('.', ',');

export function SettingsScreen({ onCalibrate }: { onCalibrate: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { monitor } = useApp();
  const { settings, profile, running } = monitor;
  const kind = calibrationKind(profile);
  const name = PROFILE_NAMES[settings.activeProfile];

  const toggle = (key: ToggleKey, label: string) => (
    <Toggle value={settings[key]} onValueChange={(next) => monitor.updateSettings({ [key]: next } as Partial<Settings>)} accessibilityLabel={label} />
  );

  const stepper = (label: string, value: string, decrease: () => void, increase: () => void, canDecrease: boolean, canIncrease: boolean) => (
    <View style={styles.stepperRow}>
      <RowValue>{value}</RowValue>
      <Stepper label={label} onDecrease={decrease} onIncrease={increase} canDecrease={canDecrease} canIncrease={canIncrease} />
    </View>
  );

  const bumpProfile = (key: 'thresholdDeg' | 'graceSeconds', direction: 1 | -1) => {
    const limits = PROFILE_LIMITS[key];
    const next = Math.round((profile[key] + direction * limits.step) / limits.step) * limits.step;
    monitor.updateProfile({ [key]: clamp(Number(next.toFixed(3)), limits.min, limits.max) });
  };

  const bump = (key: 'volume' | 'standEveryMinutes', direction: 1 | -1) => {
    const limits = LIMITS[key];
    const next = Math.round((settings[key] + direction * limits.step) / limits.step) * limits.step;
    monitor.updateSettings({ [key]: clamp(Number(next.toFixed(3)), limits.min, limits.max) });
  };

  const schedule = settings.schedule;
  const setSchedule = (patch: Partial<Settings['schedule']>) => monitor.updateSettings({ schedule: { ...schedule, ...patch } });
  const shiftTime = (key: 'startMin' | 'endMin', direction: 1 | -1) =>
    setSchedule({ [key]: (schedule[key] + direction * SCHEDULE_STEP_MIN + 24 * 60) % (24 * 60) });

  return (
    <Screen title="Ajustes">
      <Appear index={1}>
        <Section header="Perfil" footer={running ? 'Para la vigilancia para cambiar de perfil.' : 'Cada perfil guarda su calibración y sus límites.'}>
          <SectionBlock>
            <Segmented
              options={PROFILE_OPTIONS}
              value={settings.activeProfile}
              onChange={(id: ProfileId) => monitor.setActiveProfile(id)}
              accessibilityLabel="Perfil"
              disabled={running}
            />
          </SectionBlock>
          <Row
            title={`Calibrar «${name}»`}
            subtitle={kind === 'two-step' ? 'Precisa: sabe dónde es delante' : kind === 'upright' ? 'Solo postura recta' : 'Sin calibrar'}
            icon="person"
            iconColor={kind === 'none' ? colors.neutral : colors.green}
            onPress={onCalibrate}
          />
        </Section>
      </Appear>

      <Appear index={2}>
        <Section header={`Sensibilidad · ${name}`} footer="El umbral son los grados de mala postura que se toleran; el margen, cuánto aguantas así antes del pitido.">
          <Row
            title="Umbral"
            accessory={stepper(
              'el umbral',
              `${Math.round(profile.thresholdDeg)}°`,
              () => bumpProfile('thresholdDeg', -1),
              () => bumpProfile('thresholdDeg', 1),
              profile.thresholdDeg > PROFILE_LIMITS.thresholdDeg.min,
              profile.thresholdDeg < PROFILE_LIMITS.thresholdDeg.max
            )}
          />
          <Row
            title="Margen antes del pitido"
            accessory={stepper(
              'el margen',
              `${fmt(profile.graceSeconds, 1)} s`,
              () => bumpProfile('graceSeconds', -1),
              () => bumpProfile('graceSeconds', 1),
              profile.graceSeconds > PROFILE_LIMITS.graceSeconds.min,
              profile.graceSeconds < PROFILE_LIMITS.graceSeconds.max
            )}
          />
          <Row
            title="No contar echarse atrás"
            subtitle={kind === 'two-step' ? 'Recostarse en la silla no es encorvarse' : 'Necesita la calibración precisa'}
            accessory={
              <Toggle
                value={profile.ignoreBackward}
                onValueChange={(next) => monitor.updateProfile({ ignoreBackward: next })}
                accessibilityLabel="No contar echarse atrás"
                disabled={kind !== 'two-step'}
              />
            }
          />
        </Section>
      </Appear>

      <Appear index={3}>
        <Section header={`Hasta dónde avisa · ${name}`} footer={LEVEL_NOTES[profile.maxAlertLevel]}>
          <SectionBlock>
            <Segmented
              options={LEVELS}
              value={profile.maxAlertLevel}
              onChange={(maxAlertLevel) => monitor.updateProfile({ maxAlertLevel })}
              accessibilityLabel="Hasta dónde avisa"
            />
          </SectionBlock>
        </Section>
      </Appear>

      <Appear index={4}>
        <Section
          header="Horario"
          footer={
            schedule.enabled
              ? `Avisa ${describeSchedule(schedule)}. Fuera de horario no pita ni cuenta tiempo encorvado.`
              : 'Sin horario, avisa siempre que esté vigilando.'
          }>
          <Row
            title="Vigilar solo en horario"
            icon="clock"
            iconColor={colors.tint}
            accessory={<Toggle value={schedule.enabled} onValueChange={(enabled) => setSchedule({ enabled })} accessibilityLabel="Vigilar solo en horario" />}
          />
          {schedule.enabled ? (
            <SectionBlock>
              <DayChips
                labels={DAY_INITIALS}
                values={schedule.days}
                onToggle={(index) => setSchedule({ days: schedule.days.map((on, i) => (i === index ? !on : on)) })}
              />
            </SectionBlock>
          ) : null}
          {schedule.enabled ? (
            <Row
              title="Desde"
              accessory={stepper('la hora de inicio', formatClock(schedule.startMin), () => shiftTime('startMin', -1), () => shiftTime('startMin', 1), true, true)}
            />
          ) : null}
          {schedule.enabled ? (
            <Row
              title="Hasta"
              accessory={stepper('la hora de fin', formatClock(schedule.endMin), () => shiftTime('endMin', -1), () => shiftTime('endMin', 1), true, true)}
            />
          ) : null}
        </Section>
      </Appear>

      <Appear index={5}>
        <Section
          header="Descansos"
          footer="Aunque la postura sea buena, pasar horas sentado tampoco lo es. Caminar un rato reinicia la cuenta. Con el perfil «De pie» no avisa.">
          <Row title="Recordar levantarse" icon="bell" iconColor={colors.green} accessory={toggle('standReminder', 'Recordar levantarse')} />
          {settings.standReminder ? (
            <Row
              title="Cada"
              accessory={stepper(
                'el intervalo',
                `${settings.standEveryMinutes} min`,
                () => bump('standEveryMinutes', -1),
                () => bump('standEveryMinutes', 1),
                settings.standEveryMinutes > LIMITS.standEveryMinutes.min,
                settings.standEveryMinutes < LIMITS.standEveryMinutes.max
              )}
            />
          ) : null}
        </Section>
      </Appear>

      <Appear index={6}>
        <Section header="Sonido" footer="Con auriculares suena el tono de emergencia EAS (853 + 960 Hz); por el altavoz, una sirena de dos tonos.">
          <Row
            title="Volumen"
            accessory={stepper(
              'el volumen',
              `${Math.round(settings.volume * 100)} %`,
              () => bump('volume', -1),
              () => bump('volume', 1),
              settings.volume > LIMITS.volume.min,
              settings.volume < LIMITS.volume.max
            )}
          />
          <Row title="Tono EAS con auriculares" accessory={toggle('easWithHeadphones', 'Tono EAS con auriculares')} />
          <Row title="Tono EAS siempre" subtitle="También por el altavoz" accessory={toggle('easAlways', 'Tono EAS siempre')} />
          <Row title="Voz" subtitle="Cuenta, calibración y recordatorios" accessory={toggle('voiceEnabled', 'Voz')} />
          {monitor.headphones.detectionAvailable ? null : (
            <Row title="Llevo auriculares" subtitle="Esta versión no los detecta sola" accessory={toggle('manualHeadphones', 'Llevo auriculares')} />
          )}
        </Section>
      </Appear>

      <Appear index={7}>
        <Section header="Avisos" footer="Con la pantalla bloqueada el sistema apaga los sensores: mantenerla encendida es lo que deja vigilar sin tocar el móvil.">
          <Row title="Vibración" accessory={toggle('vibrationEnabled', 'Vibración')} />
          <Row title="Notificaciones" accessory={toggle('notificationsEnabled', 'Notificaciones')} />
          <Row title="Mantener la pantalla encendida" accessory={toggle('keepAwake', 'Mantener la pantalla encendida')} />
        </Section>
      </Appear>

      <Appear index={8}>
        <Section header="Apariencia">
          <Row title="Tema" icon={settings.theme === 'light' ? 'sun' : 'moon'} iconColor={colors.neutral} />
          <SectionBlock>
            <Segmented options={THEMES} value={settings.theme} onChange={(theme) => monitor.updateSettings({ theme })} accessibilityLabel="Tema" />
          </SectionBlock>
          <Row title="Toques al pulsar" accessory={toggle('uiHaptics', 'Toques al pulsar')} />
        </Section>
      </Appear>

      <Appear index={9}>
        <Section header="Experimento" footer="Una sesión de control mide y registra igual, pero sin pitar, hablar ni vibrar. Es el grupo con el que comparar.">
          <Row title="Sesión de control" accessory={toggle('controlMode', 'Sesión de control')} />
        </Section>
      </Appear>

      <Appear index={10}>
        <Section header="Acerca de">
          <Row title="Versión" accessory={<RowValue>{Constants.expoConfig?.version ?? '—'}</RowValue>} />
          <Row
            title="Sensor"
            accessory={<RowValue>{monitor.fused ? 'Giroscopio + acelerómetro' : monitor.fused === false ? 'Acelerómetro' : '—'}</RowValue>}
          />
        </Section>
      </Appear>
    </Screen>
  );
}
