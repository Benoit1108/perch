// Perch — spike S0. Code jetable : aucune architecture, aucun test, aucune qualité.
// C'est le seul sprint où c'est vrai (voir ../ROADMAP.md).
//
// Stratégie de fenêtre : au lieu de déplacer une petite fenêtre à chaque frame — ce que
// Wayland interdit et ce qui saccade même sous X11 — on pose UNE grande fenêtre
// transparente couvrant l'union de tous les écrans, et on déplace le sprite à l'intérieur
// en CSS. C'est aussi le bon design à long terme.

const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('node:path');
const { createSensors } = require('./sensors');

// Wayland ne permet ni de positionner une fenêtre, ni de la garder au-dessus des autres,
// ni de lire le curseur global. Sous XWayland, les trois fonctionnent.
//
// CONSTAT S0, LE PLUS COÛTEUX DU SPRINT : `app.commandLine.appendSwitch('ozone-platform',
// 'x11')` NE FONCTIONNE PAS. Electron choisit sa plateforme d'affichage avant d'exécuter
// ce script. L'appel ne lève aucune erreur, `--ozone-platform` n'est simplement jamais
// propagé aux process enfants, et l'application tourne en client Wayland natif — où
// setBounds et setAlwaysOnTop sont ignorés silencieusement. La fenêtre existe, GNOME la
// liste, `isVisible()` renvoie true, et rien ne s'affiche.
//
// Le drapeau doit être passé en LIGNE DE COMMANDE (voir package.json) ou via la variable
// d'environnement ELECTRON_OZONE_PLATFORM_HINT.
if (!process.argv.some((a) => a.startsWith('--ozone-platform'))) {
  console.log(
    '[perch] ATTENTION : --ozone-platform absent de la ligne de commande.\n' +
      '        Lancer via `npm run start:debug`, sinon la fenetre ne s affichera pas.'
  );
}

// CONSTAT S0 : lancé avec --no-sandbox, le process GPU segfault en boucle
// (exit_code=139) ; Chromium se rabat alors sur le présentateur logiciel X11, qui échoue
// à son tour (« XGetWindowAttributes failed for window 1 »). La fenêtre est créée et
// enregistrée auprès de GNOME, mais jamais peinte.
//
// Le correctif est de RÉPARER le bac à sable (./fix-sandbox.sh) plutôt que de le
// désactiver. Le rendu logiciel reste accessible pour diagnostic via PERCH_SOFTWARE=1,
// mais ce n'est pas un chemin viable ici.
if (process.env.PERCH_SOFTWARE === '1') {
  app.disableHardwareAcceleration();
}
app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder');

const DEBUG = process.env.PERCH_DEBUG === '1';
// Diagnostic : fenêtre opaque et bordée, pour distinguer « la fenêtre ne s'affiche pas »
// de « la fenêtre s'affiche mais son contenu est invisible ».
const OPAQUE = process.env.PERCH_OPAQUE === '1';
const FRAME_MS = 16;

let overlay = null;
let sensors = null;
let timer = null;
let geometryTick = 0;
let cachedWindows = [];
let cachedMonitors = [];
let bounds = null;

