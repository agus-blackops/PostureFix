import { Accelerometer } from 'expo-sensors';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  angleBetweenDeg,
  averageVector,
  isTrustedSample,
  lowPass,
  type Vector3,
} from '../core/orientation';
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
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../core/settings';
import { AlertAudio } from '../services/audio';
import { fireHaptic, stopVibration } from '../services/haptics';
import { prepareNotifications, sendPostureAlert } from '../services/notifications';
import { speak, stopSpeaking } from '../services/speech';
import { useHeadphones, type HeadphonesInfo } from './useHeadphones';

/** 20 lecturas por segundo: suficiente para la postura y suave con la batería. */
const SENSOR_INTERVAL_MS = 50;
/** Suavizado del acelerómetro. Filtra temblores sin retrasar la detección. */
const SMOOTHING_TAU_MS = 300;
/** Cuánto puede alejarse de 1 g una lectura y seguir siendo fiable. */
const MOTION_TOLERANCE_G = 0.22;
/** Duración de la calibración con la espalda recta. */
const CALIBRATION_MS = 1500;

export type CalibrationState = 'none' | 'calibrating' | 'done';

export interface PostureMonitor {
  engine: EngineState;
  settings: Settings;
  running: boolean;
  sensorAvailable: boolean | null;
  calibration: CalibrationState;
  headphones: HeadphonesInfo;
  alarmSound: AlarmSound;
  start: () => Promise<void>;
  stop: () => void;
  calibrate: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  previewAlarm: () => Promise<void>;
}

/**
 * Une el acelerómetro, la máquina de estados y los avisos (sonido, voz,
 * vibración y notificación) en una sola API para la interfaz.
 */
