#!/usr/bin/env node
/**
 * Saca el tráiler a vídeo: dibuja cada fotograma de `trailer.html` con un
 * navegador (Playwright) y los junta con el audio de `make-audio.mjs`.
 *
 *   node docs/trailer/make-audio.mjs <carpeta>/audio.wav
 *   node docs/trailer/render.mjs <carpeta> <ffmpeg> [chromium]
 *
 * Hace falta `playwright-core` (npm i playwright-core) y un ffmpeg con
 * H.264 y AAC. Deja `PostureFix-trailer.mp4` junto a este archivo.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const [, , workDir = join(here, 'build'), ffmpeg = 'ffmpeg', chromium] = process.argv;
const FPS = 30;
// TRAILER=trailer2 SIZE=1080x1920 saca la versión vertical; por defecto, el tráiler 1.
const NAME = process.env.TRAILER || 'trailer';
const [VW, VH] = (process.env.SIZE || '1920x1080').split('x').map(Number);
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, 'x.js') : import.meta.url);
const { chromium: pw } = require('playwright-core');

const frames = join(workDir, `frames-${NAME}`);
// SOLO_VIDEO=1 reutiliza los fotogramas de una pasada anterior (para cambiar el audio).
const reuse = process.env.SOLO_VIDEO === '1' && existsSync(join(frames, 'f00000.jpg'));
if (!reuse) {
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
}

const browser = await pw.launch({ executablePath: chromium || undefined });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
await page.goto('file://' + join(here, `${NAME}.html`) + '?manual');
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => window.DURATION);
const count = Math.round(total * FPS);
for (let i = 0; i < (reuse ? 0 : count); i++) {
  await page.evaluate((t) => window.setT(t), i / FPS);
  await page.screenshot({ path: join(frames, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
  if (i % 120 === 0) console.log(`fotograma ${i}/${count}`);
}
await browser.close();

const audio = join(workDir, `${NAME}.wav`);
const out = join(here, NAME === 'trailer' ? 'PostureFix-trailer.mp4' : `PostureFix-${NAME}.mp4`);
const args = [
  '-y', '-framerate', String(FPS), '-i', join(frames, 'f%05d.jpg'),
  ...(existsSync(audio) ? ['-i', audio, '-c:a', 'aac', '-b:a', '192k'] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-shortest', out,
];
const r = spawnSync(ffmpeg, args, { stdio: 'inherit' });
process.exit(r.status ?? 1);
