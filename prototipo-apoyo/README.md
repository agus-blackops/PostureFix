# Apoyo Ya (prototipo v2)

Primer prototipo de una app para acompañar a estudiantes frente a la angustia y el acoso
escolar. Es un único archivo HTML (`index.html`) que se abre en el navegador, sin servidor.

## Qué hace
- **Ánimo del día:** cinco caritas. Si se marca «muy mal» o «mal», aparece un mensaje de apoyo.
- **Ayuda inmediata:** barra fija arriba con números de emergencia y de orientación en salud mental.
- **Personas de confianza:** contactos guardados solo en el dispositivo. Cada uno tiene un botón
  **Avisar** que abre la app de SMS con un mensaje ya escrito; la persona lo envía, la app no.
- **Me están molestando:** registro privado de situaciones, exportable como `.txt` para
  mostrárselo a un adulto de confianza.

## Principios
- Todo se guarda en `localStorage` del propio dispositivo. No hay cuentas, ni analítica, ni red.
- No diagnostica ni evalúa riesgo: solo orienta hacia personas y líneas de ayuda reales.
- Funciona sin conexión y en modo oscuro.
- **Se instala** como app: en Android, Chrome ofrece «Añadir a la pantalla de inicio»; en iPhone,
  Safari → Compartir → «Añadir a inicio». Para que se instale y funcione sin conexión, hay que
  abrirla desde un enlace `https://` o `http://localhost` (no desde un archivo local).

## Archivos
- `index.html`: la app completa.
- `manifest.webmanifest` e `icon.svg`: para instalarla como app.
- `sw.js`: guarda la app para usarla sin conexión.

## Antes de usarlo de verdad
- Verificar los números de emergencia y de orientación con las autoridades de salud vigentes.
- Revisar el texto con profesionales de salud mental y con un equipo de convivencia escolar.
- Si se publica, hacen falta una política de privacidad y consentimiento de madres, padres o
  tutores para menores de edad.
- Si alguien escribe que corre peligro, la app no reemplaza la llamada a emergencias.
