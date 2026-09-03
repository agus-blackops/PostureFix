#!/usr/bin/env node
/**
 * Construye la versión de escritorio (webcam) en `web/dist`.
 *
 *   npm run web:build     genera los archivos
 *   npm run web:dev       los sirve en http://localhost:8080 con recarga
 *
 * Se sirve por HTTP local porque `getUserMedia` sólo funciona en un contexto
 * seguro: `localhost` o `https://`.
 */
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'web', 'dist');
const MODEL_NAME = 'pose_landmarker_lite.task';
const MODEL_URL = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/${MODEL_NAME}`;

const serve = process.argv.includes('--serve');
const skipModel = process.argv.includes('--skip-model');

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * El modelo de MediaPipe (5,8 MB) no se versiona: se descarga la primera vez.
 * Si no hay red, la app tira del CDN al arrancar, así que no es bloqueante.
 */
async function ensureModel() {
  const target = join(DIST, 'models', MODEL_NAME);
  if (skipModel || (await exists(target))) return;
  await mkdir(dirname(target), { recursive: true });
  process.stdout.write(`Descargando ${MODEL_NAME} (5,8 MB)… `);
  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
    console.log('listo');
  } catch (error) {
    console.log(`no se pudo (${error.message}); la app lo bajará del CDN al arrancar`);
  }
}

await mkdir(DIST, { recursive: true });

// El HTML se copia con la ruta del bundle ya resuelta.
await writeFile(join(DIST, 'index.html'), await readFile(join(ROOT, 'web', 'index.html'), 'utf8'));
// Los mismos sonidos que la app de móvil.
await cp(join(ROOT, 'assets', 'sounds'), join(DIST, 'sounds'), { recursive: true });
// El runtime WASM de MediaPipe, servido en local en vez de desde un CDN.
await cp(join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'), join(DIST, 'wasm'), { recursive: true });
await ensureModel();

const options = {
  entryPoints: [join(ROOT, 'web', 'src', 'main.ts')],
  outfile: join(DIST, 'app.js'),
  bundle: true,
  format: 'iife',
  target: ['chrome110', 'firefox110', 'safari16'],
  sourcemap: true,
  minify: !serve,
  logLevel: 'info',
};

if (serve) {
  const context = await esbuild.context(options);
  await context.watch();
  const { hosts, port } = await context.serve({ servedir: DIST, port: 8080 });
  console.log(`\nPostureFix escritorio en http://localhost:${port} (${hosts.join(', ')})`);
} else {
  await esbuild.build(options);
  console.log(`\nListo: ${DIST}`);
}
