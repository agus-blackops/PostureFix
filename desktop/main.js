/**
 * Envoltorio de escritorio de PostureFix.
 *
 * Resuelve las dos pegas de usar la versión web en un portátil:
 *
 *  1. Se abre con doble clic, sin terminal ni `localhost`: los archivos se
 *     sirven por un esquema propio `app://`, que Chromium trata como contexto
 *     seguro y por tanto permite usar la cámara.
 *  2. Sigue vigilando en segundo plano: `backgroundThrottling: false` mantiene
 *     el análisis a pleno ritmo aunque la ventana esté minimizada (en una
 *     pestaña normal el navegador lo bajaría a ~1 fotograma por segundo), y al
 *     cerrar la ventana la app se queda en la bandeja del sistema.
 */
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, Menu, Tray, nativeImage, net, powerSaveBlocker, protocol, shell } = require('electron');

const DIST = path.join(__dirname, '..', 'web', 'dist');
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');

let window = null;
let tray = null;
let quitting = false;
let powerSaveId = null;

// El esquema propio se declara seguro para que `getUserMedia` funcione igual
// que en https, sin levantar ningún servidor local.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// Una sola instancia: la segunda sólo trae al frente la ventana existente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(start);
}

function serveDist() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    const relative = pathname === '/' || pathname === '' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const filePath = path.join(DIST, relative);
    // Nada fuera de la carpeta de la app.
    if (!filePath.startsWith(DIST)) {
      return new Response('No encontrado', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createWindow() {
  window = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 720,
    minHeight: 640,
    backgroundColor: '#0b1020',
    icon: ICON,
    title: 'PostureFix',
    webPreferences: {
      // Clave para vigilar minimizado: sin esto Chromium frena los
      // temporizadores de las ventanas ocultas.
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.setMenuBarVisibility(false);
  void window.loadURL('app://posturefix/index.html');

  // Cerrar deja la app vigilando en la bandeja; se sale desde el menú del icono.
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });

  // Los enlaces externos se abren en el navegador, no dentro de la app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

function showWindow() {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function createTray() {
  const image = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip('PostureFix — vigilando tu postura');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Mostrar PostureFix', click: showWindow },
      { type: 'separator' },
      {
        label: 'Salir',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('click', showWindow);
}

function start() {
  serveDist();

  // La cámara sólo se concede a la propia app.
  const allowed = new Set(['media', 'notifications']);
  const isOwnPage = (url) => url.startsWith('app://');
  const session = require('electron').session.defaultSession;
  session.setPermissionRequestHandler((contents, permission, callback) => {
    callback(allowed.has(permission) && isOwnPage(contents.getURL()));
  });
  session.setPermissionCheckHandler((_contents, permission, origin) =>
    allowed.has(permission) && origin.startsWith('app://')
  );

  // Evita que el sistema suspenda la app mientras vigila.
  powerSaveId = powerSaveBlocker.start('prevent-app-suspension');

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
}

app.on('before-quit', () => {
  quitting = true;
  if (powerSaveId != null && powerSaveBlocker.isStarted(powerSaveId)) {
    powerSaveBlocker.stop(powerSaveId);
  }
});

// En Windows y Linux la app sigue viva en la bandeja aunque no haya ventanas.
app.on('window-all-closed', () => {
  if (quitting) app.quit();
});
