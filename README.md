# PostureFix

App móvil (iOS y Android) que vigila tu postura con el acelerómetro del teléfono: si te
agachas demasiado tiempo, suena un pitido fuerte que te pega el susto; si sigues agachado,
la voz cuenta **"uno… dos… tres"** y salta una alerta fuerte con notificación de máxima
prioridad, vibración larga y un tono continuo. Con auriculares puestos, ese tono es la señal
de atención **EAS** (853 Hz + 960 Hz), la misma que precede a los avisos de tornado.

Hecha con Expo (React Native + TypeScript).

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

## Ejecutar

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
npm test        # tests de la máquina de estados y de la trigonometría
npm run typecheck
npm run assets  # regenera sonidos e iconos
```

## Ajustes

Desde el engranaje de la pantalla principal:

- **Umbral de agachado** (10°–55°) y **margen antes del pitido** (1–20 s).
- **Volumen** de las alertas.
- **Tono EAS con auriculares** y **tono EAS siempre** (también por altavoz).
- **Voz**, **vibración**, **notificación** y **mantener la pantalla encendida**.

El botón **Probar alerta** reproduce la secuencia completa sin tener que agacharse.

## Recursos generados

`scripts/generate-assets.mjs` genera sin dependencias externas, y de forma determinista, los
sonidos y los iconos que se versionan en `assets/`:

- `beep.wav` — cuatro pulsos alternos de 1046/1568 Hz: el susto.
- `eas.wav` — 853 Hz + 960 Hz simultáneos, 4 s en bucle continuo (frecuencias y duración
  enteras, así que el bucle no chasquea).
- `alarm.wav` — sirena de dos tonos para el altavoz.
- Iconos de app, adaptativos de Android y favicon.

## Estructura

```
App.tsx                      pantalla principal
src/core/postureEngine.ts    máquina de estados pura de la alerta (con tests)
src/core/orientation.ts      trigonometría del acelerómetro (con tests)
src/core/settings.ts         ajustes persistidos en AsyncStorage
src/services/               audio, voz, vibración y notificaciones
src/hooks/usePostureMonitor  une sensor + máquina de estados + avisos
src/ui/                      componentes de interfaz
modules/headphones/          módulo nativo de detección de auriculares (Kotlin + Swift)
scripts/generate-assets.mjs  generador de sonidos e iconos
```

La lógica de la secuencia vive en una función pura (`step()`), así que las 20 pruebas la
recorren entera —pitido, cuenta atrás, alarma, recuperación, histéresis y cortes de
seguridad— sin sensores ni sonido.

## Limitaciones

- **La app tiene que estar en primer plano.** iOS y Android cortan el acelerómetro cuando la
  pantalla se bloquea, por eso PostureFix mantiene la pantalla encendida mientras vigila.
- La detección asume que el teléfono se mueve con el torso: bolsillo del pecho, del pantalón
  o sujeto al cinturón. Sobre la mesa no mide nada útil.
- Si cambias el móvil de sitio o de bolsillo, vuelve a calibrar.
- El tono EAS es una reproducción local de las dos frecuencias de la señal de atención; la
  app no emite ni retransmite avisos de emergencia reales.
