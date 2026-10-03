import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Accelerometer, DeviceMotion } from 'expo-sensors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildFrame, slouchDeg, tiltOf, type Tilt } from '../core/bodyFrame';
import { calibrateVectors, mostStableWindow } from '../core/calibration';
import { isMoving, isTrustedReading, readingFromAccelerometer, readingFromDeviceMotion, type MotionReading } from '../core/motion';
import { createSmootherBank, smoothBankStep, type SmootherBank } from '../core/oneEuro';
import { normalize, type Vector3 } from '../core/orientation';
import {
  DEFAULT_ENGINE_CONFIG,
  MESSAGES,
  createInitialState,
  startMonitoring,
  step,
  stopMonitoring,
  type AlarmSound,
  type EngineAction,
  type EngineConfig,
  type EngineState,
} from '../core/postureEngine';
import type { Profile, ProfileId } from '../core/profiles';
import { REMINDER_MESSAGE, createReminder, reminderStep, DEFAULT_RESET_AFTER_MOVING_MS, type ReminderState } from '../core/reminder';
import { clearReposition, createReposition, repositionStep, type RepositionState } from '../core/reposition';
import { isWithinSchedule, nextScheduleChange } from '../core/schedule';
import { addSession, type SessionRecord } from '../core/sessionLog';
import {
  DEFAULT_SETTINGS,
  activeProfileOf,
  loadHistory,
  loadSettings,
  saveHistory,
  saveSettings,
  withProfile,
  type Settings,
} from '../core/settings';
import { AlertAudio } from '../services/audio';
import { fireHaptic, stopVibration } from '../services/haptics';
import { prepareNotifications, sendPostureAlert, sendReminder } from '../services/notifications';
import { speak, stopSpeaking } from '../services/speech';
import { useHeadphones, type HeadphonesInfo } from './useHeadphones';

/** 20 lecturas por segundo: de sobra para la postura y suave con la batería. */
const SENSOR_INTERVAL_MS = 50;
/** Si en este tiempo la fusión no da lecturas completas, se usa el acelerómetro. */
const FUSION_GRACE_MS = 1500;
/** Repintado de la interfaz: 10 veces por segundo, y al instante al cambiar de fase. */
const UI_REFRESH_MS = 100;
/** Calibración guiada: aviso, postura recta, preparar la inclinación y medirla. */
const CAL_PREPARE_S = 5;
const CAL_UPRIGHT_MS = 3000;
const CAL_LEAN_PREPARE_MS = 2500;
const CAL_LEAN_MS = 2000;
/** De la postura recta se usa el segundo y medio más quieto (a 20 Hz). */
const CAL_WINDOW = 30;
const CAL_LEAN_WINDOW = 20;

export type CalibrationStep = 'idle' | 'prepare' | 'upright' | 'lean-prepare' | 'lean' | 'done' | 'failed';

export interface CalibrationReport {
  kind: 'two-step' | 'upright';
  spreadDeg: number;
  steady: boolean;
  leanDeg: number;
  /** Algo que conviene contar aunque la calibración haya servido. */
  warning: 'lean-too-small' | null;
}

export interface CalibrationProgress {
  step: CalibrationStep;
  /** Cuenta atrás del paso «prepare». */
  secondsLeft: number;
  report: CalibrationReport | null;
  error: 'no-samples' | 'no-sensor' | null;
}

export interface Monitor {
  ready: boolean;
  settings: Settings;
  profile: Profile;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>, id?: ProfileId) => void;
  setActiveProfile: (id: ProfileId) => void;
  history: SessionRecord[];
  clearHistory: () => void;
  engine: EngineState;
  tilt: Tilt | null;
  running: boolean;
  start: () => Promise<void>;
  stop: () => void;
  /** `null` mientras no se sabe; `false` si no hay sensores. */
  sensorAvailable: boolean | null;
  /** `true` con la gravedad de la fusión de sensores (acelerómetro + giroscopio). */
  fused: boolean | null;
  outsideSchedule: boolean;
  nextScheduleChange: Date | null;
  /** Lo que falta para el próximo recordatorio, o `null` si no aplica. */
  reminderLeftMs: number | null;
  sensorMoved: boolean;
  dismissSensorMoved: () => void;
  calibration: CalibrationProgress;
  calibrate: (twoStep: boolean) => Promise<void>;
  cancelCalibration: () => void;
  resetCalibration: () => void;
  previewing: boolean;
  previewAlarm: () => Promise<void>;
  headphones: HeadphonesInfo;
  alarmSound: AlarmSound;
}

