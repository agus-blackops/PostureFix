# Cambios

## 1.1.2

Material 3 Expressive encima del cristal de la 1.1.1, animaciones nuevas y una
tanda de arreglos de calidad. Se mide y se avisa igual que antes.

**Material 3 Expressive**

- **Anillo ondulado.** El tramo recorrido del medidor es la onda del indicador
  de Expressive, y su altura dice cuánto urge: liso con la postura bien, ondas
  suaves al agacharte y fuertes, y más rápidas, en la cuenta atrás y la alarma.
  La pista se queda lisa y la marca blanca sigue señalando el umbral.
- **Formas que se transforman.** Detrás de la cifra hay una forma que cambia
  con el estado: círculo en pausa, «galleta» con la postura bien, flor al
  asustarte y estallido en la alarma. Pasa de una a otra con un rebote. La
  alarma a pantalla completa lleva un estallido enorme girando detrás del texto.
- **Indicador de carga de Expressive.** Mientras se calibra, o mientras el
  portátil enciende la cámara y carga el detector, una forma se va
  transformando en la siguiente y gira, en vez de quedarse todo quieto.
- **Botones que cambian de forma.** Al pulsarlos la cápsula se cuadra un poco.
  El botón principal, cuando está vigilando, pasa a rectángulo redondeado: es
  el estado «seleccionado» de un botón conmutable.
- **Grupo de botones conectado.** «Calibrar» y «Probar alerta» van pegados, con
  las esquinas de dentro casi rectas. El que pulsas se ensancha y empuja al
  otro.
- **Movimiento con muelles de verdad.** Todo lo que se mueve usa los tokens de
  movimiento de Expressive, con su razón de amortiguamiento y su rigidez
  (`src/core/spring.ts`). Hay muelles espaciales, que rebotan un poco, para
  forma y posición, y muelles de efectos, que no rebotan, para color y opacidad.
  En el portátil los mismos muelles se convierten en curvas CSS `linear()`.

**Animaciones nuevas**

- Las tarjetas entran escalonadas: suben un poco y aparecen, una detrás de otra.
- La cápsula del estado da un pequeño rebote cada vez que cambia.
- El anillo persigue la inclinación con un muelle en vez de saltar.
- Todo se para si el sistema pide reducir el movimiento: en el móvil con el
  ajuste de accesibilidad y en el portátil con `prefers-reduced-motion`.

**Calidad**

- **Móvil: menos redibujados.** La pantalla se redibujaba con cada lectura del
  acelerómetro, 20 veces por segundo. Ahora lo hace como mucho 10 veces, y al
  instante cuando cambia de fase. La máquina de estados sigue recibiendo todas
  las lecturas; lo que baja es el gasto de batería.
- **Móvil: el motor ya no puede retroceder.** El estado del motor se copiaba del
  último pintado en cada render. Con el redibujado limitado, eso habría hecho
  retroceder a la máquina una lectura. Ahora solo lo escribe quien lo cambia.
- **Portátil: cambio de modelo.** Si el modelo nuevo no cargaba, la app se
  quedaba sin detector y sin decir nada. Ahora sigue el de antes y lo avisa.
  Además, un segundo cambio mientras cargaba el primero se ignoraba: el
  detector se quedaba con un modelo distinto del que marcaban los ajustes.
- **Portátil: arranque doble.** Empezar a vigilar y calibrar a la vez (o la
  tecla C justo después de Empezar) abría dos cámaras y dos detectores. Ahora
  esperan al mismo arranque.
- **Portátil: error de cámara.** Si falla la cámara, el recuadro lo dice y
  explica qué revisar, en vez de quedarse con «la cámara se enciende al
  calibrar».
- **Móvil: titular de la alarma.** Su tamaño sale del ancho de la pantalla, así
  que cabe en una línea en cualquier móvil sin depender de ajustes que no todas
  las plataformas respetan.
- **Una sola tabla de urgencias.** La urgencia y la forma de cada fase viven en
  un solo sitio (`src/core/expression.ts`), igual para el móvil y el portátil.
- 28 tests nuevos (123 en total): física de los muelles, geometría de la onda y
  de las formas, y la expresión de cada fase.

## 1.1.1

