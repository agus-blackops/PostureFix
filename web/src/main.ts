import type { PoseLandmarker } from '@mediapipe/tasks-vision';

import {
  DEFAULT_ENGINE_CONFIG,
  MESSAGES,
  createInitialState,
  isAlerting,
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
  selectSubject,
  smoothMetrics,
  type Landmark,
  type PostureCause,
  type PostureMetrics,
} from './postureVision';
import {
  addSession,
  compareModes,
  toCsv,
  type SessionRecord,
} from '../../src/core/sessionLog';
import {
  DEFAULT_SETTINGS,
  loadHistory,
  loadSettings,
  saveHistory,
  saveSettings,
  type WebSettings,
} from './settings';

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
  historyEmpty: el('historial-vacio'),
  comparison: el('comparativa'),
  barControl: el('barra-control'),
  barAlerts: el('barra-avisos'),
  valueControl: el('valor-control'),
  valueAlerts: el('valor-avisos'),
  conclusion: el('conclusion'),
  sessions: el('sesiones'),
  legend: el('leyenda'),
  csv: el<HTMLButtonElement>('csv'),
  clearHistory: el<HTMLButtonElement>('borrar'),
  inputs: {
    controlMode: el<HTMLInputElement>('set-control'),
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
let history: SessionRecord[] = [];
/** Inicio de la sesión en curso, para guardarla al parar. */
let sessionStartedAt = 0;
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
  // En una sesión de control se cuenta todo pero no se avisa de nada: es el
  // grupo con el que después se compara.
  if (settings.controlMode && action.type !== 'silence') {
    return;
  }
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
  const subject = selectSubject(result.landmarks as Landmark[][] | undefined);
  return { metrics: subject?.metrics ?? null, landmarks: subject?.landmarks ?? null };
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
  ui.phase.textContent =
    settings.controlMode && isAlerting(engine.phase)
      ? 'Mala postura registrada (sin avisar)'
      : PHASE_LABEL[engine.phase];
  ui.cause.textContent = !settings.baseline
    ? 'Sin calibrar'
    : !visible
      ? 'No te veo: colócate frente a la cámara'
      : engine.phase === 'idle'
        ? 'Listo para vigilar'
        : (settings.controlMode ? 'Sesión de control · ' : '') +
          CAUSE_LABEL[deviation >= settings.thresholdDeg ? cause : 'none'];

  const color =
    engine.phase === 'alarm' && !settings.controlMode
      ? '#FF3B30'
      : engine.phase === 'ok' || engine.phase === 'cooldown' || engine.phase === 'idle'
        ? '#2ED47A'
        : '#FFC24B';
  ui.bar.style.width = cssPercent(deviation / MAX_ANGLE);
  ui.bar.style.background = color;
  ui.angle.style.color = color;
  ui.phase.style.color = color;
  ui.threshold.style.left = cssPercent(settings.thresholdDeg / MAX_ANGLE);
  ui.grace.style.width = cssPercent(engine.badMs / (settings.graceSeconds * 1000));

  ui.alerts.textContent = String(engine.totalAlerts);
  ui.badTime.textContent = formatDuration(engine.sessionBadMs);
  ui.sessionTime.textContent = formatDuration(engine.sessionMs);

  const showCountdown = engine.phase === 'countdown' && !settings.controlMode;
  const showAlarm = engine.phase === 'alarm' && !settings.controlMode;
  ui.alertOverlay.className = showAlarm ? 'alert alarm' : showCountdown ? 'alert countdown' : 'alert hidden';
  if (showCountdown) {
    ui.alertText.textContent = String(Math.max(1, engine.countsSpoken));
    ui.alertBody.textContent = '';
  } else if (showAlarm) {
    ui.alertText.textContent = '¡ENDERÉZATE!';
    ui.alertBody.textContent = MESSAGES.notificationBody;
  }
}

// ------------------------------------------------------------ historial ---

/** Guarda la sesión que acaba de terminar (si duró lo suficiente). */
function recordSession(): void {
  if (sessionStartedAt === 0) return;
  const record: SessionRecord = {
    startedAt: sessionStartedAt,
    durationMs: engine.sessionMs,
    badMs: engine.sessionBadMs,
    alerts: engine.totalAlerts,
    source: 'webcam',
    alertsEnabled: !settings.controlMode,
  };
  sessionStartedAt = 0;
  const updated = addSession(history, record);
  if (updated !== history) {
    history = updated;
    saveHistory(history);
  }
  // Los contadores se reinician para que la próxima sesión empiece limpia.
  engine = { ...createInitialState(), deviationDeg: engine.deviationDeg };
  renderHistory();
}

