/**
 * Qué cámara abrir y en qué orden probarlas.
 *
 * Muchos portátiles (los ASUS con Windows Hello, entre otros) tienen dos: la
 * webcam normal y una de infrarrojos para reconocer la cara al iniciar sesión.
 * Si el navegador abre la de infrarrojos, la imagen sale en blanco y negro y
 * muy de cerca, y el detector no encuentra a la persona; a veces ni se abre.
 * Por eso se prueba primero la elegida, luego las normales y la de
 * infrarrojos, la última. Puro, para poder probarlo sin cámaras.
 */

export interface CameraInfo {
  deviceId: string;
  label: string;
}

/** Restricciones de vídeo de un intento: las de siempre, sin más, o una cámara concreta. */
export type VideoConstraints = true | MediaTrackConstraints;

/** Resolución pedida: de sobra para ver hombros y orejas, y ligera. */
const SIZE = { width: { ideal: 640 }, height: { ideal: 480 } } as const;

/** Cámaras de infrarrojos (Windows Hello y similares), por su nombre. */
export function isInfraredCamera(label: string): boolean {
  return /(^|[^a-z])(ir|infrared|infrarroj\w*|hello)([^a-z]|$)/i.test(label);
}

/**
 * Los intentos, en orden. Las cámaras sin identificador (el navegador las da
 * así antes de tener permiso) no se pueden pedir por separado.
 */
export function cameraAttempts(preferredId: string | null, cameras: readonly CameraInfo[]): VideoConstraints[] {
  const known = cameras.filter((camera) => camera.deviceId);
  const normal = known.filter((camera) => !isInfraredCamera(camera.label));
  const infrared = known.filter((camera) => isInfraredCamera(camera.label));
  const byId = (deviceId: string): MediaTrackConstraints => ({ ...SIZE, deviceId: { exact: deviceId } });

  const ids: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  add(preferredId);
  // Con nombres (ya hay permiso) se va directa a una normal.
  if (normal.some((camera) => camera.label)) add(normal[0].deviceId);

  return [
    ...ids.map(byId),
    // La que elija el navegador, y si no acepta tamaño ni orientación, sin condiciones.
    { ...SIZE, facingMode: 'user' },
    true,
    ...normal.map((camera) => camera.deviceId).filter((id) => !ids.includes(id)).map(byId),
    ...infrared.map((camera) => camera.deviceId).filter((id) => !ids.includes(id)).map(byId),
  ];
}

/**
 * Si se ha abierto la de infrarrojos y hay otra normal, la normal. Sirve para
 * la primera vez: hasta tener permiso el navegador no dice los nombres.
 */
export function betterCamera(openedLabel: string, cameras: readonly CameraInfo[]): string | null {
  if (!isInfraredCamera(openedLabel)) return null;
  return cameras.find((camera) => camera.deviceId && camera.label && !isInfraredCamera(camera.label))?.deviceId ?? null;
}

/** Errores de permiso: probar otra cámara no los arregla. */
export function isPermissionError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError';
}

/** Nombre para el selector de cámaras. */
export function cameraLabel(camera: CameraInfo, index: number): string {
  const name = camera.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim() || `Cámara ${index + 1}`;
  return isInfraredCamera(camera.label) ? `${name} (infrarrojos)` : name;
}
