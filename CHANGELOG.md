# Cambios

## 1.1.0

Versión de aspecto: la app pasa a Material Design 3 de arriba abajo, con los
mismos avisos y la misma forma de medir.

- **Un solo sistema de diseño en los tres sitios.** `src/ui/theme.ts` define los
  roles de color de M3 (primary / onPrimary / primaryContainer…), la escala de
  formas, la rejilla de 4 dp, los niveles de elevación y la escala tipográfica;
  la hoja de estilos de la versión de portátil repite los mismos valores como
  variables CSS. Antes cada pantalla elegía su color a mano, así que móvil y
  portátil se parecían de lejos y no de cerca.
- **Componentes de verdad, no cajas sueltas** (`src/ui/material.tsx`): botones
  relleno / tonal / contorno / texto con su capa de estado al pulsar, FAB
  extendido, tarjetas rellenas y elevadas, chips de asistencia, filas de lista,
  separadores e indicador lineal con la marca del umbral.
- **Paleta derivada del naranja de siempre.** El color fuente (#FF7A29) genera
  el tema oscuro: fondo cálido, primary claro para lo importante y las familias
  propias `success` y `warning` para «postura correcta» y «te estás agachando»,
  que M3 no define.
- **Ajustes en hoja inferior**, con asa de arrastre, secciones y filas de lista:
  cada opción tiene su explicación debajo y el control a la derecha.
- **La alerta a pantalla completa ya no es translúcida.** Parpadeaba bajando la
  opacidad, así que se transparentaba la app y perdía fuerza; ahora alterna dos
  colores opacos y tapa la pantalla entera.
- **En pausa el medidor va en gris**, no en verde: el verde significa «postura
  correcta» y en pausa no se está midiendo nada.
- **Arreglos de la versión de portátil**: los avisos y la leyenda respetan el
  atributo `hidden` (antes el `display: flex` lo pisaba y el aviso de sensor
  movido se veía siempre), la tira de sesiones no reserva hueco cuando está
  vacía y el titular de la alarma ya no se solapa con el texto de debajo.
- **Detalles de accesibilidad**: foco visible en todos los controles y respeto a
  `prefers-reduced-motion`, que apaga el parpadeo.

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