/** Para leer: con espacio antes del %, como manda la tipografía en español. */
const percent = (ratio: number) => `${(ratio * 100).toFixed(1)} %`;
/** Para CSS: sin espacio, o el navegador descarta la declaración entera. */
const cssPercent = (ratio: number) => `${Math.min(100, Math.max(0, ratio * 100)).toFixed(1)}%`;

function renderHistory(): void {
  const hasHistory = history.length > 0;
  ui.historyEmpty.hidden = hasHistory;
  ui.comparison.hidden = !hasHistory;
  ui.legend.hidden = !hasHistory;
  if (!hasHistory) {
    ui.sessions.replaceChildren();
    return;
  }

  const { control, withAlerts, improvement } = compareModes(history);
  ui.barControl.style.width = cssPercent(control.badRatio);
  ui.barAlerts.style.width = cssPercent(withAlerts.badRatio);
  ui.valueControl.textContent = control.sessions ? percent(control.badRatio) : '—';
  ui.valueAlerts.textContent = withAlerts.sessions ? percent(withAlerts.badRatio) : '—';

  ui.conclusion.textContent =
    improvement == null
      ? `Faltan datos para comparar: ${control.sessions} sesión(es) de control y ${withAlerts.sessions} con avisos.`
      : improvement > 0
        ? `Con los avisos se pasa un ${percent(improvement)} menos de tiempo encorvado.`
        : `Con los avisos no baja el tiempo encorvado (${percent(-improvement)} más).`;

  // Una barra por sesión, de la más antigua a la más reciente.
  const recent = history.slice(0, 24).reverse();
  ui.sessions.replaceChildren(
    ...recent.map((record) => {
      const ratio = record.durationMs > 0 ? record.badMs / record.durationMs : 0;
      const bar = document.createElement('div');
      bar.className = `sesion ${record.alertsEnabled ? 'avisos' : 'control'}`;
      const fill = document.createElement('i');
      fill.style.height = cssPercent(ratio);
      bar.appendChild(fill);
      bar.title = [
        new Date(record.startedAt).toLocaleString(),
        record.alertsEnabled ? 'con avisos' : 'control (sin avisos)',
        `${(record.durationMs / 60000).toFixed(1)} min`,
        `${percent(ratio)} encorvado`,
        `${record.alerts} alerta(s)`,
      ].join(' · ');
      return bar;
    })
  );
}

function downloadCsv(): void {
  const blob = new Blob([toCsv(history)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `posturefix-sesiones-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
  sessionStartedAt = Date.now();
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
  recordSession();
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
  ui.inputs.controlMode.checked = settings.controlMode;

  ui.values.thresholdDeg.textContent = `${settings.thresholdDeg}°`;
  ui.values.graceSeconds.textContent = `${settings.graceSeconds} s`;
  ui.values.volume.textContent = `${Math.round(settings.volume * 100)}%`;
  ui.values.fps.textContent = `${settings.fps} fps`;
}

function bindInputs(): void {
  ui.inputs.controlMode.addEventListener('change', () => update({ controlMode: ui.inputs.controlMode.checked }));
  ui.csv.addEventListener('click', downloadCsv);
  ui.clearHistory.addEventListener('click', () => {
    if (history.length === 0 || !confirm('¿Borrar todas las sesiones guardadas?')) return;
    history = [];
    saveHistory(history);
    renderHistory();
  });
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
  history = loadHistory();
  alerts = new WebAlerts();
  alerts.setVolume(settings.volume);
  syncInputs();
  bindInputs();
  render();
  renderHistory();

  ui.start.addEventListener('click', () => (running ? stop() : void start()));
  ui.calibrate.addEventListener('click', () => void calibrate());
  ui.test.addEventListener('click', () => void preview());

  // Al volver de otra pestaña hay que recuperar el bloqueo de pantalla.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running && !alerts.hasWakeLock) {
      void alerts.requestWakeLock();
    }
  });

  // Cerrar la ventana en mitad de una sesión no debe perder la medición.
  window.addEventListener('beforeunload', () => {
    if (running) recordSession();
    alerts.stopAll();
    stopCamera(ui.video);
  });

  setStatus('Pulsa «Calibrar postura» para empezar. El vídeo no sale de este equipo.');
}

main();
