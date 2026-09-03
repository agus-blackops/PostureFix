import type { PoseLandmarker } from '@mediapipe/tasks-vision';

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
  type Phase,
} from '../../src/core/postureEngine';
import { WebAlerts } from './alerts';
import { createPoseLandmarker, startCamera, stopCamera } from './detector';
import {
  CAUSE_LABEL,
  POSE,
  deviationFrom,
  extractMetrics,
  smoothMetrics,
  type Landmark,
  type PostureCause,
  type PostureMetrics,
} from './postureVision';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type WebSettings } from './settings';

const SMOOTHING_TAU_MS = 400;
/**
 * Cuánto vale la última postura vista. El bucle corre más rápido que la cámara,
 * así que muchos ciclos no traen fotograma nuevo; eso no significa que hayas
 * desaparecido, y la postura tampoco cambia en una décima de segundo.
 */
const RECENT_SIGHTING_MS = 1500;
/** Muestras que se necesitan para dar por buena una calibración. */
const CALIBRATION_SAMPLES = 8;
/** Tope de espera de la calibración: en portátiles lentos cuesta más. */
const CALIBRATION_TIMEOUT_MS = 8000;
const MAX_ANGLE = 70;

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'En pausa',
  ok: 'Postura correcta',
  slouching: 'Te estás encorvando…',
  scare: '¡Enderézate!',
  countdown: 'Cuenta atrás',
  alarm: '¡ALERTA DE POSTURA!',
  cooldown: 'Recuperado',
};

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Falta el elemento #${id}`);
  return node as T;
};

const ui = {
  video: el<HTMLVideoElement>('video'),
  overlay: el<HTMLCanvasElement>('overlay'),
  angle: el('angle'),
  phase: el('phase'),
  cause: el('cause'),
  bar: el('bar'),
  threshold: el('threshold-mark'),
  grace: el('grace'),
  start: el<HTMLButtonElement>('start'),
  calibrate: el<HTMLButtonElement>('calibrate'),
  test: el<HTMLButtonElement>('test'),
  status: el('status'),
  alertOverlay: el('alert-overlay'),
  alertText: el('alert-text'),
  alertBody: el('alert-body'),
  alerts: el('stat-alerts'),
  badTime: el('stat-bad'),
  sessionTime: el('stat-session'),
  inputs: {
    thresholdDeg: el<HTMLInputElement>('set-threshold'),
    graceSeconds: el<HTMLInputElement>('set-grace'),
    volume: el<HTMLInputElement>('set-volume'),
    fps: el<HTMLInputElement>('set-fps'),
    headphones: el<HTMLInputElement>('set-headphones'),
    easAlways: el<HTMLInputElement>('set-eas'),
    voiceEnabled: el<HTMLInputElement>('set-voice'),
    notificationsEnabled: el<HTMLInputElement>('set-notify'),
  },
  values: {
    thresholdDeg: el('val-threshold'),
    graceSeconds: el('val-grace'),
    volume: el('val-volume'),
    fps: el('val-fps'),
  },
};

let settings: WebSettings = DEFAULT_SETTINGS;
let engine: EngineState = createInitialState();
let alerts: WebAlerts;
let landmarker: PoseLandmarker | null = null;
let running = false;
let timer: number | null = null;
let smoothed: PostureMetrics | null = null;
let lastFrameAt: number | null = null;
let lastVideoTime = -1;
let calibrationSamples: PostureMetrics[] | null = null;
let cause: PostureCause = 'none';
/** El análisis es síncrono: sin esto los avisos del temporizador se apilan. */
let busy = false;
/** Momento de la última detección válida (`performance.now()`). */
let lastSeenAt = 0;
/** Últimos puntos vistos: se siguen dibujando entre fotogramas nuevos. */
let lastLandmarks: Landmark[] | null = null;
/** `true` mientras la cámara ve bien a la persona. */
let visible = false;

function config(): EngineConfig {
  return {
    ...DEFAULT_ENGINE_CONFIG,
    thresholdDeg: settings.thresholdDeg,
    graceMs: settings.graceSeconds * 1000,
  };
}

function alarmSound(): AlarmSound {
  return settings.easAlways || settings.headphones ? 'eas' : 'siren';
}