export function usePostureMonitor(): PostureMonitor {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [engine, setEngine] = useState<EngineState>(createInitialState);
  const [running, setRunning] = useState(false);
  const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);
  const [calibration, setCalibration] = useState<CalibrationState>('none');

  const headphones = useHeadphones(settings.manualHeadphones);

  const audioRef = useRef<AlertAudio | null>(null);
  const engineRef = useRef<EngineState>(engine);
  const settingsRef = useRef<Settings>(settings);
  const headphonesRef = useRef<HeadphonesInfo>(headphones);
  const smoothedRef = useRef<Vector3 | null>(null);
  const lastSampleAtRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<Vector3[] | null>(null);

  engineRef.current = engine;
  settingsRef.current = settings;
  headphonesRef.current = headphones;

  const config: EngineConfig = useMemo(
    () => ({
      ...DEFAULT_ENGINE_CONFIG,
      thresholdDeg: settings.thresholdDeg,
      graceMs: settings.graceSeconds * 1000,
    }),
    [settings.thresholdDeg, settings.graceSeconds]
  );
  const configRef = useRef(config);
  configRef.current = config;

  /** Con auriculares suena el tono EAS; por altavoz, la sirena de dos tonos. */
  const pickAlarmSound = useCallback((current: Settings, ears: HeadphonesInfo): AlarmSound => {
    if (current.easAlways) return 'eas';
    return ears.connected && current.easWithHeadphones ? 'eas' : 'siren';
  }, []);

  const alarmSound = pickAlarmSound(settings, headphones);

  // Ajustes guardados + preparación de audio y permisos, una sola vez.
  useEffect(() => {
    let cancelled = false;
    const audio = new AlertAudio();
    audioRef.current = audio;

    (async () => {
      const stored = await loadSettings();
      if (cancelled) return;
      setSettings(stored);
      setCalibration(stored.baseline ? 'done' : 'none');
      await audio.prepare();
      audio.setVolume(stored.volume);
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (!cancelled) setSensorAvailable(available);
      if (stored.notificationsEnabled) {
        await prepareNotifications();
      }
    })();

    return () => {
      cancelled = true;
      audio.release();
      stopSpeaking();
      stopVibration();
      audioRef.current = null;
    };
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

  /** Una lectura del acelerómetro: suavizar, medir ángulo y avanzar la máquina. */
  const handleSample = useCallback(
    (sample: Vector3) => {
      const now = Date.now();
      const previousAt = lastSampleAtRef.current;
      lastSampleAtRef.current = now;
      const dtMs = previousAt == null ? SENSOR_INTERVAL_MS : Math.min(now - previousAt, 1000);

      if (calibrationSamplesRef.current) {
        calibrationSamplesRef.current.push(sample);
        return;
      }

      const smoothed = lowPass(smoothedRef.current, sample, dtMs, SMOOTHING_TAU_MS);
      smoothedRef.current = smoothed;

      const baseline = settingsRef.current.baseline;
      if (!baseline) return;

      const deviationDeg = angleBetweenDeg(baseline, smoothed);

      // Sin vigilancia activa sólo refrescamos el ángulo para la interfaz.
      if (engineRef.current.phase === 'idle') {
        engineRef.current = { ...engineRef.current, deviationDeg };
        setEngine(engineRef.current);
        return;
      }

      const { state, actions } = step(
        engineRef.current,
        {
          deviationDeg,
          dtMs,
          trusted: isTrustedSample(sample, MOTION_TOLERANCE_G),
        },
        configRef.current
      );

      engineRef.current = state;
      setEngine(state);
      actions.forEach((action) => {
        void runAction(action);
      });
    },
    [runAction]
  );

  // El acelerómetro se escucha mientras la app está abierta: con la vigilancia
  // parada sólo sirve para enseñar el ángulo actual y poder calibrar.
  useEffect(() => {
    if (sensorAvailable === false) return;

    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
    const subscription = Accelerometer.addListener(handleSample);
    lastSampleAtRef.current = null;

    return () => {
      subscription.remove();
    };
  }, [handleSample, sensorAvailable]);

  // Pantalla encendida: en segundo plano el sistema corta el acelerómetro.
  useEffect(() => {
    if (running && settings.keepAwake) {
      activateKeepAwakeAsync('posturefix').catch(() => undefined);
      return () => {
        void deactivateKeepAwake('posturefix');
      };
    }
    return undefined;
  }, [running, settings.keepAwake]);

  const persist = useCallback((next: Settings) => {
    setSettings(next);
    settingsRef.current = next;
    audioRef.current?.setVolume(next.volume);
    void saveSettings(next);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      persist({ ...settingsRef.current, ...patch });
    },
    [persist]
  );

  /** Guarda la orientación actual del móvil como "espalda recta". */
  const calibrate = useCallback(async () => {
    setCalibration('calibrating');
    calibrationSamplesRef.current = [];

    await new Promise((resolve) => setTimeout(resolve, CALIBRATION_MS));

    const samples = calibrationSamplesRef.current ?? [];
    calibrationSamplesRef.current = null;

    const baseline = averageVector(samples.filter((s) => isTrustedSample(s, MOTION_TOLERANCE_G)));
    if (!baseline) {
      setCalibration(settingsRef.current.baseline ? 'done' : 'none');
      return;
    }

    smoothedRef.current = baseline;
    // Al recalibrar se reinicia el ciclo en curso, sin perder las estadísticas.
    engineRef.current = running
      ? startMonitoring(engineRef.current)
      : { ...engineRef.current, phase: 'idle', deviationDeg: 0 };
    setEngine(engineRef.current);
    persist({ ...settingsRef.current, baseline });
    setCalibration('done');
    speak('Postura guardada.', settingsRef.current.voiceEnabled);
  }, [persist, running]);

  const start = useCallback(async () => {
    if (!settingsRef.current.baseline) {
      await calibrate();
    }
    if (!settingsRef.current.baseline) return;

    await audioRef.current?.prepare();
    audioRef.current?.setVolume(settingsRef.current.volume);
    if (settingsRef.current.notificationsEnabled) {
      await prepareNotifications();
    }
    engineRef.current = startMonitoring(engineRef.current);
    setEngine(engineRef.current);
    setRunning(true);
  }, [calibrate]);

  const stop = useCallback(() => {
    const { state, actions } = stopMonitoring(engineRef.current);
    engineRef.current = state;
    setEngine(state);
    setRunning(false);
    actions.forEach((action) => {
      void runAction(action);
    });
    silence();
  }, [runAction, silence]);

  /** Prueba la secuencia completa sin tener que agacharse. */
  const previewAlarm = useCallback(async () => {
    const current = settingsRef.current;
    const audio = audioRef.current;
    await audio?.prepare();
    await audio?.playBeep(current.volume);
    await fireHaptic('warning', current.vibrationEnabled);
    for (let i = 0; i < MESSAGES.counts.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_ENGINE_CONFIG.countStepMs));
      speak(MESSAGES.counts[i], current.voiceEnabled);
    }
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_ENGINE_CONFIG.countStepMs));
    speak(MESSAGES.alarm, current.voiceEnabled);
    await audio?.startAlarm(pickAlarmSound(current, headphonesRef.current), current.volume);
    await fireHaptic('alarm', current.vibrationEnabled);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    silence();
  }, [pickAlarmSound, silence]);

  return {
    engine,
    settings,
    running,
    sensorAvailable,
    calibration,
    headphones,
    alarmSound,
    start,
    stop,
    calibrate,
    updateSettings,
    previewAlarm,
  };
}
