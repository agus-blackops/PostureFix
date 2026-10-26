# Tráiler de PostureFix

`PostureFix-trailer.mp4` — 48 s, 1920×1080, 30 fps, con música y efectos.

- `trailer.html`: la animación entera, como función del tiempo (`setT(t)`). Ábrelo en el
  navegador y pulsa para verla y se ve en directo, sin sonido.
- `make-audio.mjs`: sintetiza la banda sonora (`node make-audio.mjs audio.wav`).
- `render.mjs`: dibuja los fotogramas con Playwright y los junta con el audio usando ffmpeg.
- `fonts/`: Big Shoulders Display e Inter (licencia SIL OFL).

No hay datos inventados: la escena del experimento muestra barras con «?» y solo plantea la
hipótesis.

## Tráiler 2 (vertical)

`PostureFix-trailer2.mp4` — 24 s, 1080×1920 (9:16), con música y efectos. Pensado para
WhatsApp, Instagram o TikTok: un gancho rápido, la interfaz de la app en un móvil, la alerta
a pantalla completa, las funciones de la 2.0 y un QR final.

- `trailer2.html` y `make-audio2.mjs`: la animación y su sonido.
- `audio-lib.mjs`: piezas comunes del sonido.
- Se saca con `TRAILER=trailer2 SIZE=1080x1920 node render.mjs <carpeta> <ffmpeg>`; antes hay
  que dejar el audio en `<carpeta>/trailer2.wav` (`node make-audio2.mjs <carpeta>/trailer2.wav`).
  Para el primero, el audio va en `<carpeta>/trailer.wav`.

## Tráiler 3 (2D + 3D, largo)

`PostureFix-trailer3.mp4` — 77 s, 1920×1080, con música y efectos. Mezcla escenas en 2D y en
3D (three.js): la persona encorvándose y el título con el anillo, un móvil con la gravedad y el
ángulo en vivo, y los ejes de la calibración en dos pasos (arriba, delante y lado) con el móvil
inclinándose hacia delante, hacia atrás y de lado. Al final, unas **indirectas** con humor: el horno básico que les ganó en 2025 y la
«revancha» de PostureFix (cuatro «señales» con palabras tapadas, un termómetro que sube y
un anillo que se pone rojo). Es una broma sana, sin nombres ni burlas a nadie.

- `trailer3.html`: la animación (2D en SVG, 3D en un lienzo WebGL debajo).
- `3d/scene3d.js`: las escenas en 3D; `build3d.mjs` las compila a `trailer3-3d.js`
  (hace falta `three`: `npm i --no-save three` y, si no está en este proyecto,
  `NODE_PATH=<carpeta>/node_modules`).
- `make-audio3.mjs` (con `audio-lib.mjs` y `audio-music.mjs`): la banda sonora.
- `TRAILER=trailer3 node render.mjs <carpeta> <ffmpeg>`, con el audio en `<carpeta>/trailer3.wav`.
  Usa WebGL por software (SwiftShader), así que va en cualquier equipo, aunque tarda unos 15 min.