const IDLE_CALIBRATION: CalibrationProgress = { step: 'idle', secondsLeft: 0, report: null, error: null };

class Cancelled extends Error {}

/**
 * El corazón de la app de móvil: lee el sensor, mide la postura con el perfil
 * activo, mueve la máquina de avisos y hace sonar, hablar y vibrar al móvil.
 */
export function useMonitor(): Monitor {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [engine, setEngine] = useState<EngineState>(createInitialState);
  const [tilt, setTilt] = useState<Tilt | null>(null);
  const [running, setRunning] = useState(false);
  const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);
  const [fused, setFused] = useState<boolean | null>(null);
  const [outsideSchedule, setOutsideSchedule] = useState(false);
  const [reminderLeftMs, setReminderLeftMs] = useState<number | null>(null);
  const [sensorMoved, setSensorMoved] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationProgress>(IDLE_CALIBRATION);
  const [previewing, setPreviewing] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const headphones = useHeadphones(settings.manualHeadphones);

  const settingsRef = useRef(settings);
  const historyRef = useRef(history);
  const headphonesRef = useRef(headphones);
  const engineRef = useRef<EngineState>(engine);
  const runningRef = useRef(false);
  const audioRef = useRef<AlertAudio | null>(null);
  const smootherRef = useRef<SmootherBank<'x' | 'y' | 'z'>>(createSmootherBank(['x', 'y', 'z'] as const));
  const repositionRef = useRef<RepositionState>(createReposition());
  const reminderRef = useRef<ReminderState>(createReminder());
  const outsideRef = useRef(false);
  const lastSampleAtRef = useRef<number | null>(null);
  const lastPaintAtRef = useRef(0);
  const captureRef = useRef<Vector3[] | null>(null);
  const calibrationTokenRef = useRef(0);
  const sessionStartedAtRef = useRef(0);
  const sessionProfileRef = useRef<ProfileId>('sentado');
  const previewingRef = useRef(false);

  settingsRef.current = settings;
  historyRef.current = history;
  headphonesRef.current = headphones;

  const profile = activeProfileOf(settings);

  const configFor = useCallback(
    (p: Profile): EngineConfig => ({
      ...DEFAULT_ENGINE_CONFIG,
      thresholdDeg: p.thresholdDeg,
      graceMs: p.graceSeconds * 1000,
      maxLevel: p.maxAlertLevel,
    }),
    []
  );

  const pickAlarmSound = useCallback((current: Settings, ears: HeadphonesInfo): AlarmSound => {
    if (current.easAlways) return 'eas';
    return ears.connected && current.easWithHeadphones ? 'eas' : 'siren';
  }, []);
  const alarmSound = pickAlarmSound(settings, headphones);

  // --------------------------------------------------------- carga inicial ---
  useEffect(() => {
    let cancelled = false;
    const audio = new AlertAudio();
    audioRef.current = audio;
    (async () => {
      const [stored, storedHistory] = await Promise.all([loadSettings(), loadHistory()]);
      if (cancelled) return;
      settingsRef.current = stored;
      setSettings(stored);
      setHistory(storedHistory);
      setReady(true);
      // La primera vez en la 2.0 los ajustes migrados de la 1.x se guardan ya.
      void saveSettings(stored);
      await audio.prepare().catch(() => undefined);
      audio.setVolume(stored.volume);
      if (stored.notificationsEnabled) await prepareNotifications();
    })();
    return () => {
      cancelled = true;
      audio.release();
      stopSpeaking();
      stopVibration();
      audioRef.current = null;
    };
  }, []);

  // El horario se repasa cada minuto aunque no lleguen lecturas.
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const silence = useCallback(() => {
    audioRef.current?.stopAll();
    stopSpeaking();
    stopVibration();
  }, []);

  const runAction = useCallback(
    async (action: EngineAction) => {
      const current = settingsRef.current;
      const audio = audioRef.current;
      // En una sesión de control se mide todo pero no se avisa de nada.
      if (current.controlMode && action.type !== 'silence') return;
      switch (action.type) {
        case 'beep':
          await audio?.playBeep(current.volume);
          break;
        case 'speak':
          speak(action.text, current.voiceEnabled);
          break;
        case 'silence':
          silence();
          break;
        case 'startAlarm':
          await audio?.startAlarm(pickAlarmSound(current, headphonesRef.current), current.volume);
          break;
        case 'notify':
          await sendPostureAlert(action.title, action.body, current.notificationsEnabled);
          break;
        case 'haptic':
          await fireHaptic(action.pattern, current.vibrationEnabled);
          break;
      }
    },
    [pickAlarmSound, silence]
  );

  const paint = useCallback((state: EngineState, nextTilt: Tilt | null, force: boolean) => {
    engineRef.current = state;
    const now = Date.now();
    if (force || now - lastPaintAtRef.current >= UI_REFRESH_MS) {
      lastPaintAtRef.current = now;
      setEngine(state);
      setTilt(nextTilt);
      const current = settingsRef.current;
      setReminderLeftMs(
        current.standReminder && runningRef.current && current.activeProfile !== 'de-pie'
          ? Math.max(0, current.standEveryMinutes * 60_000 - reminderRef.current.sittingMs)
          : null
      );
    }
  }, []);

  // ------------------------------------------------------------- lecturas ---
  const handleReading = useCallback(
    (reading: MotionReading) => {
      const now = Date.now();
      const previousAt = lastSampleAtRef.current;
      lastSampleAtRef.current = now;
      const dtMs = previousAt == null ? SENSOR_INTERVAL_MS : Math.min(now - previousAt, 1000);
      const trusted = isTrustedReading(reading);

      if (captureRef.current) {
        if (trusted) captureRef.current.push(reading.gravity);
        return;
      }

      const smoothing = smoothBankStep(smootherRef.current, reading.gravity, dtMs);
      smootherRef.current = smoothing.bank;

      const current = settingsRef.current;
      const activeProfile = activeProfileOf(current);
      const frame = activeProfile.frame;
      if (!frame) {
        paint({ ...engineRef.current, deviationDeg: 0 }, null, false);
        return;
      }

      const currentTilt = tiltOf(frame, smoothing.value);
      const deviationDeg = slouchDeg(currentTilt, activeProfile.ignoreBackward);

      // ¿Se ha movido el móvil de sitio? Se juzga con la lectura sin suavizar.
      const reposition = repositionStep(repositionRef.current, {
        deviationDeg: tiltOf(frame, reading.gravity).totalDeg,
        trusted,
        dtMs,
      });
      if (reposition.suspected !== repositionRef.current.suspected) setSensorMoved(reposition.suspected);
      repositionRef.current = reposition;

      if (engineRef.current.phase === 'idle') {
        paint({ ...engineRef.current, deviationDeg }, currentTilt, false);
        return;
      }

      // Fuera de horario no se avisa ni se cuenta tiempo.
      const inside = isWithinSchedule(current.schedule, new Date(now));
      if (inside !== !outsideRef.current) {
        outsideRef.current = !inside;
        setOutsideSchedule(!inside);
        if (!inside) {
          silence();
          engineRef.current = startMonitoring(engineRef.current);
        }
      }
      if (!inside) {
        paint({ ...engineRef.current, deviationDeg }, currentTilt, false);
        return;
      }

      // Recordatorio para levantarse (de pie no hace falta, y en control tampoco avisa).
      if (current.standReminder && current.activeProfile !== 'de-pie') {
        const result = reminderStep(
          reminderRef.current,
          { dtMs, moving: isMoving(reading) },
          { everyMs: current.standEveryMinutes * 60_000, resetAfterMovingMs: DEFAULT_RESET_AFTER_MOVING_MS }
        );
        reminderRef.current = result.state;
        if (result.due && !current.controlMode) {
          speak(REMINDER_MESSAGE, current.voiceEnabled);
          void fireHaptic('success', current.vibrationEnabled);
          void sendReminder('Hora de levantarse', REMINDER_MESSAGE, current.notificationsEnabled);
        }
      }

      const { state, actions } = step(
        engineRef.current,
        { deviationDeg, dtMs, trusted: trusted && !reposition.suspected },
        configFor(activeProfile)
      );
      paint(state, currentTilt, state.phase !== engineRef.current.phase);
      actions.forEach((action) => void runAction(action));
    },
    [configFor, paint, runAction, silence]
  );

  const handleRef = useRef(handleReading);
  handleRef.current = handleReading;

  // Gravedad fusionada si el móvil la da; si no, el acelerómetro de siempre.
  useEffect(() => {
    let cancelled = false;
    let motionSub: { remove: () => void } | null = null;
    let accelSub: { remove: () => void } | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let gotFused = false;

    const useAccelerometer = async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      setSensorAvailable(available);
      setFused(false);
      if (!available) return;
      Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
      accelSub = Accelerometer.addListener((sample) => handleRef.current(readingFromAccelerometer(sample)));
    };

    (async () => {
      const motionAvailable = await DeviceMotion.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      if (!motionAvailable) {
        await useAccelerometer();
        return;
      }
      DeviceMotion.setUpdateInterval(SENSOR_INTERVAL_MS);
      motionSub = DeviceMotion.addListener((measurement) => {
        const reading = readingFromDeviceMotion(measurement);
        if (!reading) return;
        if (!gotFused) {
          gotFused = true;
          setSensorAvailable(true);
          setFused(reading.fused);
        }
        handleRef.current(reading);
      });
      fallbackTimer = setTimeout(() => {
        if (gotFused || cancelled) return;
        motionSub?.remove();
        motionSub = null;
        void useAccelerometer();
      }, FUSION_GRACE_MS);
    })();

    return () => {
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      motionSub?.remove();
      accelSub?.remove();
    };
  }, []);

  // Pantalla encendida: con el móvil bloqueado el sistema corta los sensores.
  useEffect(() => {
    if (running && settings.keepAwake) {
      activateKeepAwakeAsync('posturefix').catch(() => undefined);
      return () => {
        void deactivateKeepAwake('posturefix');
      };
    }
    return undefined;
  }, [running, settings.keepAwake]);

  // ---------------------------------------------------------------- ajustes ---
  const persist = useCallback((next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
    audioRef.current?.setVolume(next.volume);
    void saveSettings(next);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => persist({ ...settingsRef.current, ...patch }), [persist]);

  const updateProfile = useCallback(
    (patch: Partial<Profile>, id?: ProfileId) => persist(withProfile(settingsRef.current, id ?? settingsRef.current.activeProfile, patch)),
    [persist]
  );

  const resetMeasurement = useCallback(() => {
    smootherRef.current = createSmootherBank(['x', 'y', 'z'] as const);
    repositionRef.current = clearReposition(createReposition());
    setSensorMoved(false);
  }, []);

  const setActiveProfile = useCallback(
    (id: ProfileId) => {
      if (runningRef.current || settingsRef.current.activeProfile === id) return;
      persist({ ...settingsRef.current, activeProfile: id });
      resetMeasurement();
    },
    [persist, resetMeasurement]
  );

  // -------------------------------------------------------------- sesiones ---
  const recordSession = useCallback(() => {
    if (sessionStartedAtRef.current === 0) return;
    const state = engineRef.current;
    const record: SessionRecord = {
      startedAt: sessionStartedAtRef.current,
      durationMs: state.sessionMs,
      badMs: state.sessionBadMs,
      alerts: state.totalAlerts,
      source: 'movil',
      alertsEnabled: !settingsRef.current.controlMode,
      profile: sessionProfileRef.current,
    };
    sessionStartedAtRef.current = 0;
    const updated = addSession(historyRef.current, record);
    if (updated !== historyRef.current) {
      historyRef.current = updated;
      setHistory(updated);
      void saveHistory(updated);
    }
    engineRef.current = { ...createInitialState(), deviationDeg: state.deviationDeg };
    setEngine(engineRef.current);
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
    void saveHistory([]);
  }, []);

  const start = useCallback(async () => {
    if (!activeProfileOf(settingsRef.current).frame || runningRef.current) return;
    await audioRef.current?.prepare().catch(() => undefined);
    audioRef.current?.setVolume(settingsRef.current.volume);
    if (settingsRef.current.notificationsEnabled) await prepareNotifications();
    reminderRef.current = createReminder();
    outsideRef.current = false;
    setOutsideSchedule(false);
    engineRef.current = startMonitoring(engineRef.current);
    setEngine(engineRef.current);
    sessionStartedAtRef.current = Date.now();
    sessionProfileRef.current = settingsRef.current.activeProfile;
    runningRef.current = true;
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    const { state, actions } = stopMonitoring(engineRef.current);
    engineRef.current = state;
    setEngine(state);
    runningRef.current = false;
    setRunning(false);
    setOutsideSchedule(false);
    outsideRef.current = false;
    setReminderLeftMs(null);
    actions.forEach((action) => void runAction(action));
    silence();
    recordSession();
  }, [recordSession, runAction, silence]);

  const dismissSensorMoved = useCallback(() => {
    repositionRef.current = clearReposition(repositionRef.current);
    setSensorMoved(false);
  }, []);

  // ------------------------------------------------------------ calibración ---
  const calibrate = useCallback(
    async (twoStep: boolean) => {
      if (calibrationTokenRef.current % 2 === 1) return; // ya hay una en marcha
      const token = ++calibrationTokenRef.current;
      const alive = () => calibrationTokenRef.current === token;
      const wait = (ms: number) =>
        new Promise<void>((resolve, reject) => setTimeout(() => (alive() ? resolve() : reject(new Cancelled())), ms));
      const say = (text: string) => speak(text, settingsRef.current.voiceEnabled);
      const buzz = () => void fireHaptic('tick', settingsRef.current.vibrationEnabled);
      const capture = async (ms: number) => {
        captureRef.current = [];
        await wait(ms);
        const samples = captureRef.current ?? [];
        captureRef.current = null;
        return samples;
      };
      const finish = (progress: CalibrationProgress) => {
        captureRef.current = null;
        if (alive()) calibrationTokenRef.current += 1;
        setCalibration(progress);
      };

      if (sensorAvailable === false) {
        finish({ ...IDLE_CALIBRATION, step: 'failed', error: 'no-sensor' });
        return;
      }

      try {
        silence();
        say('Guarda el móvil donde lo vayas a llevar y ponte recto.');
        for (let s = CAL_PREPARE_S; s > 0; s--) {
          setCalibration({ ...IDLE_CALIBRATION, step: 'prepare', secondsLeft: s });
          await wait(1000);
        }
        setCalibration({ ...IDLE_CALIBRATION, step: 'upright' });
        buzz();
        const upright = calibrateVectors(mostStableWindow(await capture(CAL_UPRIGHT_MS), CAL_WINDOW));
        if (!upright) {
          say('No he podido calibrar. Quédate quieto y repite.');
          finish({ ...IDLE_CALIBRATION, step: 'failed', error: 'no-samples' });
          return;
        }

        let leaning: Vector3 | null = null;
        if (twoStep) {
          say('Ahora inclínate hacia delante, como si miraras el móvil, y aguanta.');
          setCalibration({ ...IDLE_CALIBRATION, step: 'lean-prepare' });
          await wait(CAL_LEAN_PREPARE_MS);
          setCalibration({ ...IDLE_CALIBRATION, step: 'lean' });
          buzz();
          leaning = calibrateVectors(mostStableWindow(await capture(CAL_LEAN_MS), CAL_LEAN_WINDOW))?.baseline ?? null;
        }

        const built = buildFrame(upright.baseline, leaning);
        // Si apenas se inclinó, se guarda al menos la postura recta.
        const frame = 'frame' in built ? built.frame : { up: normalize(upright.baseline), forward: null };
        const report: CalibrationReport = {
          kind: frame.forward ? 'two-step' : 'upright',
          spreadDeg: upright.spreadDeg,
          steady: upright.steady,
          leanDeg: built.leanDeg,
          warning: 'error' in built ? built.error : null,
        };
        updateProfile({ frame, spreadDeg: upright.spreadDeg });
        resetMeasurement();
        engineRef.current = runningRef.current ? startMonitoring(engineRef.current) : { ...engineRef.current, deviationDeg: 0 };
        setEngine(engineRef.current);
        say(
          report.warning
            ? 'Guardado, pero casi no te has inclinado. Si quieres más precisión, repite.'
            : upright.steady
              ? 'Listo. Ya puedes ponerte cómodo.'
              : 'Guardado, pero te movías. Conviene repetir.'
        );
        void fireHaptic('success', settingsRef.current.vibrationEnabled);
        finish({ ...IDLE_CALIBRATION, step: 'done', report });
      } catch (error) {
        captureRef.current = null;
        // Cancelada: ya se ha limpiado todo. Cualquier otro fallo se cuenta.
        if (!(error instanceof Cancelled)) finish({ ...IDLE_CALIBRATION, step: 'failed', error: 'no-samples' });
      }
    },
    [resetMeasurement, sensorAvailable, silence, updateProfile]
  );

  const cancelCalibration = useCallback(() => {
    if (calibrationTokenRef.current % 2 === 1) calibrationTokenRef.current += 1;
    captureRef.current = null;
    stopSpeaking();
    setCalibration(IDLE_CALIBRATION);
  }, []);

  const resetCalibration = useCallback(() => setCalibration(IDLE_CALIBRATION), []);

  // ---------------------------------------------------------------- prueba ---
  const previewAlarm = useCallback(async () => {
    if (previewingRef.current) return;
    previewingRef.current = true;
    setPreviewing(true);
    const current = settingsRef.current;
    const level = activeProfileOf(current).maxAlertLevel;
    const audio = audioRef.current;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      await audio?.prepare();
      await audio?.playBeep(current.volume);
      await fireHaptic('warning', current.vibrationEnabled);
      if (level === 'beep') {
        await wait(DEFAULT_ENGINE_CONFIG.scareMs);
        return;
      }
      for (const count of MESSAGES.counts) {
        await wait(DEFAULT_ENGINE_CONFIG.countStepMs);
        speak(count, current.voiceEnabled);
      }
      await wait(DEFAULT_ENGINE_CONFIG.countStepMs);
      if (level === 'count') return;
      speak(MESSAGES.alarm, current.voiceEnabled);
      await audio?.startAlarm(pickAlarmSound(current, headphonesRef.current), current.volume);
      await fireHaptic('alarm', current.vibrationEnabled);
      await wait(3500);
    } finally {
      silence();
      previewingRef.current = false;
      setPreviewing(false);
    }
  }, [pickAlarmSound, silence]);

  const nextChange = useMemo(
    () => (settings.schedule.enabled ? nextScheduleChange(settings.schedule, new Date(clock)) : null),
    [clock, settings.schedule]
  );

  return {
    ready,
    settings,
    profile,
    updateSettings,
    updateProfile,
    setActiveProfile,
    history,
    clearHistory,
    engine,
    tilt,
    running,
    start,
    stop,
    sensorAvailable,
    fused,
    outsideSchedule,
    nextScheduleChange: nextChange,
    reminderLeftMs,
    sensorMoved,
    dismissSensorMoved,
    calibration,
    calibrate,
    cancelCalibration,
    resetCalibration,
    previewing,
    previewAlarm,
    headphones,
    alarmSound,
  };
}
