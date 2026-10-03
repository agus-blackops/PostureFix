import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

/**
 * Dos modelos de MediaPipe Pose. El grande sitúa los puntos con más exactitud
 * —que es de lo que salen todas las medidas— a cambio de más trabajo por
 * fotograma; en un portátil que vaya justo, el ligero mantiene el ritmo.
 */
export type ModelQuality = 'lite' | 'full';

export const MODEL_INFO: Record<ModelQuality, { name: string; sizeMB: number }> = {
  lite: { name: 'pose_landmarker_lite.task', sizeMB: 5.8 },
  full: { name: 'pose_landmarker_full.task', sizeMB: 9.4 },
};

const cdnUrl = (quality: ModelQuality) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${quality}` +
  `/float16/1/${MODEL_INFO[quality].name}`;

/** Prefiere el modelo servido junto a la app; si no está, tira del CDN. */
async function resolveModelUrl(quality: ModelQuality): Promise<string> {
  const local = `models/${MODEL_INFO[quality].name}`;
  try {
    const response = await fetch(local, { method: 'HEAD' });
    if (response.ok) return local;
  } catch {
    // Servido desde otro sitio o sin el modelo copiado: tiramos del CDN.
  }
  return cdnUrl(quality);
}

/**
 * Carga MediaPipe Pose. Intenta primero con GPU y cae a CPU en los portátiles
 * cuyo navegador no expone WebGL a WASM.
 */
export async function createPoseLandmarker(
  log: (message: string) => void,
  quality: ModelQuality = 'full'
): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks('wasm');
  const modelAssetPath = await resolveModelUrl(quality);
  log(
    modelAssetPath.startsWith('models/')
      ? 'Cargando el modelo…'
      : `Descargando el modelo (${MODEL_INFO[quality].sizeMB} MB)…`
  );

  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath, delegate },
    runningMode: 'VIDEO' as const,
    // Se piden varias personas para poder quedarnos con la más cercana a la
    // cámara: en un sitio con gente alrededor, la de delante es la que importa.
    numPoses: 3,
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
