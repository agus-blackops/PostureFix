#!/usr/bin/env node
/**
 * Compila las escenas en 3D (`3d/scene3d.js`, three.js) a `trailer3-3d.js`, un
 * único archivo que `trailer3.html` carga sin servidor. three.js no es
 * dependencia del proyecto: se instala sólo para esto.
 *
 *   npm i --no-save three            (o NODE_PATH=<carpeta con node_modules>)
 *   node docs/trailer/build3d.mjs
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(here, '3d', 'scene3d.js')],
  outfile: join(here, 'trailer3-3d.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome110'],
  nodePaths: process.env.NODE_PATH ? [process.env.NODE_PATH] : [],
  logLevel: 'info',
});
