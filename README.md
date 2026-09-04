# PostureFix

App móvil (iOS y Android) que vigila tu postura con el acelerómetro del teléfono: si te
agachas demasiado tiempo, suena un pitido fuerte que te pega el susto; si sigues agachado,
la voz cuenta **"uno… dos… tres"** y salta una alerta fuerte con notificación de máxima
prioridad, vibración larga y un tono continuo. Con auriculares puestos, ese tono es la señal
de atención **EAS** (853 Hz + 960 Hz), la misma que precede a los avisos de tornado.

Hecha con Expo (React Native + TypeScript). Hay dos versiones que comparten la misma
secuencia de alerta: la **app de móvil**, que mide con el acelerómetro, y la
**versión para portátil**, que mide con la webcam.

## Cómo funciona

### Detección

El acelerómetro mide el vector de la gravedad en los ejes del teléfono. Al calibrar con la
espalda recta se guarda ese vector; a partir de ahí, **el ángulo entre el vector guardado y
el actual es cuánto te has inclinado**. Girar sobre ti mismo no cambia ese ángulo, así que
el método sólo reacciona a agacharse o ladearse, no a cambiar de orientación.

- Las lecturas se suavizan con un filtro paso bajo (τ = 300 ms) para ignorar temblores.
- Las muestras cuyo módulo se aleja de 1 g más de 0,22 g se descartan: si caminas o mueves
  el móvil, la aceleración propia falsearía el ángulo, así que los contadores se congelan.
- La entrada y salida del estado "agachado" usan histéresis (6°) para que no parpadee.

### Secuencia de alerta

| Paso | Cuándo | Qué pasa |
| --- | --- | --- |
| 1 | Te agachas más del umbral (22° por defecto) | La barra de margen empieza a llenarse |
| 2 | Sigues agachado 4 s (configurable) | **Pitido fuerte** de dos tonos + vibración |
| 3 | Sigues agachado 1,6 s más | La voz cuenta **"uno… dos… tres"** con números a pantalla completa |
| 4 | Sigues agachado | **Alerta fuerte**: notificación de máxima prioridad, pantalla roja parpadeante, vibración en bucle y tono continuo (**EAS** con auriculares, sirena de dos tonos por altavoz) |
| 5 | Te enderezas 0,8 s | Todo se apaga, la voz dice "Bien, espalda recta" y empieza un descanso de 4 s |

Por seguridad la alarma nunca suena más de 45 s seguidos.

### Auriculares

El módulo nativo local [`modules/headphones`](modules/headphones) consulta la ruta de audio
del sistema (`AudioManager` en Android, `AVAudioSession` en iOS) y avisa a la app cuando se
conectan o desconectan auriculares de cable, USB o Bluetooth. En Expo Go, donde el módulo
nativo no está compilado, la app cae en el interruptor **"Llevo auriculares"** de los ajustes.

## Ejecutar (móvil)

```bash
npm install
npx expo start          # Expo Go: todo funciona menos la detección automática de auriculares
```

Para la app completa hace falta una build de desarrollo (el módulo nativo de auriculares no
existe en Expo Go):

```bash
npx expo run:android    # o: npx expo run:ios   (requiere macOS + Xcode)
```

### Comprobaciones

```bash
npm test        # máquina de estados, trigonometría y medición por webcam
npm run typecheck
npm run assets  # regenera sonidos e iconos
```

## Versión para portátil (webcam)

La misma alerta, pero midiendo la postura con la webcam en lugar del acelerómetro: pensada
para cuando estás sentado delante de un portátil (HP, Asus, cualquiera con cámara).

```bash
npm install
npm run web:dev      # http://localhost:8080
```

`npm run web:build` deja la app lista en `web/dist/` para servirla donde quieras. Hace falta
`localhost` o `https://`, que es lo único que acepta el navegador para dar acceso a la cámara.

### Qué mide

Una cámara frontal no ve la curva de la columna, pero sí cuatro señales que la delatan, todas
comparadas con una calibración previa y normalizadas con la anchura de tus hombros (así no
dependen de tu estatura ni de la distancia a la pantalla):

| Indicador | Qué detecta |
| --- | --- |
| `hunch` | Las orejas se acercan a los hombros: te encorvas |
| `lean` | Los hombros se ven más anchos: te echas sobre la pantalla |
| `slide` | Los hombros bajan en el encuadre: te escurres en la silla |
| `tilt` | La línea de los hombros se inclina: te ladeas |

Cuando la cámara ve a varias personas se mide a la de **hombros más anchos**, que es siempre
la más cercana: así, en un sitio con gente alrededor, la app no se pone a medir a quien pasa
por detrás.

