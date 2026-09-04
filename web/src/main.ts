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
import {
  MAX_CALIBRATION_SPREAD_DEG,
  medianDistance,
  medianRecord,
} from '../../src/core/calibration';
import {
  createSmootherBank,
  smoothBankStep,
  type SmootherBank,
} from '../../src/core/oneEuro';
import {
  clearReposition,
  createReposition,
  repositionStep,
  type RepositionState,
} from '../../src/core/reposition';
import { WebAlerts } from './alerts';
import { createPoseLandmarker, startCamera, stopCamera, type ModelQuality } from './detector';
import {
  CAUSE_LABEL,
  METRIC_KEYS,
  POSE,
  deviationFrom,
  selectSubject,
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

/** La inyecta esbuild desde el package.json al construir. */
declare const __VERSION__: string;


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
  notice: el('aviso'),
  noticeTitle: el('aviso-titulo'),
  noticeText: el('aviso-texto'),
  noticeRecalibrate: el<HTMLButtonElement>('aviso-recalibrar'),
  noticeDismiss: el<HTMLButtonElement>('aviso-descartar'),
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
    modelQuality: el<HTMLSelectElement>('set-modelo'),
  },
  fairMode: el<HTMLButtonElement>('set-feria'),
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
let smoother: SmootherBank<keyof PostureMetrics & string> = createSmootherBank(METRIC_KEYS);
let reposition: RepositionState = createReposition();
let lastFrameAt: number | null = null;
let lastVideoTime = -1;
let calibrationSamples: PostureMetrics[] | null = null;
let cause: PostureCause = 'none';
let history: SessionRecord[] = [];
/** Inicio de la sesión en curso, para guardarla al parar. */
let sessionStartedAt = 0;
/** Dispersión de la última calibración, en grados. */
let spreadDeg = 0;
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
    const smoothing = smoothBankStep(smoother, metrics, dtMs);
    smoother = smoothing.bank;
    smoothed = smoothing.value;
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

  // Si te pierde de vista y al recuperarte el ángulo ha dado un salto, lo más
  // probable es que se haya movido el portátil, no tu espalda. Se mira la
  // medida **cruda**, que salta en el primer fotograma bueno: la suavizada
  // tarda un segundo largo en llegar y para entonces ya no se distingue de
  // alguien que se ha encorvado despacio.
  if (baseline) {
    const antes = reposition.suspected;
    const crudo = metrics ? deviationFrom(baseline, metrics).deg : engine.deviationDeg;
    reposition = repositionStep(reposition, { deviationDeg: crudo, trusted, dtMs });
    if (reposition.suspected !== antes) {
      renderNotice();
    }
  }

  if (engine.phase === 'idle') {
    engine = { ...engine, deviationDeg: deviation?.deg ?? engine.deviationDeg };
  } else {
    const result = step(
      engine,
      {
        deviationDeg: deviation?.deg ?? engine.deviationDeg,
        dtMs,
        // Con la cámara recolocada las medidas no significan nada.
        trusted: trusted && !reposition.suspected,
      },
      config()
    );
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

// --------------------------------------------------------------- avisos ---

/** Aviso de sensor movido o de calibración poco fiable, con sus acciones. */
function renderNotice(): void {
  const movida = reposition.suspected;
  const calibracionFloja = spreadDeg > MAX_CALIBRATION_SPREAD_DEG;

  ui.notice.hidden = !movida && !calibracionFloja;
  ui.notice.classList.toggle('grave', movida);
  ui.noticeDismiss.hidden = !movida;

  if (movida) {
    ui.noticeTitle.textContent = '¿Se ha movido la cámara?';
    ui.noticeText.textContent =
      'Después de perderte de vista, el ángulo ha dado un salto grande: la postura que guardaste ya no describe tu espalda. La vigilancia está en pausa hasta que recalibres.';
  } else if (calibracionFloja) {
    ui.noticeTitle.textContent = 'Calibración poco fiable';
    ui.noticeText.textContent = `Las medidas bailaban ±${spreadDeg.toFixed(
      1
    )}° mientras calibrabas. Siéntate recto, quédate quieto y repite para que el ángulo sea exacto.`;
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
    landmarker = await createPoseLandmarker(setStatus, settings.modelQuality);
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

/** Cambiar de modelo obliga a rehacer el detector. */
async function rebuildDetector(): Promise<void> {
  if (!landmarker) return;
  const previo = landmarker;
  landmarker = null;
  previo.close();
  setStatus('Cambiando de modelo…');
  landmarker = await createPoseLandmarker(setStatus, settings.modelQuality);
  await warmUp();
  setStatus(`Detector listo (precisión ${settings.modelQuality === 'full' ? 'alta' : 'ligera'}).`);
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

  // Mediana en vez de media: un par de fotogramas malos ya no tuercen la
  // referencia de toda la sesión.
  const baseline = medianRecord(samples, METRIC_KEYS) as PostureMetrics | null;
  if (!baseline) {
    setStatus('No te he visto lo suficiente. Colócate frente a la cámara y repite.');
    return;
  }

  // Y se mide cuánto bailaban las muestras, para poder decir si hay que repetir.
  spreadDeg = medianDistance(samples, baseline, (sample, centro) => deviationFrom(centro, sample).deg);
  const steady = spreadDeg <= MAX_CALIBRATION_SPREAD_DEG;

  smoother = createSmootherBank(METRIC_KEYS);
  reposition = clearReposition(createReposition());
  smoothed = baseline;
  update({ baseline });
  renderNotice();
  setStatus(
    steady
      ? 'Postura guardada. Ya puedes empezar a vigilar.'
      : `Postura guardada, pero te movías (±${spreadDeg.toFixed(1)}°). Conviene repetir.`
  );
  alerts.speak(
    steady ? 'Postura guardada.' : 'Postura guardada, pero te movías. Conviene repetir.',
    settings.voiceEnabled
  );
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
  ui.inputs.modelQuality.value = settings.modelQuality;
  ui.fairMode.textContent = fairModeOn ? 'Salir' : 'Activar';
  ui.fairMode.classList.toggle('activo', fairModeOn);

  ui.values.thresholdDeg.textContent = `${settings.thresholdDeg}°`;
  ui.values.graceSeconds.textContent = `${settings.graceSeconds} s`;
  ui.values.volume.textContent = `${Math.round(settings.volume * 100)}%`;
  ui.values.fps.textContent = `${settings.fps} fps`;
}

/** Preajuste para el stand y los valores a los que volver al salir. */
const FAIR_PRESET = { thresholdDeg: 18, graceSeconds: 1, volume: 1 } as const;
let fairModeOn = false;
let beforeFair: Pick<WebSettings, 'thresholdDeg' | 'graceSeconds' | 'volume'> | null = null;

function toggleFairMode(): void {
  if (fairModeOn && beforeFair) {
    fairModeOn = false;
    update(beforeFair);
    beforeFair = null;
    setStatus('Modo feria desactivado.');
    return;
  }
  beforeFair = {
    thresholdDeg: settings.thresholdDeg,
    graceSeconds: settings.graceSeconds,
    volume: settings.volume,
  };
  fairModeOn = true;
  update(FAIR_PRESET);
  setStatus('Modo feria: la secuencia completa tarda unos 5 s.');
}

function bindInputs(): void {
  ui.inputs.modelQuality.addEventListener('change', () => {
    update({ modelQuality: ui.inputs.modelQuality.value === 'lite' ? 'lite' : 'full' });
    void rebuildDetector();
  });
  ui.fairMode.addEventListener('click', toggleFairMode);
  ui.noticeRecalibrate.addEventListener('click', () => void calibrate());
  ui.noticeDismiss.addEventListener('click', () => {
    reposition = clearReposition(reposition);
    renderNotice();
  });
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
  const marca = document.getElementById('version');
  if (marca) marca.textContent = `v${__VERSION__}`;

  settings = loadSettings();
  history = loadHistory();
  alerts = new WebAlerts();
  alerts.setVolume(settings.volume);
  syncInputs();
  bindInputs();
  render();
  renderHistory();
  renderNotice();

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
