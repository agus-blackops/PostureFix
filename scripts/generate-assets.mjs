#!/usr/bin/env node
/**
 * Genera los recursos binarios de PostureFix (sonidos WAV e iconos PNG) sin
 * dependencias externas, de forma determinista.
 *
 *   npm run assets
 *
 * Los archivos resultantes se versionan en el repositorio para que la app se
 * pueda ejecutar con un simple `npm install && npx expo start`.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOUNDS = join(ROOT, 'assets', 'sounds');
const ASSETS = join(ROOT, 'assets');

// ---------------------------------------------------------------- audio ----

const SAMPLE_RATE = 32000;

/** Escribe PCM de 16 bits mono. `samples` va de -1 a 1. */
function writeWav(file, samples, sampleRate = SAMPLE_RATE) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // tamaño del bloque fmt
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits por muestra
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  writeFileSync(file, buffer);
  return buffer.length;
}

const seconds = (s) => Math.round(s * SAMPLE_RATE);
/** Onda cuadrada suavizada: dura al oído pero sin tanto aliasing. */
const harsh = (phase) => Math.tanh(3.2 * Math.sin(phase));

/**
 * Pitido de susto: cuatro pulsos alternos y muy secos. Es lo primero que suena
 * cuando el usuario lleva demasiado tiempo agachado.
 */
function buildBeep() {
  const pulse = 0.13;
  const gap = 0.055;
  const tones = [1046, 1568, 1046, 1568];
  const total = seconds(tones.length * (pulse + gap));
  const out = new Float32Array(total);
  let cursor = 0;
  for (const freq of tones) {
    const length = seconds(pulse);
    const attack = seconds(0.004);
    for (let i = 0; i < length; i++) {
      const env = Math.min(1, i / attack, (length - i) / attack);
      out[cursor + i] = 0.95 * env * harsh((2 * Math.PI * freq * i) / SAMPLE_RATE);
    }
    cursor += length + seconds(gap);
  }
  return out;
}

/**
 * Tono de atención EAS: 853 Hz + 960 Hz simultáneos, igual que el aviso de
 * emergencia de la NOAA/EAS que precede a los avisos de tornado. La duración
 * en segundos enteros con frecuencias enteras hace que el bucle sea continuo.
 */
function buildEas(durationSeconds = 4) {
  const total = seconds(durationSeconds);
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = 0.47 * Math.sin(2 * Math.PI * 853 * t) + 0.47 * Math.sin(2 * Math.PI * 960 * t);
  }
  return out;
}

/**
 * Sirena de dos tonos para la alarma por altavoz (cuando no hay auriculares).
 * Cada tramo dura medio segundo exacto, así que también encadena sin cortes.
 */
function buildAlarm(durationSeconds = 4) {
  const total = seconds(durationSeconds);
  const out = new Float32Array(total);
  const segment = seconds(0.5);
  for (let i = 0; i < total; i++) {
    const freq = Math.floor(i / segment) % 2 === 0 ? 740 : 988;
    const inSegment = i % segment;
    const env = Math.min(1, inSegment / seconds(0.008), (segment - inSegment) / seconds(0.008));
    out[i] = 0.9 * env * harsh((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return out;
}

// ----------------------------------------------------------------- png -----

function createCanvas(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function blend(canvas, x, y, color, coverage) {
  if (coverage <= 0 || x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const alpha = Math.min(1, coverage) * (color[3] ?? 1);
  if (alpha <= 0) return;
  const i = (y * canvas.width + x) * 4;
  const dstA = canvas.data[i + 3] / 255;
  const outA = alpha + dstA * (1 - alpha);
  for (let c = 0; c < 3; c++) {
    const src = color[c];
    const dst = canvas.data[i + c];
    canvas.data[i + c] = outA === 0 ? 0 : (src * alpha + dst * dstA * (1 - alpha)) / outA;
  }
  canvas.data[i + 3] = outA * 255;
}

function fillBackground(canvas, inner, outer) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxDistance = Math.hypot(cx, cy);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const t = Math.min(1, Math.hypot(x - cx, y - cy) / maxDistance);
      const color = [0, 1, 2].map((c) => inner[c] + (outer[c] - inner[c]) * t);
      blend(canvas, x, y, [...color, 1], 1);
    }
  }
}

/** Cápsula (segmento con extremos redondeados) con antialiasing por distancia. */
function capsule(canvas, x1, y1, x2, y2, radius, color) {
  const minX = Math.floor(Math.min(x1, x2) - radius - 1);
  const maxX = Math.ceil(Math.max(x1, x2) + radius + 1);
  const minY = Math.floor(Math.min(y1, y2) - radius - 1);
  const maxY = Math.ceil(Math.max(y1, y2) + radius + 1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
      const distance = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      blend(canvas, x, y, color, radius + 0.5 - distance);
    }
  }
}

const circle = (canvas, cx, cy, radius, color) => capsule(canvas, cx, cy, cx, cy, radius, color);

function quadraticStroke(canvas, p0, p1, p2, width, color) {
  const steps = 160;
  let previous = p0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const inverse = 1 - t;
    const point = [
      inverse * inverse * p0[0] + 2 * inverse * t * p1[0] + t * t * p2[0],
      inverse * inverse * p0[1] + 2 * inverse * t * p1[1] + t * t * p2[1],
    ];
    capsule(canvas, previous[0], previous[1], point[0], point[1], width / 2, color);
    previous = point;
  }
}

