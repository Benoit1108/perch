const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('perch', {
  ready: () => ipcRenderer.send('perch:ready'),
  onFrame: (callback) => {
    ipcRenderer.on('perch:frame', (_event, payload) => callback(payload));
  },
});
