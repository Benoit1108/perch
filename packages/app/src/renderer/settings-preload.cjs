// Préchargement de la fenêtre de réglages. CommonJS : avec `sandbox: true`, Electron ne
// charge pas de module ESM ici.
//
// Seuls des canaux NOMMÉS sont exposés — jamais `ipcRenderer` complet, qui donnerait au
// contenu web la capacité de parler à n'importe quel canal du process principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('perchSettings', {
  read: () => ipcRenderer.invoke('settings:read'),
  write: (config) => ipcRenderer.invoke('settings:write', config),
  texts: () => ipcRenderer.invoke('settings:texts'),
  chooseCompanion: () => ipcRenderer.invoke('settings:companion'),
});
