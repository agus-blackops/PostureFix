import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ROUTINES, SAFETY_NOTE, positionAt, routineDurationMs, stepStartMs, type Routine } from '../core/stretches';
import { fireHaptic } from '../services/haptics';
import { speak, stopSpeaking } from '../services/speech';
import { MorphShape, WavyRing } from './expressive';
import { Button, ButtonGroup, GlassSurface } from './glass';
import { Sheet } from './Sheet';
import { CheckBox, Icon, PieProgress } from './things';
import { colors, continuous, radius, roundedNumbers, spacing, type, withAlpha } from './theme';

const TICK_MS = 200;
const SHAPES = ['cookie9', 'flower8', 'cookie6', 'pentagon', 'burst12'] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  voiceEnabled: boolean;
  vibrationEnabled: boolean;
}

/**
 * Estiramientos guiados: se elige una rutina y un reloj va pasando los pasos,
 * leyendo cada uno en voz alta. Los pasos hechos se tachan con su casilla,
 * como las tareas de Things, y al acabar la rutina entera se marca sola.
 */
export function StretchSheet({ visible, onClose, voiceEnabled, vibrationEnabled }: Props) {
  const [routine, setRoutine] = useState<Routine | null>(null);

  // Al cerrar la hoja se para todo y se vuelve a la lista.
  useEffect(() => {
    if (!visible) {
      stopSpeaking();
      const timer = setTimeout(() => setRoutine(null), 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  return (
    <Sheet visible={visible} title="Estiramientos" onClose={onClose} scroll={routine == null}>
      {routine ? (
        <Player
          routine={routine}
          voiceEnabled={voiceEnabled}
          vibrationEnabled={vibrationEnabled}
          onExit={() => {
            stopSpeaking();
            setRoutine(null);
          }}
        />
      ) : (
        <>
          <Text style={styles.intro}>Dos minutos para despegarte de la pantalla. Sentado vale.</Text>
          {ROUTINES.map((each, index) => (
            <Pressable
              key={each.id}
              onPress={() => setRoutine(each)}
              accessibilityRole="button"
              accessibilityLabel={`${each.title}, ${Math.round(routineDurationMs(each) / 60000)} minutos`}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <GlassSurface material="regular" cornerRadius={radius.large} style={styles.routine}>
                <View style={[styles.routineShape, { backgroundColor: withAlpha(colors.yellow, 0.14) }]}>
                  <MorphShape shape={SHAPES[index % SHAPES.length]} size={40} color={colors.yellow} />
                </View>
                <View style={styles.routineText}>
                  <Text style={styles.routineTitle}>{each.title}</Text>
                  <Text style={styles.routineSubtitle}>{each.subtitle}</Text>
                </View>
                <Text style={styles.routineTime}>{Math.round(routineDurationMs(each) / 60000)} min</Text>
              </GlassSurface>
            </Pressable>
          ))}
          <Text style={styles.safety}>{SAFETY_NOTE}</Text>
        </>
      )}
    </Sheet>
  );
}

function Player({
  routine,
  voiceEnabled,
  vibrationEnabled,
  onExit,
}: {
  routine: Routine;
  voiceEnabled: boolean;
  vibrationEnabled: boolean;
  onExit: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const elapsedRef = useRef(0);
  const spokenRef = useRef(-1);
  const position = positionAt(routine, elapsed);
  const step = routine.steps[position.index];

  // El reloj sólo avanza mientras no está en pausa.
  useEffect(() => {
    if (!running || position.done) return undefined;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      elapsedRef.current += now - last;
      last = now;
      setElapsed(elapsedRef.current);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [position.done, running]);

  // Pantalla encendida mientras dura la rutina: se sigue sin tocar el móvil.
  useEffect(() => {
    void activateKeepAwakeAsync('posturefix-stretch').catch(() => undefined);
    return () => {
      void deactivateKeepAwake('posturefix-stretch');
    };
  }, []);

  // Cada paso nuevo se anuncia en voz alta y con un toque.
  useEffect(() => {
    if (position.done) {
      if (spokenRef.current !== routine.steps.length) {
        spokenRef.current = routine.steps.length;
        speak('Hecho. Buen trabajo.', voiceEnabled);
        void fireHaptic('success', vibrationEnabled);
      }
      return;
    }
    if (spokenRef.current !== position.index) {
      spokenRef.current = position.index;
      stopSpeaking();
      speak(`${step.title}. ${step.instruction}`, voiceEnabled);
      if (position.index > 0) void fireHaptic('tick', vibrationEnabled);
    }
  }, [position.done, position.index, routine.steps.length, step, vibrationEnabled, voiceEnabled]);

  useEffect(() => () => stopSpeaking(), []);

  const jump = (index: number) => {
    elapsedRef.current = stepStartMs(routine, index);
    setElapsed(elapsedRef.current);
    setRunning(true);
  };

  const seconds = Math.ceil(position.stepRemainingMs / 1000);

  return (
    <ScrollView contentContainerStyle={styles.player} showsVerticalScrollIndicator={false}>
      <View style={styles.ringWrap}>
        <WavyRing
          size={210}
          stroke={12}
          progress={position.done ? 1 : position.stepProgress}
          color={position.done ? colors.green : colors.yellow}
          trackColor={colors.tertiaryFill}
          urgency={running && !position.done ? 0.2 : 0}>
          {position.done ? (
            <CheckBox checked accessibilityLabel="Rutina terminada" color={colors.green} size={64} />
          ) : (
            <>
              <Text style={styles.seconds}>{seconds}</Text>
              <Text style={styles.secondsLabel}>{running ? 'segundos' : 'en pausa'}</Text>
            </>
          )}
        </WavyRing>
      </View>

      <View style={styles.stepText}>
        <Text style={styles.stepCount}>
          {position.done ? routine.title : `Paso ${position.index + 1} de ${routine.steps.length}`}
        </Text>
        <Text style={styles.stepTitle}>{position.done ? '¡Rutina completada!' : step.title}</Text>
        <Text style={styles.stepInstruction}>
          {position.done ? 'Vuelve a sentarte recto y sigue con lo tuyo.' : step.instruction}
        </Text>
      </View>

      {position.done ? (
        <View style={styles.controls}>
          <Button label="Otra rutina" onPress={onExit} variant="prominent" color={colors.yellow} onColor={colors.onStatus} />
          <Button label="Repetir" onPress={() => jump(0)} variant="plain" />
        </View>
      ) : (
        <>
          <Button
            label={running ? 'Pausa' : 'Seguir'}
            onPress={() => setRunning((value) => !value)}
            variant="prominent"
            color={colors.yellow}
            onColor={colors.onStatus}
            selected={!running}
            size="large"
          />
          <ButtonGroup
            items={[
              { label: 'Anterior', onPress: () => jump(position.index - 1), disabled: position.index === 0 },
              { label: 'Siguiente', onPress: () => jump(position.index + 1) },
            ]}
          />
        </>
      )}

      <View style={styles.steps}>
        {routine.steps.map((each, index) => {
          const done = position.done || index < position.index;
          const current = !position.done && index === position.index;
          return (
            <View key={each.title} style={styles.stepRow}>
              <CheckBox checked={done} accessibilityLabel={each.title} color={colors.yellow} size={22} />
              <Text style={[styles.stepName, done && styles.stepNameDone, current && styles.stepNameCurrent]}>{each.title}</Text>
              {current ? <PieProgress progress={position.stepProgress} size={18} color={colors.yellow} /> : null}
              <Text style={styles.stepSeconds}>{each.seconds} s</Text>
            </View>
          );
        })}
      </View>

      {!position.done ? <Button label="Terminar" onPress={onExit} variant="plain" size="small" /> : null}
      <View style={styles.safetyRow}>
        <Icon name="check" size={14} color={colors.tertiaryLabel} />
        <Text style={styles.safety}>{SAFETY_NOTE}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { ...type.subheadline, color: colors.secondaryLabel },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  routine: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  routineShape: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...continuous },
  routineText: { flex: 1, gap: 2 },
  routineTitle: { ...type.headline, color: colors.label },
  routineSubtitle: { ...type.footnote, color: colors.secondaryLabel },
  routineTime: { ...type.subheadline, ...roundedNumbers, color: colors.secondaryLabel },
  safety: { ...type.caption1, color: colors.tertiaryLabel, textAlign: 'center' },
  safetyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },

  player: { gap: spacing.xl, paddingBottom: spacing.xl },
  ringWrap: { alignItems: 'center' },
  seconds: { fontSize: 56, lineHeight: 62, fontWeight: '700', ...roundedNumbers, color: colors.label },
  secondsLabel: { ...type.footnote, color: colors.secondaryLabel },
  stepText: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  stepCount: { ...type.footnote, color: colors.yellow, fontWeight: '600', letterSpacing: 0.4 },
  stepTitle: { ...type.title2, color: colors.label, textAlign: 'center' },
  stepInstruction: { ...type.body, color: colors.secondaryLabel, textAlign: 'center', minHeight: 66 },
  controls: { gap: spacing.sm },
  steps: { gap: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 9 },
  stepName: { ...type.callout, color: colors.label, flex: 1 },
  stepNameDone: { color: colors.tertiaryLabel, textDecorationLine: 'line-through' },
  stepNameCurrent: { fontWeight: '600' },
  stepSeconds: { ...type.footnote, ...roundedNumbers, color: colors.tertiaryLabel },
});
