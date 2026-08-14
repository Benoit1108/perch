import { BrowserWindow, app, ipcMain } from 'electron';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';

import { MESSAGE_KEYS, resolveLocale, translate } from '@perch/core';

import { ConfigSchema, readConfig, writeConfig } from '../config/repos.js';

const CHANNEL_READ = 'settings:read';
const CHANNEL_WRITE = 'settings:write';
const CHANNEL_TEXTS = 'settings:texts';
const CHANNEL_COMPANION = 'settings:companion';
const CHANNEL_BOX = 'settings:box';
const CHANNEL_DEPOSIT = 'settings:deposit';
const CHANNEL_WITHDRAW = 'settings:withdraw';

const PREFIXE = 'settings.';

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
 * Libellés de la fenêtre, tirés du catalogue (invariant I8).
 *
 * Les clés sont RECENSÉES plutôt qu'énumérées à la main : une chaîne ajoutée au catalogue
 * arrive d'elle-même dans la fenêtre, et une liste tenue en double ne peut pas prendre du
 * retard sur l'autre.
 *
 * La langue est relue à chaque appel : elle peut changer depuis cette fenêtre même, et
 * une capture au démarrage laisserait l'ancienne langue affichée.
 */
async function texts(): Promise<Record<string, string>> {
  const config = await readConfig();
  const locale = resolveLocale(config.locale ?? app.getLocale());
  const out: Record<string, string> = {};

  for (const key of MESSAGE_KEYS) {
    if (key.startsWith(PREFIXE)) out[key.slice(PREFIXE.length)] = translate(locale, key);
  }
  return out;
}

/** Ce dont la fenêtre de réglages a besoin du reste de l'application. */
export interface SettingsDeps {
  readonly onChange: () => void;
  /** Ouvre la fenêtre de choix du compagnon. */
  readonly onCompanion: () => void;
  readonly box: {
    list(): Promise<unknown>;
    deposit(): Promise<unknown>;
    withdraw(id: string): Promise<unknown>;
  };
}

/** Identifiant d'enveloppe tel que le rendu le renvoie. Revérifié, comme tout le reste. */
const IdSchema = z.string().min(1).max(64);

/**
 * Branche les canaux IPC.
 *
 * L'écriture est validée par le MÊME schéma zod que la lecture du fichier : le renderer
 * est du code qui s'exécute dans un moteur web, et ce qui en vient n'a pas plus de
 * garanties que ce qui vient du disque.
 */
export function registerSettingsIpc(deps: SettingsDeps): void {
  ipcMain.handle(CHANNEL_READ, async () => readConfig());
  ipcMain.handle(CHANNEL_TEXTS, async () => texts());

  // Sans ce canal, le compagnon ne se choisirait qu'une seule fois dans une vie : la
  // fenêtre de choix ne s'ouvre qu'au tout premier lancement, et rien ne permettrait d'y
  // revenir ensuite.
  ipcMain.handle(CHANNEL_COMPANION, () => {
    deps.onCompanion();
  });

  ipcMain.handle(CHANNEL_BOX, async () => deps.box.list());
  ipcMain.handle(CHANNEL_DEPOSIT, async () => deps.box.deposit());

  ipcMain.handle(CHANNEL_WITHDRAW, async (_event, payload: unknown) => {
    const parsed = IdSchema.safeParse(payload);
    return parsed.success ? deps.box.withdraw(parsed.data) : { kind: 'partie' };
  });

  ipcMain.handle(CHANNEL_WRITE, async (_event, payload: unknown) => {
    const parsed = ConfigSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, error: 'configuration invalide' };
    }

    await writeConfig(parsed.data);
    deps.onChange();
    return { ok: true };
  });
}
