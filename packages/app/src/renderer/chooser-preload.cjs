// Préchargement de la fenêtre de choix. En CommonJS : avec `sandbox: true`, Electron ne
// charge pas de module ESM ici.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('perchChooser', {
  offer: () => ipcRenderer.invoke('chooser:offer'),
  pick: (choix) => ipcRenderer.invoke('chooser:pick', choix),
});
