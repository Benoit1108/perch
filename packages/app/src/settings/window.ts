import { BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';

import { ConfigSchema, readConfig, writeConfig } from '../config/repos.js';

const CHANNEL_READ = 'settings:read';
const CHANNEL_WRITE = 'settings:write';

let current: BrowserWindow | null = null;

/**
 * Fenêtre de réglages : une fenêtre ORDINAIRE.
 *
 * Rien à voir avec l'overlay — elle a une bordure, prend le focus, apparaît dans la barre
 * des tâches. C'est le seul endroit où l'utilisateur peut cliquer, puisque le compagnon
 * lui-même laisse passer les clics.
 */
export function openSettings(): void {
  if (current !== null && !current.isDestroyed()) {
    current.focus();
    return;
  }

  current = new BrowserWindow({
    width: 560,
    height: 640,
    title: 'Perch',
    webPreferences: {
      preload: fileURLToPath(new URL('../renderer/settings-preload.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  current.on('closed', () => {
    current = null;
  });

  void current.loadFile(fileURLToPath(new URL('../renderer/settings.html', import.meta.url)));
}

/**
 * Branche les canaux IPC.
 *
 * L'écriture est validée par le MÊME schéma zod que la lecture du fichier : le renderer
 * est du code qui s'exécute dans un moteur web, et ce qui en vient n'a pas plus de
 * garanties que ce qui vient du disque.
 */
export function registerSettingsIpc(onChange: () => void): void {
  ipcMain.handle(CHANNEL_READ, async () => readConfig());

  ipcMain.handle(CHANNEL_WRITE, async (_event, payload: unknown) => {
    const parsed = ConfigSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, error: 'configuration invalide' };
    }

    await writeConfig(parsed.data);
    onChange();
    return { ok: true };
  });
}
