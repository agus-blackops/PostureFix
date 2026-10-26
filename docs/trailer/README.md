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