/** Union des écrans. Ce n'est PAS forcément la surface utilisable : voir les zones vides. */
function desktopBounds() {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const display of screen.getAllDisplays()) {
    const b = display.bounds;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Recalcule l'union des écrans et redimensionne l'overlay si elle a bougé.
 *
 * CONSTAT S0 : sous XWayland, `screen.getAllDisplays()` n'est PAS fiable au moment
 * de `app.whenReady()`. Selon le lancement, Electron ne connaît qu'un seul écran et
 * émet `display-added` pour les autres ensuite. Une seule lecture au démarrage donne
 * donc un overlay qui ne couvre qu'un tiers du bureau, de façon non déterministe.
 */
function syncBounds(reason) {
  const next = desktopBounds();
  const targetChanged =
    bounds === null ||
    bounds.x !== next.x ||
    bounds.y !== next.y ||
    bounds.width !== next.width ||
    bounds.height !== next.height;

  bounds = next;

  if (overlay === null || overlay.isDestroyed()) return;

  // CONSTAT S0 : Mutter ÉCRÊTE la taille demandée à la création — 3840x2160 devient
  // 1919x1079, soit un seul écran — mais accepte un `setBounds` ultérieur, une fois la
  // fenêtre affichée. On compare donc la géométrie réelle à la géométrie visée et on
  // ré-applique tant qu'elles diffèrent.
  const actual = overlay.getBounds();
  const clamped =
    actual.x !== next.x ||
    actual.y !== next.y ||
    actual.width !== next.width ||
    actual.height !== next.height;

  if (!targetChanged && !clamped) return;

  overlay.setBounds(next);
  const after = overlay.getBounds();
  console.log(
    `[perch] surface visee ${next.width}x${next.height}@${next.x},${next.y} — ` +
      `obtenue ${after.width}x${after.height}@${after.x},${after.y} (${reason})`
  );

  // Un redimensionnement recrée la région d'entrée X11 : sans ça, l'overlay
  // redevient opaque aux clics juste après avoir été agrandi.
  applyClickThrough(`apres setBounds/${reason}`);
}

/**
 * Rend les clics traversants. À RÉ-APPLIQUER après chaque changement de géométrie :
 * la région d'entrée est attachée à la fenêtre X et un resize la réinitialise.
 */
function applyClickThrough(reason) {
  if (OPAQUE || overlay === null || overlay.isDestroyed()) return;
  overlay.setIgnoreMouseEvents(true);
  console.log(`[perch] clics traversants appliques (${reason})`);
}

function createOverlay() {
  syncBounds('demarrage');

  overlay = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: !OPAQUE,
    frame: OPAQUE,
    backgroundColor: OPAQUE ? '#3b2f5e' : undefined,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: OPAQUE,
    resizable: false,
    movable: false,
    fullscreenable: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Les clics doivent traverser l'overlay.
  //
  // CONSTAT S0 : régression Electron ≥ 43.2.0 sur Linux/X11 (electron#52456) —
  // `setIgnoreMouseEvents` ne réduit plus la région d'entrée X11, la fenêtre conserve une
  // zone de saisie pleine et AVALE TOUS LES CLICS du bureau. Electron 42.7.0 est la
  // dernière version fonctionnelle ; le paquet y est épinglé.
  //
  // `forward` est documenté comme macOS/Windows uniquement : inutile ici.
  if (!OPAQUE) overlay.setIgnoreMouseEvents(true);
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Instrumentation : sans ça, un échec côté renderer est totalement muet.
  const wc = overlay.webContents;
  wc.on('console-message', (...args) => {
    const first = args[0];
    const message =
      first !== null && typeof first === 'object' && 'message' in first
        ? first.message
        : args[2];
    console.log(`[renderer] ${message}`);
  });
  wc.on('preload-error', (_e, preloadPath, error) => {
    console.log(`[perch] ERREUR preload ${preloadPath} : ${error.message}`);
  });
  wc.on('did-fail-load', (_e, code, desc) => {
    console.log(`[perch] echec de chargement : ${code} ${desc}`);
  });
  wc.on('render-process-gone', (_e, details) => {
    console.log(`[perch] renderer mort : ${details.reason}`);
  });
  wc.on('did-finish-load', () => {
    console.log(
      `[perch] renderer charge — visible=${overlay.isVisible()} opaque=${OPAQUE}`
    );
    // La fenêtre est mappée : c'est maintenant que Mutter accepte la vraie taille,
    // et c'est seulement après le redimensionnement que la région d'entrée tient.
    setTimeout(() => {
      syncBounds('apres affichage');
      applyClickThrough('apres affichage');
    }, 300);
    setTimeout(() => applyClickThrough('confirmation'), 1200);
  });

  overlay.loadFile(path.join(__dirname, 'renderer.html'));
}

async function startLoop() {
  sensors = await createSensors(screen);

  timer = setInterval(async () => {
    if (overlay === null || overlay.isDestroyed()) return;

    let pointer;
    try {
      pointer = await sensors.pointer();
    } catch {
      return;
    }

    // La géométrie change bien plus lentement que le curseur : 4 fois par seconde suffit.
    geometryTick += 1;
    if (geometryTick % 15 === 0) {
      try {
        cachedWindows = await sensors.windows();
        cachedMonitors = await sensors.monitors();
      } catch {
        /* on garde le cache précédent */
      }
    }

    overlay.webContents.send('perch:frame', {
      pointer,
      origin: { x: bounds.x, y: bounds.y },
      windows: cachedWindows,
      monitors: cachedMonitors,
      backend: sensors.name,
      seesWindows: sensors.seesWindows,
      debug: DEBUG,
    });
  }, FRAME_MS);
}

/**
 * GARDE-FOUS. Un overlay plein écran qui capte les clics rend la machine inutilisable :
 * plus de souris, et aucun moyen de fermer l'application puisqu'elle n'a ni bordure ni
 * barre des tâches. C'est arrivé pendant S0 — il a fallu tuer le process depuis une autre
 * machine. Trois sorties de secours, indépendantes les unes des autres.
 */
function installEscapeHatches() {
  // 1. Raccourci global.
  const quitShortcut = 'Control+Alt+P';
  if (globalShortcut.register(quitShortcut, () => app.quit())) {
    console.log(`[perch] sortie de secours : ${quitShortcut}`);
  } else {
    console.log(`[perch] ATTENTION : ${quitShortcut} n a pas pu etre enregistre`);
  }

  // 2. Arrêt automatique. En spike, on ne laisse jamais tourner indéfiniment.
  const seconds = Number(process.env.PERCH_TIMEOUT ?? '600');
  if (Number.isFinite(seconds) && seconds > 0) {
    console.log(`[perch] arret automatique dans ${seconds}s (PERCH_TIMEOUT=0 pour desactiver)`);
    setTimeout(() => {
      console.log('[perch] arret automatique');
      app.quit();
    }, seconds * 1000);
  }

  // 3. Le PID, pour pouvoir tuer le process depuis un terminal.
  console.log(`[perch] pid=${process.pid} — en cas de blocage : kill ${process.pid}`);
}

app.whenReady().then(async () => {
  installEscapeHatches();
  createOverlay();

  // Le renderer prévient quand il est prêt : inutile de lui envoyer des frames avant.
  ipcMain.once('perch:ready', () => startLoop());

  // Filet de sécurité si le renderer ne signale rien.
  setTimeout(() => {
    if (timer === null) startLoop();
  }, 2000);

  for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) {
    screen.on(event, () => syncBounds(event));
  }

  // Certains écrans apparaissent sans émettre d'événement exploitable au démarrage.
  // On resynchronise pendant les 10 premières secondes, puis on s'en remet aux événements.
  const settle = setInterval(() => syncBounds('stabilisation'), 1000);
  setTimeout(() => clearInterval(settle), 10000);
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  if (timer !== null) clearInterval(timer);
});
