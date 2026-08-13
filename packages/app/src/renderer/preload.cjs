// Préchargement de l'overlay. En CommonJS : avec `sandbox: true`, Electron ne charge pas
// de module ESM ici.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('perch', {
  onFrame: (callback) => {
    ipcRenderer.on('perch:frame', (_event, payload) => {
      callback(payload);
    });
  },
});
