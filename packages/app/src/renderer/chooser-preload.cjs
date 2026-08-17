// Préchargement de la fenêtre de choix. En CommonJS : avec `sandbox: true`, Electron ne
// charge pas de module ESM ici.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('perchChooser', {
  offer: () => ipcRenderer.invoke('chooser:offer'),
  pick: (choix) => ipcRenderer.invoke('chooser:pick', choix),
  search: (recherche) => ipcRenderer.invoke('chooser:search', recherche),
  adopt: (familyId) => ipcRenderer.invoke('chooser:adopt', familyId),
});