Se toma el peor de los cuatro (no la suma) y se traduce a "grados equivalentes", de modo que
la máquina de estados y el umbral son exactamente los mismos que en el móvil. La interfaz dice
cuál de los cuatro está mandando.

### Qué comparte con la app de móvil

- `src/core/postureEngine.ts`: la secuencia pitido → cuenta → alarma, idéntica.
- Los tres WAV: pitido, tono EAS y sirena.
- La voz es `speechSynthesis` y el aviso, la Notification API del navegador.

### Detalles

- **Privacidad**: el vídeo se procesa en el navegador y no sale del equipo. Lo único que se
  descarga es el modelo de MediaPipe (5,8 MB), que `npm run web:build` deja en local.
- **Coste**: analiza 15 fotogramas por segundo por defecto, ajustable entre 5 y 30. La postura
  cambia despacio, así que bajarlo apenas se nota.
- **En segundo plano**: si minimizas la ventana, el navegador ralentiza el análisis a ~1 fps,
  pero el sonido y la notificación siguen saltando.
- Los auriculares se marcan a mano: el navegador no expone la ruta de audio.


## App de escritorio (el ejecutable)

La versión de webcam también se empaqueta como aplicación de escritorio, y eso resuelve dos
cosas que el navegador no puede:

- **Se abre con doble clic**, sin terminal ni `localhost`: los archivos se sirven por un
  esquema propio `app://` que Chromium trata como contexto seguro, así que la cámara funciona.
- **Sigue vigilando en segundo plano**: `backgroundThrottling: false` mantiene el análisis a
  pleno ritmo con la ventana minimizada (una pestaña normal bajaría a ~1 fotograma por
  segundo), y al cerrar la ventana la app se queda en la bandeja del sistema.

### Descargarla ya hecha

