# Tráiler de PostureFix

`PostureFix-trailer.mp4` — 48 s, 1920×1080, 30 fps, con música y efectos.

- `trailer.html`: la animación entera, como función del tiempo (`setT(t)`). Ábrelo en el
  navegador y pulsa para verla y se ve en directo, sin sonido.
- `make-audio.mjs`: sintetiza la banda sonora (`node make-audio.mjs audio.wav`).
- `render.mjs`: dibuja los fotogramas con Playwright y los junta con el audio usando ffmpeg.
- `fonts/`: Big Shoulders Display e Inter (licencia SIL OFL).

No hay datos inventados: la escena del experimento muestra barras con «?» y solo plantea la
hipótesis.
