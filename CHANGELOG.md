# Cambios

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
