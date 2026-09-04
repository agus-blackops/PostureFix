# Cambios

## 1.0.2

Versión centrada en medir mejor: los mismos avisos, pero sobre un número más
fiable.

- **Suavizado nuevo: mediana de 3 + filtro adaptativo** («one euro»). El paso
  bajo anterior obligaba a elegir entre ruido y retardo. Medido sobre un
  escalón de 40°, a los 200 ms el ángulo va por 38,7° en vez de 22,6°: la
  alerta deja de llegar tarde. Y un fotograma suelto en el que el detector se
  inventa un hombro ya no mueve la medida ni una décima, cuando antes la
  desplazaba 6°.
- **Calibración con mediana en vez de media.** Un respingo al final de la
  cuenta ya no tuerce la referencia de toda la sesión. Además se mide cuánto
  bailaban las lecturas y la app avisa si conviene repetir.
- **Detecta que le han movido el sensor.** Si tras un meneo el ángulo pega un
  salto, la app deduce que el móvil se ha deslizado en el bolsillo o que han
  movido el portátil: pone la vigilancia en pausa y pide recalibrar, en lugar
  de disparar alarmas por una postura que nadie tiene. Era la causa número uno
  de avisos falsos.
- **Modelo de detección más preciso en la versión de webcam** (9,4 MB en vez de
  5,8), seleccionable en ajustes: si el portátil va justo, se vuelve al ligero.
- **Modo feria**: un botón deja los tiempos cortos para el stand —la secuencia
  completa en unos 5 s en vez de 8,3— y los devuelve al salir.

## 1.0.1

Versión preparada para la feria de ciencias: además de avisar, la app ahora **mide si avisar
sirve de algo**.

- **Sesión de control.** Mide y registra exactamente igual, pero no pita, no habla, no vibra ni
  enseña la pantalla de alerta. Es el grupo con el que comparar.
- **Historial y resultados.** Cada sesión se guarda con su tiempo encorvado y sus alertas, y la
  app calcula cuánto baja el tiempo en mala postura gracias a los avisos. Si falta alguno de los
  dos grupos lo dice en vez de inventarse una conclusión. La versión de portátil añade un gráfico
  por sesión y descarga en CSV.
- **No se cuela quien pase por detrás.** Con varias personas a la vista, la webcam mide a la de
  hombros más anchos, que es la más cercana a la cámara.
- **Panel para el stand** (`docs/panel-feria.html`): hipótesis, variables, los dos métodos de
  medición con diagramas, la secuencia de aviso y la ficha técnica. Con estilos de impresión.
- El ejecutable de escritorio adelgaza de 193 MB a unos 117 MB: ya no se lleva dentro las
  dependencias de la app de móvil.
- La versión aparece en la app, en la web y en el panel, tomada del `app.json` y del
  `package.json` para que no haya dos sitios que actualizar.

## 1.0.0

Primera versión.

- App de móvil (Expo) que vigila la postura con el acelerómetro: al agacharse más del umbral
  durante unos segundos suena un pitido de susto, después la voz cuenta «uno, dos, tres» y por
  último salta la alerta fuerte, con el tono de emergencia EAS (853 + 960 Hz) si hay auriculares
  y una sirena de dos tonos si no.
- Módulo nativo propio (Kotlin y Swift) para detectar la ruta de audio.
- Versión para portátil que mide la postura con la webcam usando MediaPipe Pose, compartiendo la
  misma máquina de estados y los mismos sonidos.
- Envoltorio de escritorio (Electron) que se abre con doble clic y sigue vigilando desde la
  bandeja del sistema, con los ejecutables construidos en los runners de GitHub.
