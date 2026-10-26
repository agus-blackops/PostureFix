import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import {
  betterCamera,
  cameraAttempts,
  isPermissionError,
  type CameraInfo,
  type VideoConstraints,
} from './cameraPlan';

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

/** Las cámaras que ve el sistema. Sin permiso todavía, sin nombres. */
export async function listCameras(): Promise<CameraInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device) => ({ deviceId: device.deviceId, label: device.label }));
}

export interface OpenedCamera {
  stream: MediaStream;
  deviceId: string | null;
  label: string;
}

async function open(video: HTMLVideoElement, constraints: VideoConstraints): Promise<OpenedCamera> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
  try {
    video.srcObject = stream;
    await video.play();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  const track = stream.getVideoTracks()[0];
  return { stream, deviceId: track?.getSettings().deviceId ?? null, label: track?.label ?? '' };
}

/**
 * Abre la webcam. Todo el vídeo se queda en el navegador.
 *
 * Prueba las cámaras en orden (ver `cameraAttempts`) hasta que una se abre: si
 * la elegida ya no está, está ocupada o no acepta el tamaño, sigue con las
 * demás. Un error de permiso para en seco: otra cámara no lo arreglaría. Si
 * acaba abierta la de infrarrojos y hay una normal, se cambia a la normal.
 */
export async function startCamera(video: HTMLVideoElement, preferredId: string | null = null): Promise<OpenedCamera> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Este navegador no deja usar la cámara', 'NotSupportedError');
  }
  const cameras = await listCameras().catch(() => []);
  let lastError: unknown = null;
  for (const constraints of cameraAttempts(preferredId, cameras)) {
    let opened: OpenedCamera;
    try {
      opened = await open(video, constraints);
    } catch (error) {
      if (isPermissionError(error)) throw error;
      lastError = error;
      continue;
    }
    // Con el permiso ya concedido el sistema da los nombres: ¿hay una mejor?
    const named = await listCameras().catch(() => []);
    const better = betterCamera(opened.label, named);
    if (better && better !== opened.deviceId) {
      try {
        opened.stream.getTracks().forEach((track) => track.stop());
        return await open(video, { width: { ideal: 640 }, height: { ideal: 480 }, deviceId: { exact: better } });
      } catch {
        return open(video, constraints);
      }
    }
    return opened;
  }
  throw lastError ?? new DOMException('No hay ninguna cámara', 'NotFoundError');
}

export function stopCamera(video: HTMLVideoElement): void {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}