Las versiones publicadas están en **[Releases](https://github.com/agus-blackops/PostureFix/releases)**,
con los ejecutables adjuntos: no caducan y se descargan sin iniciar sesión. Se publican solas al
etiquetar una versión (`git tag v1.0.1 && git push origin v1.0.1`).

Para probar un cambio que aún no es versión, cada ejecución del workflow **App de escritorio**
deja los mismos archivos como artefactos: pestaña *Actions* → la ejecución más reciente →
sección *Artifacts* (caducan a los 90 días y piden sesión):

| Archivo | Para qué |
| --- | --- |
| `PostureFix-portable-1.0.2.exe` | Windows sin instalar: se descarga y se abre |
| `PostureFix-instalador-1.0.2.exe` | Windows con instalador y acceso directo |
| `PostureFix-1.0.2.AppImage` | Linux |

### Construirla uno mismo

```bash
npm install
npm run desktop         # la abre en modo desarrollo
npm run desktop:build   # genera los ejecutables en release/
```

`npm run desktop:build` empaqueta para el sistema donde se ejecuta: el `.exe` sale desde
Windows y el AppImage desde Linux. Por eso el workflow los construye en los runners de GitHub.

> `electron` y `electron-builder` son dependencias de desarrollo: sólo hacen falta para
> empaquetar. Para trabajar sólo con la app de móvil se pueden omitir.


## Cómo se afina la medida

El ángulo que ve el usuario pasa por tres filtros pensados para que sea exacto y
puntual a la vez:

1. **Mediana de las tres últimas lecturas.** Descarta por completo un valor suelto
   disparatado —el fotograma en el que el detector coloca un hombro donde no está—,
   algo que ningún promedio sabe hacer: lo promedian y se lo tragan.
2. **Filtro adaptativo «one euro».** Con la persona quieta suaviza mucho; en cuanto
   la señal se mueve de verdad, se abre y deja pasar el cambio. Sobre un escalón de
   40°, a los 200 ms va por 38,7° donde el paso bajo fijo de la 1.0.1 iba por 22,6°.
3. **Descarte de lecturas imposibles.** En el móvil, las que se alejan de 1 g más de
   0,22 g (estás caminando); en la webcam, los fotogramas donde no se te ve bien.

La calibración usa la **mediana** de las muestras, no la media, y mide su dispersión
para avisarte si te movías mientras calibrabas. Y si tras un meneo el ángulo da un
salto grande, la app supone que le han movido el sensor: pausa la vigilancia y pide
recalibrar en vez de avisar de una postura que no existe.

`src/core/oneEuro.ts`, `src/core/calibration.ts` y `src/core/reposition.ts` son puros
y están cubiertos por tests.

## Medir si funciona (el experimento)

PostureFix no solo avisa: también **mide**, para poder responder a la pregunta con datos en
lugar de con opiniones.

1. Activa **Sesión de control**: la app mide y registra igual, pero no pita, no habla, no
   vibra y no enseña la pantalla roja. Es el grupo de comparación.
2. Haz otra sesión con los avisos puestos, de duración parecida.
3. En **Historial y resultados** aparece el porcentaje de tiempo encorvado de cada grupo y
   cuánto baja gracias a los avisos.

Las sesiones de menos de medio minuto no se guardan, porque no dicen nada. La versión de
portátil exporta el historial a **CSV** para llevarlo a una hoja de cálculo o a un póster.

La comparación vive en `src/core/sessionLog.ts`, es pura y está cubierta por tests: cuando
falta alguno de los dos grupos no inventa una conclusión, lo dice.


## Ajustes

Desde el engranaje de la pantalla principal:

- **Umbral de agachado** (10°–55°) y **margen antes del pitido** (1–20 s).
- **Volumen** de las alertas.
- **Tono EAS con auriculares** y **tono EAS siempre** (también por altavoz).
- **Voz**, **vibración**, **notificación** y **mantener la pantalla encendida**.
- En la versión de portátil, **precisión del detector** (modelo grande o ligero) y
  **modo feria**, que deja los tiempos cortos para enseñarlo en un stand.

El botón **Probar alerta** reproduce la secuencia completa sin tener que agacharse.

## Recursos generados

`scripts/generate-assets.mjs` genera sin dependencias externas, y de forma determinista, los
sonidos y los iconos que se versionan en `assets/`:

- `beep.wav` — cuatro pulsos alternos de 1046/1568 Hz: el susto.
- `eas.wav` — 853 Hz + 960 Hz simultáneos, 4 s en bucle continuo (frecuencias y duración
  enteras, así que el bucle no chasquea).
- `alarm.wav` — sirena de dos tonos para el altavoz.
- Iconos de app, adaptativos de Android y favicon.

## Versiones

`CHANGELOG.md` lleva la cuenta de lo que cambia en cada versión. La actual es la **1.0.2**, la
que va a la feria.

## Panel para la feria

`docs/panel-feria.html` es el panel explicativo del stand: la hipótesis y las variables, las dos
formas de medir con sus diagramas, la secuencia de aviso con sus tiempos reales y cómo se
comprueba con sesiones de control. Se abre con doble clic en cualquier navegador y está pensado
para imprimirse (lleva sus propios estilos de impresión).

## Estructura

```
App.tsx                      pantalla principal (móvil)
src/core/postureEngine.ts    máquina de estados pura de la alerta (con tests)
src/core/orientation.ts      trigonometría del acelerómetro (con tests)
src/core/settings.ts         ajustes persistidos en AsyncStorage
src/core/sessionLog.ts       historial de sesiones y comparación (con tests)
src/services/               audio, voz, vibración y notificaciones
src/hooks/usePostureMonitor  une sensor + máquina de estados + avisos
src/ui/                      componentes de interfaz
modules/headphones/          módulo nativo de detección de auriculares (Kotlin + Swift)
scripts/generate-assets.mjs  generador de sonidos e iconos
web/                         versión para portátil: webcam + MediaPipe Pose
web/src/postureVision.ts     medición de postura por webcam (con tests)
web/build.mjs                empaquetado con esbuild
desktop/main.js              envoltorio de escritorio (Electron)
docs/panel-feria.html        panel explicativo para el stand
.github/workflows/           construcción de los ejecutables
```

La lógica de la secuencia vive en una función pura (`step()`), compartida por las dos
versiones, así que las 70 pruebas la recorren entera —pitido, cuenta atrás, alarma,
recuperación, histéresis y cortes de seguridad— sin sensores, cámara ni sonido.

## Limitaciones

- **La app tiene que estar en primer plano.** iOS y Android cortan el acelerómetro cuando la
  pantalla se bloquea, por eso PostureFix mantiene la pantalla encendida mientras vigila.
- La detección asume que el teléfono se mueve con el torso: bolsillo del pecho, del pantalón
  o sujeto al cinturón. Sobre la mesa no mide nada útil.
- Si cambias el móvil de sitio o de bolsillo, vuelve a calibrar.
- En la versión de webcam hay que estar encuadrado y con algo de luz; con la tapa cerrada o
  la cámara tapada no hay medición posible.
- El tono EAS es una reproducción local de las dos frecuencias de la señal de atención; la
  app no emite ni retransmite avisos de emergencia reales.
