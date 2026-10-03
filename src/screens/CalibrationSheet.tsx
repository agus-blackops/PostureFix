import { useState } from 'react';
import { Text, View } from 'react-native';

import { useApp } from '../app/AppContext';
import { Button, CheckBox, Toggle } from '../components/controls';
import { LoadingIndicator, MorphShape } from '../components/indicators';
import { Row, Section } from '../components/lists';
import { Pop } from '../components/motion';
import { Sheet } from '../components/Sheet';
import { PROFILE_NAMES } from '../core/profiles';
import { makeStyles, roundedNumbers, spacing, type, useTheme, withAlpha } from '../theme';

const useStyles = makeStyles((t) => ({
  stage: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, minHeight: 260, justifyContent: 'center' },
  big: { ...roundedNumbers, fontSize: 96, lineHeight: 104, fontWeight: '800', color: t.colors.tintText },
  title: { ...type.title2, color: t.colors.label, textAlign: 'center' },
  body: { ...type.body, color: t.colors.secondaryLabel, textAlign: 'center' },
  steps: { gap: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { ...type.headline, color: t.colors.label },
  stepBody: { ...type.footnote, color: t.colors.secondaryLabel },
  warn: { ...type.subheadline, color: t.colors.yellow, textAlign: 'center' },
  actions: { gap: spacing.sm },
  shape: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
}));

/**
 * Calibración guiada de la 2.0. Con el móvil ya en el bolsillo no se ve la
 * pantalla, así que la voz lleva el ritmo: cinco segundos para colocarse,
 * postura recta y, en el modo preciso, un poco hacia delante.
 */
export function CalibrationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { monitor } = useApp();
  const [twoStep, setTwoStep] = useState(true);
  const { step, secondsLeft, report, error } = monitor.calibration;
  const busy = step !== 'idle' && step !== 'done' && step !== 'failed';
  const profileName = PROFILE_NAMES[monitor.settings.activeProfile];

  const close = () => {
    if (busy) monitor.cancelCalibration();
    else monitor.resetCalibration();
    onClose();
  };

  const stepDone = (which: 'upright' | 'lean') => {
    const order = ['prepare', 'upright', 'lean-prepare', 'lean', 'done'];
    const at = order.indexOf(step);
    return which === 'upright' ? at >= 2 : at >= 4 && report?.kind === 'two-step';
  };

  return (
    <Sheet visible={visible} title={`Calibrar «${profileName}»`} onClose={close}>
      {step === 'idle' ? (
        <>
          <View style={styles.stage}>
            <MorphShape shape="cookie9" size={120} color={withAlpha(colors.tint, 0.18)} />
            <Text style={styles.title}>Enséñale a la app tu postura buena</Text>
            <Text style={styles.body}>
              Al pulsar «Empezar» tienes cinco segundos para guardar el móvil donde lo vayas a llevar. Después la voz te va diciendo qué
              hacer.
            </Text>
          </View>
          <Section footer="Con el segundo paso la app aprende hacia dónde es «delante»: así distingue encorvarse de echarse hacia atrás en la silla, que no es mala postura.">
            <Row
              title="Calibración precisa (2 pasos)"
              subtitle="Recto y luego un poco hacia delante"
              accessory={<Toggle value={twoStep} onValueChange={setTwoStep} accessibilityLabel="Calibración precisa" />}
            />
          </Section>
          <Button label="Empezar" onPress={() => void monitor.calibrate(twoStep)} variant="prominent" size="large" haptic="medium" />
        </>
      ) : null}

      {busy ? (
        <View style={styles.stage} accessibilityLiveRegion="polite">
          {step === 'prepare' ? (
            <>
              <Pop trigger={String(secondsLeft)}>
                <Text style={styles.big}>{secondsLeft}</Text>
              </Pop>
              <Text style={styles.title}>Guarda el móvil y ponte recto</Text>
              <Text style={styles.body}>Espalda recta, hombros atrás, mirada al frente.</Text>
            </>
          ) : (
            <>
              <LoadingIndicator size={72} color={step === 'lean' || step === 'lean-prepare' ? colors.yellow : colors.tint} />
              <Text style={styles.title}>
                {step === 'upright' ? 'Quieto: midiendo tu postura recta' : step === 'lean-prepare' ? 'Ahora inclínate hacia delante' : 'Aguanta así…'}
              </Text>
              <Text style={styles.body}>
                {step === 'upright'
                  ? 'Tres segundos sin moverte.'
                  : 'Como si miraras el móvil: un poco, sin exagerar.'}
              </Text>
            </>
          )}
        </View>
      ) : null}

      {busy || step === 'done' ? (
        <View style={styles.steps}>
          <View style={styles.stepRow}>
            <CheckBox checked={stepDone('upright')} accessibilityLabel="Postura recta" color={colors.green} />
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Postura recta</Text>
              <Text style={styles.stepBody}>
                {report ? `Dispersión ±${report.spreadDeg.toFixed(1).replace('.', ',')}°${report.steady ? '' : ' (te movías)'}` : 'La referencia de todo'}
              </Text>
            </View>
          </View>
          {twoStep || report?.kind === 'two-step' ? (
            <View style={styles.stepRow}>
              <CheckBox checked={stepDone('lean')} accessibilityLabel="Hacia delante" color={colors.green} />
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Hacia delante</Text>
                <Text style={styles.stepBody}>
                  {report?.kind === 'two-step'
                    ? `Te inclinaste ${Math.round(report.leanDeg)}°: ya sé dónde es delante`
                    : 'Para separar encorvarse de echarse atrás'}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {step === 'done' && report ? (
        <View style={styles.actions}>
          {report.warning === 'lean-too-small' ? (
            <Text style={styles.warn}>Casi no te inclinaste ({Math.round(report.leanDeg)}°). Guardé la postura recta; repite para el modo preciso.</Text>
          ) : null}
          {!report.steady ? <Text style={styles.warn}>Te movías al calibrar. Conviene repetir quieto.</Text> : null}
          <Button label="Listo" onPress={close} variant="prominent" size="large" />
          <Button label="Repetir" onPress={() => void monitor.calibrate(twoStep)} variant="plain" />
        </View>
      ) : null}

      {step === 'failed' ? (
        <View style={styles.actions}>
          <View style={styles.stage}>
            <Text style={styles.title}>No he podido calibrar</Text>
            <Text style={styles.body}>
              {error === 'no-sensor'
                ? 'Este dispositivo no tiene sensores de movimiento.'
                : 'Te movías demasiado y no ha quedado ninguna lectura fiable. Quédate quieto y repite.'}
            </Text>
          </View>
          {error !== 'no-sensor' ? (
            <Button label="Repetir" onPress={() => void monitor.calibrate(twoStep)} variant="prominent" size="large" />
          ) : null}
        </View>
      ) : null}

      {busy ? <Button label="Cancelar" onPress={monitor.cancelCalibration} variant="plain" /> : null}
    </Sheet>
  );
}
