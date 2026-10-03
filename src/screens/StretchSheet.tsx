import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ButtonGroup, CheckBox } from '../components/controls';
import { PieProgress, WavyRing } from '../components/indicators';
import { Sheet } from '../components/Sheet';
import { SAFETY_NOTE, positionAt, stepStartMs, type Routine } from '../core/stretches';
import { fireHaptic } from '../services/haptics';
import { speak, stopSpeaking } from '../services/speech';
import { makeStyles, roundedNumbers, spacing, type, useTheme } from '../theme';

const TICK_MS = 200;

const useStyles = makeStyles((t) => ({
  ring: { alignItems: 'center' },
  seconds: { ...roundedNumbers, fontSize: 56, lineHeight: 62, fontWeight: '700', color: t.colors.label },
  secondsLabel: { ...type.footnote, color: t.colors.secondaryLabel },
  text: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  count: { ...type.footnote, color: t.colors.yellow, fontWeight: '700', letterSpacing: 0.4 },
  title: { ...type.title2, color: t.colors.label, textAlign: 'center' },
  instruction: { ...type.body, color: t.colors.secondaryLabel, textAlign: 'center', minHeight: 66 },
  steps: { gap: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 9 },
  stepName: { ...type.callout, color: t.colors.label, flex: 1 },
  stepDone: { color: t.colors.tertiaryLabel, textDecorationLine: 'line-through' },
  stepCurrent: { fontWeight: '600' },
  stepSeconds: { ...type.footnote, ...roundedNumbers, color: t.colors.tertiaryLabel },
  safety: { ...type.caption1, color: t.colors.tertiaryLabel, textAlign: 'center' },
}));

/**
 * Reproductor de una rutina de estiramientos: un reloj pasa los pasos y la voz
 * lee cada uno. Los hechos se tachan con su casilla, como las tareas de Things.
 */
export function StretchSheet({
  routine,
  onClose,
  voiceEnabled,
  vibrationEnabled,
}: {
  routine: Routine | null;
  onClose: () => void;
  voiceEnabled: boolean;
  vibrationEnabled: boolean;
}) {
  const [shown, setShown] = useState<Routine | null>(routine);
  useEffect(() => {
    if (routine) setShown(routine);
  }, [routine]);

  return (
    <Sheet visible={routine != null} title={shown ? `Estirar: ${shown.title.toLowerCase()}` : 'Estirar'} onClose={onClose}>
      {routine ? <Player key={routine.id} routine={routine} voiceEnabled={voiceEnabled} vibrationEnabled={vibrationEnabled} onExit={onClose} /> : null}
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
  const styles = useStyles();
  const { colors } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const elapsedRef = useRef(0);
  const spokenRef = useRef(-1);
  const position = positionAt(routine, elapsed);
  const step = routine.steps[position.index];

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

  // Pantalla encendida mientras dura la rutina.
  useEffect(() => {
    void activateKeepAwakeAsync('posturefix-stretch').catch(() => undefined);
    return () => {
      void deactivateKeepAwake('posturefix-stretch');
      stopSpeaking();
    };
  }, []);

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

  const jump = (index: number) => {
    elapsedRef.current = stepStartMs(routine, index);
    setElapsed(elapsedRef.current);
    setRunning(true);
  };

  return (
    <>
      <View style={styles.ring}>
        <WavyRing
          size={210}
          stroke={12}
          progress={position.done ? 1 : position.stepProgress}
          color={position.done ? colors.green : colors.yellow}
          urgency={running && !position.done ? 0.2 : 0}>
          {position.done ? (
            <CheckBox checked accessibilityLabel="Rutina terminada" color={colors.green} size={64} />
          ) : (
            <>
              <Text style={styles.seconds}>{Math.ceil(position.stepRemainingMs / 1000)}</Text>
              <Text style={styles.secondsLabel}>{running ? 'segundos' : 'en pausa'}</Text>
            </>
          )}
        </WavyRing>
      </View>

      <View style={styles.text} accessibilityLiveRegion="polite">
        <Text style={styles.count}>{position.done ? routine.title.toUpperCase() : `PASO ${position.index + 1} DE ${routine.steps.length}`}</Text>
        <Text style={styles.title}>{position.done ? '¡Rutina completada!' : step.title}</Text>
        <Text style={styles.instruction}>{position.done ? 'Vuelve a sentarte recto y sigue con lo tuyo.' : step.instruction}</Text>
      </View>

      {position.done ? (
        <>
          <Button label="Listo" onPress={onExit} variant="prominent" size="large" color={colors.yellow} onColor={colors.onStatus} />
          <Button label="Repetir" onPress={() => jump(0)} variant="plain" />
        </>
      ) : (
        <>
          <Button
            label={running ? 'Pausa' : 'Seguir'}
            onPress={() => setRunning((value) => !value)}
            variant="prominent"
            size="large"
            color={colors.yellow}
            onColor={colors.onStatus}
            selected={!running}
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
              <Text style={[styles.stepName, done && styles.stepDone, current && styles.stepCurrent]}>{each.title}</Text>
              {current ? <PieProgress progress={position.stepProgress} size={18} color={colors.yellow} /> : null}
              <Text style={styles.stepSeconds}>{each.seconds} s</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.safety}>{SAFETY_NOTE}</Text>
    </>
  );
}
