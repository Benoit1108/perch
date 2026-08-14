// Préchargement de l'overlay. En CommonJS : avec `sandbox: true`, Electron ne charge pas
// de module ESM ici.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('perch', {
  onFrame: (callback) => {
    ipcRenderer.on('perch:frame', (_event, payload) => {
      callback(payload);
    });
  },
  // L'apparence arrive par ÉVÉNEMENT — démarrage, choix, évolution — et jamais dans la
  // boucle d'animation : les images pèsent quelques dizaines de kilo-octets, et les
  // envoyer soixante fois par seconde saturerait le canal pour rien.
  onCreature: (callback) => {
    ipcRenderer.on('perch:creature', (_event, payload) => {
      callback(payload);
    });
  },
});