function setStatus(message: string): void {
  ui.status.textContent = message;
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60}s` : `${seconds}s`;
}

// --------------------------------------------------------------- acciones ---

function runAction(action: EngineAction): void {
  switch (action.type) {
    case 'beep':
      alerts.playBeep();
      break;
    case 'speak':
      alerts.speak(action.text, settings.voiceEnabled);
      break;
    case 'silence':
      alerts.stopAll();
      break;
    case 'startAlarm':
      alerts.startAlarm(alarmSound());
      break;
    case 'notify':
      alerts.notify(action.title, action.body, settings.notificationsEnabled);
      break;
    case 'haptic':
      // Un portátil no vibra; el aviso ya suena y parpadea en pantalla.
      break;
  }
}

// ------------------------------------------------------------------- bucle ---

function readPose(nowMs: number): { metrics: PostureMetrics | null; landmarks: Landmark[] | null } {
  if (!landmarker || ui.video.readyState < 2 || ui.video.currentTime === lastVideoTime) {
    return { metrics: null, landmarks: null };
  }
  lastVideoTime = ui.video.currentTime;
  const result = landmarker.detectForVideo(ui.video, nowMs);
  const landmarks = (result.landmarks?.[0] as Landmark[] | undefined) ?? null;
  return { metrics: extractMetrics(landmarks), landmarks };
}

function tick(): void {
  if (busy) return;
  busy = true;
  try {
    detect();
  } finally {
    busy = false;
  }
}

function detect(): void {
  const nowMs = performance.now();
  const dtMs = lastFrameAt == null ? 1000 / settings.fps : Math.min(nowMs - lastFrameAt, 2000);
  lastFrameAt = nowMs;

  const { metrics, landmarks } = readPose(nowMs);
  if (landmarks) {
    lastLandmarks = landmarks;
  }

  if (metrics) {
    lastSeenAt = nowMs;
    smoothed = smoothMetrics(smoothed, metrics, dtMs, SMOOTHING_TAU_MS);
    if (calibrationSamples) {
      calibrationSamples.push(metrics);
    }
  }

  const baseline = settings.baseline;
  visible = nowMs - lastSeenAt < RECENT_SIGHTING_MS;
  drawOverlay(visible ? lastLandmarks : null);
  const trusted = visible && !calibrationSamples;
  const deviation = baseline && smoothed && trusted ? deviationFrom(baseline, smoothed) : null;
  cause = deviation?.cause ?? 'none';

  if (engine.phase === 'idle') {
    engine = { ...engine, deviationDeg: deviation?.deg ?? engine.deviationDeg };
  } else {
    const result = step(engine, { deviationDeg: deviation?.deg ?? engine.deviationDeg, dtMs, trusted }, config());
    engine = result.state;
    result.actions.forEach(runAction);
  }

  render();
}

function restartLoop(): void {
  if (timer != null) window.clearInterval(timer);
  timer = window.setInterval(tick, Math.round(1000 / settings.fps));
}

// -------------------------------------------------------------- pintado ---

function drawOverlay(landmarks: Landmark[] | null): void {
  const canvas = ui.overlay;
  const { clientWidth: width, clientHeight: height } = canvas;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, width, height);
  if (!landmarks) return;

  const point = (index: number) => ({ x: landmarks[index].x * width, y: landmarks[index].y * height });
  const shoulders = [point(POSE.leftShoulder), point(POSE.rightShoulder)];
  const ears = [point(POSE.leftEar), point(POSE.rightEar)];

  context.strokeStyle = engine.phase === 'alarm' ? '#FF3B30' : cause === 'none' ? '#2ED47A' : '#FFC24B';
  context.lineWidth = 4;
  context.lineCap = 'round';

  context.beginPath();
  context.moveTo(shoulders[0].x, shoulders[0].y);
  context.lineTo(shoulders[1].x, shoulders[1].y);
  context.stroke();

  // Las verticales oreja→hombro son justo lo que se acorta al encorvarse.
  for (const [ear, shoulder] of [
    [ears[0], shoulders[0]],
    [ears[1], shoulders[1]],
  ]) {
    context.beginPath();
    context.moveTo(ear.x, ear.y);
    context.lineTo(shoulder.x, shoulder.y);
    context.stroke();
  }

  context.fillStyle = context.strokeStyle;
  for (const { x, y } of [...shoulders, ...ears]) {
    context.beginPath();
    context.arc(x, y, 6, 0, Math.PI * 2);
    context.fill();
  }
}

function render(): void {
  const deviation = engine.deviationDeg;
  ui.angle.textContent = `${Math.round(deviation)}°`;
  ui.phase.textContent = PHASE_LABEL[engine.phase];
  ui.cause.textContent = !settings.baseline
    ? 'Sin calibrar'
    : !visible
      ? 'No te veo: colócate frente a la cámara'
      : engine.phase === 'idle'
        ? 'Listo para vigilar'
        : CAUSE_LABEL[deviation >= settings.thresholdDeg ? cause : 'none'];

  const color =
    engine.phase === 'alarm'
      ? '#FF3B30'
      : engine.phase === 'ok' || engine.phase === 'cooldown' || engine.phase === 'idle'
        ? '#2ED47A'
        : '#FFC24B';
  ui.bar.style.width = `${Math.min(100, (deviation / MAX_ANGLE) * 100)}%`;
  ui.bar.style.background = color;
  ui.angle.style.color = color;
  ui.phase.style.color = color;
  ui.threshold.style.left = `${Math.min(100, (settings.thresholdDeg / MAX_ANGLE) * 100)}%`;
  ui.grace.style.width = `${Math.min(100, (engine.badMs / (settings.graceSeconds * 1000)) * 100)}%`;

  ui.alerts.textContent = String(engine.totalAlerts);
  ui.badTime.textContent = formatDuration(engine.sessionBadMs);
  ui.sessionTime.textContent = formatDuration(engine.sessionMs);

  const showCountdown = engine.phase === 'countdown';
  const showAlarm = engine.phase === 'alarm';
  ui.alertOverlay.className = showAlarm ? 'alert alarm' : showCountdown ? 'alert countdown' : 'alert hidden';
  if (showCountdown) {
    ui.alertText.textContent = String(Math.max(1, engine.countsSpoken));
    ui.alertBody.textContent = '';
  } else if (showAlarm) {
    ui.alertText.textContent = '¡ENDERÉZATE!';
    ui.alertBody.textContent = MESSAGES.notificationBody;
  }
}

// -------------------------------------------------------------- acciones ---

async function ensureDetector(): Promise<boolean> {
  if (landmarker) return true;
  try {
    setStatus('Pidiendo permiso de cámara…');
    await startCamera(ui.video);
    setStatus('Cargando el detector de postura…');
    landmarker = await createPoseLandmarker(setStatus);
    // La primera inferencia compila los kernels y puede tardar segundos: se
    // hace aquí para que no se coma la ventana de calibración.
    setStatus('Preparando el detector…');
    await warmUp();
    restartLoop();
    setStatus('Cámara lista. El vídeo no sale de este equipo.');
    return true;
  } catch (error) {
    setStatus(`No se pudo abrir la cámara: ${(error as Error).message}`);
    return false;
  }
}

/** Primera inferencia en vacío, para pagar el arranque antes de vigilar. */
async function warmUp(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    if (landmarker && ui.video.readyState >= 2) {
      landmarker.detectForVideo(ui.video, performance.now());
      lastVideoTime = ui.video.currentTime;
    }
  } catch {
    // Si falla, el bucle lo reintentará en el siguiente fotograma.
  }
}

async function calibrate(): Promise<void> {
  if (!(await ensureDetector())) return;
  ui.calibrate.disabled = true;
  setStatus('Siéntate recto y no te muevas…');
  calibrationSamples = [];

  // Se espera a juntar muestras, no un tiempo fijo: en un portátil lento cada
  // fotograma puede tardar bastante más de lo previsto.
  const deadline = Date.now() + CALIBRATION_TIMEOUT_MS;
  while ((calibrationSamples?.length ?? 0) < CALIBRATION_SAMPLES && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const samples = calibrationSamples ?? [];
  calibrationSamples = null;
  ui.calibrate.disabled = false;

  if (samples.length < 3) {
    setStatus('No te he visto lo suficiente. Colócate frente a la cámara y repite.');
    return;
  }

  const average = samples.reduce((acc, sample) => ({
    shoulderWidth: acc.shoulderWidth + sample.shoulderWidth / samples.length,
    headLift: acc.headLift + sample.headLift / samples.length,
    shoulderY: acc.shoulderY + sample.shoulderY / samples.length,
    tiltDeg: acc.tiltDeg + sample.tiltDeg / samples.length,
  }), { shoulderWidth: 0, headLift: 0, shoulderY: 0, tiltDeg: 0 });

  smoothed = average;
  update({ baseline: average });
  setStatus('Postura guardada. Ya puedes empezar a vigilar.');
  alerts.speak('Postura guardada.', settings.voiceEnabled);
}

async function start(): Promise<void> {
  await alerts.unlock();
  if (!settings.baseline) {
    await calibrate();
    if (!settings.baseline) return;
  }
  if (!(await ensureDetector())) return;

  await alerts.requestNotifications(settings.notificationsEnabled);
  await alerts.requestWakeLock();
  engine = startMonitoring(engine);
  running = true;
  ui.start.textContent = 'Parar vigilancia';
  ui.start.classList.add('stop');
  setStatus('Vigilando tu postura.');
  render();
}

function stop(): void {
  const result = stopMonitoring(engine);
  engine = result.state;
  result.actions.forEach(runAction);
  alerts.stopAll();
  void alerts.releaseWakeLock();
  running = false;
  ui.start.textContent = 'Empezar a vigilar';
  ui.start.classList.remove('stop');
  setStatus('En pausa.');
  render();
}

/** Reproduce la secuencia entera sin tener que encorvarse. */
async function preview(): Promise<void> {
  await alerts.unlock();
  ui.test.disabled = true;
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  alerts.playBeep();
  for (const number of MESSAGES.counts) {
    await wait(DEFAULT_ENGINE_CONFIG.countStepMs);
    alerts.speak(number, settings.voiceEnabled);
  }
  await wait(DEFAULT_ENGINE_CONFIG.countStepMs);
  alerts.speak(MESSAGES.alarm, settings.voiceEnabled);
  alerts.startAlarm(alarmSound());
  await wait(3500);
  alerts.stopAll();
  ui.test.disabled = false;
}

// -------------------------------------------------------------- ajustes ---

function update(patch: Partial<WebSettings>): void {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  alerts.setVolume(settings.volume);
  syncInputs();
  render();
}

function syncInputs(): void {
  ui.inputs.thresholdDeg.value = String(settings.thresholdDeg);
  ui.inputs.graceSeconds.value = String(settings.graceSeconds);
  ui.inputs.volume.value = String(settings.volume);
  ui.inputs.fps.value = String(settings.fps);
  ui.inputs.headphones.checked = settings.headphones;
  ui.inputs.easAlways.checked = settings.easAlways;
  ui.inputs.voiceEnabled.checked = settings.voiceEnabled;
  ui.inputs.notificationsEnabled.checked = settings.notificationsEnabled;

  ui.values.thresholdDeg.textContent = `${settings.thresholdDeg}°`;
  ui.values.graceSeconds.textContent = `${settings.graceSeconds} s`;
  ui.values.volume.textContent = `${Math.round(settings.volume * 100)}%`;
  ui.values.fps.textContent = `${settings.fps} fps`;
}

function bindInputs(): void {
  ui.inputs.thresholdDeg.addEventListener('input', () => update({ thresholdDeg: Number(ui.inputs.thresholdDeg.value) }));
  ui.inputs.graceSeconds.addEventListener('input', () => update({ graceSeconds: Number(ui.inputs.graceSeconds.value) }));
  ui.inputs.volume.addEventListener('input', () => update({ volume: Number(ui.inputs.volume.value) }));
  ui.inputs.fps.addEventListener('input', () => {
    update({ fps: Number(ui.inputs.fps.value) });
    if (landmarker) restartLoop();
  });
  ui.inputs.headphones.addEventListener('change', () => update({ headphones: ui.inputs.headphones.checked }));
  ui.inputs.easAlways.addEventListener('change', () => update({ easAlways: ui.inputs.easAlways.checked }));
  ui.inputs.voiceEnabled.addEventListener('change', () => update({ voiceEnabled: ui.inputs.voiceEnabled.checked }));
  ui.inputs.notificationsEnabled.addEventListener('change', () => {
    update({ notificationsEnabled: ui.inputs.notificationsEnabled.checked });
    void alerts.requestNotifications(settings.notificationsEnabled);
  });
}

function main(): void {
  settings = loadSettings();
  alerts = new WebAlerts();
  alerts.setVolume(settings.volume);
  syncInputs();
  bindInputs();
  render();

  ui.start.addEventListener('click', () => (running ? stop() : void start()));
  ui.calibrate.addEventListener('click', () => void calibrate());
  ui.test.addEventListener('click', () => void preview());

  // Al volver de otra pestaña hay que recuperar el bloqueo de pantalla.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running && !alerts.hasWakeLock) {
      void alerts.requestWakeLock();
    }
  });

  window.addEventListener('beforeunload', () => {
    alerts.stopAll();
    stopCamera(ui.video);
  });

  setStatus('Pulsa «Calibrar postura» para empezar. El vídeo no sale de este equipo.');
}

main();