Rediseño al estilo de Apple y una tanda de arreglos de calidad. Se mide y se
avisa igual que en la 1.1.0.

**Aspecto**

- **Materiales de cristal.** Tarjetas, botones y ajustes son ahora de cristal.
  En iOS 26 se usa Liquid Glass de verdad (`expo-glass-effect`). En iOS anterior
  se usan los materiales de desenfoque del sistema (`expo-blur`). En Android se
  pinta un cristal translúcido con su filo de luz. En la versión de portátil es
  `backdrop-filter`.
- **El fondo se tiñe con la postura.** Sobre un negro cálido hay dos
  resplandores. El de arriba es siempre el naranja de la marca. El de abajo pasa
  con un fundido a verde, amarillo o rojo según el estado.
- **Anillo al estilo de Actividad.** El medidor es un anillo que se llena con la
  inclinación, con extremos redondeados y una marca blanca en el umbral. En el
  móvil está hecho sin SVG, con dos semianillos que giran. En el portátil es un
  SVG.
- **Tipografía y colores de Apple.** Se usa la escala de Dynamic Type (título
  grande de 34 pt, cuerpo de 17 pt…) con San Francisco redondeada para las
  cifras. Los colores de estado son los del sistema (verde, amarillo y rojo). El
  acento vuelve a ser el naranja de la marca (#FF7A29), con texto oscuro encima
  para que se lea.
- **Ajustes como en iOS.** Son grupos con cabecera y nota al pie, «steppers» de
  − y +, interruptores de iOS y una hoja con asa y «Listo». En el portátil hay
  además deslizadores que pintan el tramo recorrido y un control segmentado para
  la precisión del detector.
- **Botones que responden.** Se encogen al pulsar y vuelven con un rebote corto.
  En el móvil dan un toque háptico suave, que respeta el ajuste de vibración.

**Experiencia de uso**

- «Antes de empezar» es ahora una lista de tres pasos numerados.
- Mientras te agachas, la app dice cuánto falta para el pitido («Pitido en
  1,4 s») en vez de solo enseñar una barra.
- **La calibración ya no falla en silencio.** Si no junta lecturas fiables
  porque te movías, lo dice y ofrece repetir.
- No se puede calibrar dos veces a la vez, ni empezar a vigilar a mitad de una
  calibración. La prueba de la alerta tampoco se solapa consigo misma. Los
  botones se apagan y dicen qué está pasando («Calibrando… 3/8», «Sonando…»).
- Borrar el historial en el móvil pide confirmación, como ya hacía el portátil.
- Los «steppers» se apagan al llegar a su límite, en vez de aceptar toques que
  no hacen nada.
- **Portátil.**
  - Mientras la cámara está apagada, un recuadro explica que se enciende al
    calibrar.
  - El título grande se recoge en la barra de cristal al desplazarse.
  - «Resultados» ocupa el hueco bajo la cámara en pantallas anchas.
  - Hay atajos de teclado: Espacio empieza o para, C calibra y P prueba la
    alerta.
- Más accesibilidad: el medidor y los avisos se anuncian al lector de pantalla,
  y los botones llevan su pista de lo que hacen.

**Calidad**

- **Ajustes corruptos.** Los ajustes guardados se validan campo a campo.
  - En el portátil, un volumen corrupto llegaba como `NaN` al audio.
  - En los dos, un sí/no guardado como texto (`"false"`) se tomaba por
    verdadero.
  - Ahora cada valor raro vuelve a su valor por defecto (`src/core/validate.ts`).
- **Formatos compartidos.** Duraciones, porcentajes y grados se formatean en un
  solo sitio (`src/core/format.ts`), en vez de en dos copias. Los segundos van
  con dos cifras («3 min 05s»), las sesiones largas pasan a horas
  («1 h 02 min») y los porcentajes llevan coma decimal.
- **Pasos exactos.** El paso de los ajustes numéricos se redondea: bajar el
  volumen de 5 en 5 ya no guarda valores como 0,9000000000000001.
- **Descarga del CSV.** El enlace temporal se libera un segundo después en vez
  de en el mismo instante, que en algunos navegadores cancelaba la descarga.
- 25 tests nuevos (95 en total).

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
