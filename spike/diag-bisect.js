// Bissection : quelle option de BrowserWindow fait tomber le process GPU ?
// Chaque option est pilotée par une variable d'environnement, pour tester les
// combinaisons une par une sans toucher au code.
//
//   T=1              transparent
//   F=0              sans bordure
//   A=1              always-on-top
//   FOC=0            non focusable
//   SK=1             absent de la barre des tâches
//   EL=1             enableLargerThanScreen
//   W= H= X= Y=      géométrie
//   IGN=1            setIgnoreMouseEvents
//   VIS=1            setVisibleOnAllWorkspaces

const { app, BrowserWindow } = require('electron');

const flag = (name, fallback = false) =>
  process.env[name] === undefined ? fallback : process.env[name] === '1';
const num = (name, fallback) =>
  process.env[name] === undefined ? fallback : Number(process.env[name]);

app.whenReady().then(() => {
  const transparent = flag('T');

  const win = new BrowserWindow({
    x: num('X', 200),
    y: num('Y', 200),
    width: num('W', 520),
    height: num('H', 360),
    transparent,
    frame: process.env.F !== '0',
    alwaysOnTop: flag('A'),
    focusable: process.env.FOC !== '0',
    skipTaskbar: flag('SK'),
    enableLargerThanScreen: flag('EL'),
    hasShadow: false,
    backgroundColor: transparent ? undefined : '#cc3344',
  });

  if (flag('IGN')) win.setIgnoreMouseEvents(true, { forward: true });
  if (flag('VIS')) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadURL(
    'data:text/html,' +
      encodeURIComponent(
        '<body style="margin:0;display:grid;place-items:center;height:100vh;background:rgba(204,51,68,.85)">' +
          '<h1 style="font:700 42px system-ui;color:#fff">PERCH DIAG</h1></body>'
      )
  );

  win.webContents.on('did-finish-load', () => {
    const b = win.getBounds();
    console.log(
      `[diag] visible=${win.isVisible()} demande=${num('W', 520)}x${num('H', 360)} ` +
        `obtenu=${b.width}x${b.height}@${b.x},${b.y}`
    );
  });

  // Les gestionnaires de fenêtres contraignent souvent la taille INITIALE tout en
  // acceptant un redimensionnement ultérieur. On retente après affichage.
  if (flag('RESIZE')) {
    setTimeout(() => {
      win.setBounds({ x: num('X', 0), y: num('Y', 0), width: num('W', 520), height: num('H', 360) });
      const b = win.getBounds();
      console.log(`[diag] apres setBounds tardif : ${b.width}x${b.height}@${b.x},${b.y}`);
    }, 2000);
  }

  // Capture de ce que le RENDERER peint réellement. Sépare « rien n'est peint »
  // de « c'est peint mais le compositeur ne l'affiche pas ».
  if (flag('CAP')) {
    setTimeout(() => {
      win.webContents
        .capturePage()
        .then((image) => {
          const target = process.env.CAP_PATH ?? '/tmp/perch-capture.png';
          require('node:fs').writeFileSync(target, image.toPNG());
          const size = image.getSize();
          console.log(`[diag] capture ${size.width}x${size.height} -> ${target}`);
        })
        .catch((err) => console.log(`[diag] capture impossible : ${err.message}`));
    }, 3000);
  }
});

app.on('window-all-closed', () => app.quit());
