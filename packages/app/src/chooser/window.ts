import { BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import type { Locale } from '@perch/core';
import { translate } from '@perch/core';

import type { Choice } from '../main/creature.js';

const CHANNEL_OFFER = 'chooser:offer';
const CHANNEL_PICK = 'chooser:pick';

export interface ChooserDeps {
  /** Relue à l'ouverture : la langue peut avoir changé depuis le démarrage. */
  readonly locale: () => Locale;
  readonly choices: () => Promise<readonly Choice[]>;
  /** Vérification du couple choisi, sans relire une seule image. */
  readonly offers: (packId: string, lineId: string) => boolean;
  readonly onPick: (packId: string, lineId: string) => Promise<void>;
}

/**
 * Ce que le rendu renvoie : un couple d'identifiants, et rien d'autre.
 *
 * Validé par un schéma comme tout ce qui franchit une frontière — le rendu est du code
 * exécuté par un moteur web, ses messages n'ont pas plus de garanties que le contenu d'un
 * fichier. L'existence du couple est vérifiée ensuite, contre la liste réelle.
 */
const PickSchema = z.object({
  packId: z.string().min(1),
  lineId: z.string().min(1),
});

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
  registerChooserIpc();
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
    height: 560,
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

let wired = false;

/**
 * Branche les canaux une seule fois.
 *
 * `ipcMain.handle` lève sur un canal déjà pris : sans ce garde, rouvrir la fenêtre après
 * l'avoir fermée ferait tomber le processus principal.
 */
function registerChooserIpc(): void {
  if (wired) return;
  wired = true;

  ipcMain.handle(CHANNEL_OFFER, async () => {
    if (deps === null) return { title: '', intro: '', empty: '', choices: [] };

    return {
      title: translate(deps.locale(), 'chooser.title'),
      intro: translate(deps.locale(), 'chooser.intro'),
      empty: translate(deps.locale(), 'chooser.empty'),
      choices: await deps.choices(),
    };
  });

  ipcMain.handle(CHANNEL_PICK, async (_event, payload: unknown) => {
    const parsed = PickSchema.safeParse(payload);
    if (deps === null || !parsed.success) return { ok: false };

    const choice = parsed.data;
    if (!deps.offers(choice.packId, choice.lineId)) return { ok: false };

    await deps.onPick(choice.packId, choice.lineId);
    current?.close();
    return { ok: true };
  });
}
