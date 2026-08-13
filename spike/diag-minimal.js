// Reproduction minimale : fenêtre Electron la plus ordinaire possible.
// Aucune transparence, aucun always-on-top, aucun clic traversant, aucun capteur.
//
//   ./node_modules/.bin/electron diag-minimal.js
//
// Si CETTE fenêtre ne s'affiche pas, le problème est environnemental et n'a rien
// à voir avec la conception de l'overlay.

const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 520,
    height: 360,
    backgroundColor: '#cc3344',
  });

  win.loadURL(
    'data:text/html,' +
      encodeURIComponent(
        '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#cc3344">' +
          '<h1 style="font:700 42px system-ui;color:#fff">PERCH DIAG</h1></body>'
      )
  );

  win.webContents.on('did-finish-load', () => {
    console.log(`[diag] charge — visible=${win.isVisible()} bounds=`, win.getBounds());
  });
});

app.on('window-all-closed', () => app.quit());
