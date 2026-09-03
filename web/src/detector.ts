import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

/** Modelo servido junto a la app (lo copia `npm run web:build`). */
const LOCAL_MODEL = 'models/pose_landmarker_lite.task';
/** Si no está en local, se descarga del CDN de MediaPipe la primera vez. */
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

async function resolveModelUrl(): Promise<string> {
  try {
    const response = await fetch(LOCAL_MODEL, { method: 'HEAD' });
    if (response.ok) return LOCAL_MODEL;
  } catch {
    // Servido desde otro sitio o sin el modelo copiado: tiramos del CDN.
  }
  return CDN_MODEL;
}

/**
 * Carga MediaPipe Pose. Intenta primero con GPU y cae a CPU en los portátiles
 * cuyo navegador no expone WebGL a WASM.
 */
export async function createPoseLandmarker(log: (message: string) => void): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks('wasm');
  const modelAssetPath = await resolveModelUrl();
  log(modelAssetPath === LOCAL_MODEL ? 'Cargando modelo local…' : 'Descargando modelo (5,8 MB)…');

  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath, delegate },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
  });

  try {
    return await PoseLandmarker.createFromOptions(vision, options('GPU'));
  } catch {
    log('Sin GPU disponible, usando CPU…');
    return PoseLandmarker.createFromOptions(vision, options('CPU'));
  }
}

/** Abre la webcam. Todo el vídeo se queda en el navegador. */
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(video: HTMLVideoElement): void {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}