function arcStroke(canvas, cx, cy, radius, fromDeg, toDeg, width, color) {
  const steps = 120;
  let previous = null;
  for (let i = 0; i <= steps; i++) {
    const angle = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    const point = [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    if (previous) capsule(canvas, previous[0], previous[1], point[0], point[1], width / 2, color);
    previous = point;
  }
}

/** Silueta encorvada + ondas de aviso. Coordenadas pensadas para 1024x1024. */
function drawGlyph(canvas, color, scale = 1, offsetX = 0, offsetY = 0) {
  const S = canvas.width / 1024;
  const px = (x) => (x - 512) * scale * S + canvas.width / 2 + offsetX * S;
  const py = (y) => (y - 512) * scale * S + canvas.height / 2 + offsetY * S;
  const w = (value) => value * scale * S;

  circle(canvas, px(372), py(300), w(92), color);
  quadraticStroke(canvas, [px(366), py(408)], [px(300), py(596)], [px(536), py(716)], w(78), color);
  capsule(canvas, px(520), py(724), px(762), py(724), w(46), color);
  arcStroke(canvas, px(700), py(330), w(120), -62, 62, w(34), color);
  arcStroke(canvas, px(700), py(330), w(210), -55, 55, w(34), color);
}

function encodePng(canvas) {
  const { width, height, data } = canvas;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtro "None"
    data.slice(y * width * 4, (y + 1) * width * 4).forEach((value, i) => {
      raw[y * (width * 4 + 1) + 1 + i] = value;
    });
  }

  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc32 = (buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, payload) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(payload.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Envuelve un PNG en un contenedor .ico, que es lo que pide Windows para el
 * icono del ejecutable de escritorio. Desde Vista el .ico admite PNG dentro,
 * así que basta con la cabecera de 22 bytes.
 */
function pngToIco(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(1, 4); // una sola imagen
  header.writeUInt8(size >= 256 ? 0 : size, 6); // 0 significa 256 px
  header.writeUInt8(size >= 256 ? 0 : size, 7);
  header.writeUInt8(0, 8); // paleta
  header.writeUInt8(0, 9); // reservado
  header.writeUInt16LE(1, 10); // planos
  header.writeUInt16LE(32, 12); // bits por píxel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
}

/** Reduce con muestreo por cajas para que el favicon no quede dentado. */
function downscale(canvas, size) {
  const out = createCanvas(size, size);
  const factor = canvas.width / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      let count = 0;
      for (let sy = Math.floor(y * factor); sy < (y + 1) * factor; sy++) {
        for (let sx = Math.floor(x * factor); sx < (x + 1) * factor; sx++) {
          const i = (sy * canvas.width + sx) * 4;
          for (let c = 0; c < 4; c++) acc[c] += canvas.data[i + c];
          count++;
        }
      }
      const i = (y * size + x) * 4;
      for (let c = 0; c < 4; c++) out.data[i + c] = acc[c] / count;
    }
  }
  return out;
}

const NAVY = [11, 16, 32];
const NAVY_TOP = [26, 38, 84];
const ORANGE = [255, 122, 41, 1];
const WHITE = [255, 255, 255, 1];

function buildIcons() {
  const icon = createCanvas(1024, 1024);
  fillBackground(icon, NAVY_TOP, NAVY);
  drawGlyph(icon, ORANGE);

  const splash = createCanvas(1024, 1024);
  drawGlyph(splash, ORANGE, 0.78);

  const foreground = createCanvas(1024, 1024);
  drawGlyph(foreground, ORANGE, 0.62);

  const background = createCanvas(1024, 1024);
  fillBackground(background, NAVY_TOP, NAVY);

  const monochrome = createCanvas(1024, 1024);
  drawGlyph(monochrome, WHITE, 0.62);

  return {
    'icon.png': icon,
    'splash-icon.png': splash,
    'android-icon-foreground.png': foreground,
    'android-icon-background.png': background,
    'android-icon-monochrome.png': monochrome,
    'favicon.png': downscale(icon, 48),
  };
}

// ---------------------------------------------------------------- main -----

mkdirSync(SOUNDS, { recursive: true });
const sounds = { 'beep.wav': buildBeep(), 'eas.wav': buildEas(), 'alarm.wav': buildAlarm() };
for (const [name, samples] of Object.entries(sounds)) {
  const bytes = writeWav(join(SOUNDS, name), samples);
  console.log(`assets/sounds/${name}  ${(bytes / 1024).toFixed(0)} KB`);
}

const icons = buildIcons();
for (const [name, canvas] of Object.entries(icons)) {
  const png = encodePng(canvas);
  writeFileSync(join(ASSETS, name), png);
  console.log(`assets/${name}  ${(png.length / 1024).toFixed(0)} KB`);
}

// Icono del ejecutable de escritorio (Windows).
const ico = pngToIco(encodePng(downscale(icons['icon.png'], 256)), 256);
writeFileSync(join(ASSETS, 'icon.ico'), ico);
console.log(`assets/icon.ico  ${(ico.length / 1024).toFixed(0)} KB`);
