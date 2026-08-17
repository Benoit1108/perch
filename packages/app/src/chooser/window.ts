import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';

import { translate } from '@perch/core';

import type { ChooserDeps } from './ipc.js';
import { registerChooserIpc } from './ipc.js';

let current: BrowserWindow | null = null;
let deps: ChooserDeps | null = null;

/**
 * Rend le choix possible.
 *
 * Séparé de l'ouverture parce que les deux n'ont pas le même appelant : la créature est
 * montée au démarrage, alors que la fenêtre s'ouvre soit au premier lancement, soit bien
 * plus tard depuis les réglages.
 */
export function configureChooser(next: ChooserDeps): void {
  deps = next;
  registerChooserIpc(
    () => deps,
    () => current?.close()
  );
}

/**
 * Le choix du compagnon.
 *
 * Une fenêtre ORDINAIRE, comme les réglages : l'overlay laisse passer tous les clics, il
 * n'y a rien sur quoi cliquer dedans.
 *
 * Elle n'est jamais bloquante. L'état a déjà une lignée par défaut au moment où elle
 * s'ouvre — fermer la fenêtre sans choisir donne un compagnon plutôt qu'une application
 * qui ne démarre pas. Le premier lancement d'un non-technicien ne doit jamais buter sur
 * une boîte de dialogue.
 */
export function openChooser(): void {
  if (deps === null) return;

  if (current !== null && !current.isDestroyed()) {
    current.focus();
    return;
  }

  current = new BrowserWindow({
    width: 620,
    height: 700,
    title: translate(deps.locale(), 'chooser.title'),
    webPreferences: {
      preload: fileURLToPath(new URL('../renderer/chooser-preload.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  current.on('closed', () => {
    current = null;
  });

  void current.loadFile(fileURLToPath(new URL('../renderer/chooser.html', import.meta.url)));
}
