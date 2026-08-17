import { ipcMain } from 'electron';
import { z } from 'zod';

import type { Locale } from '@perch/core';
import { translate } from '@perch/core';

import type { Choice } from '../main/creature.js';
import type { Suggestion } from '../packs/adopt.js';

const CHANNEL_OFFER = 'chooser:offer';
const CHANNEL_PICK = 'chooser:pick';
const CHANNEL_SEARCH = 'chooser:search';
const CHANNEL_ADOPT = 'chooser:adopt';

export interface ChooserDeps {
  /** Relue à l'ouverture : la langue peut avoir changé depuis le démarrage. */
  readonly locale: () => Locale;
  readonly choices: () => Promise<readonly Choice[]>;
  /** Vérification du couple choisi, sans relire une seule image. */
  readonly offers: (packId: string, lineId: string) => boolean;
  readonly onPick: (packId: string, lineId: string) => Promise<void>;
  /** Créatures du catalogue qui portent ce nom. */
  readonly search: (query: string) => Promise<readonly Suggestion[]>;
  /** Télécharge une lignée et l'adopte. Faux si elle est inconnue ou inaccessible. */
  readonly onAdopt: (familyId: string) => Promise<boolean>;
}

/**
 * Ce que le rendu renvoie.
 *
 * Validé par un schéma comme tout ce qui franchit une frontière — le rendu est du code
 * exécuté par un moteur web, ses messages n'ont pas plus de garanties que le contenu d'un
 * fichier. L'existence du couple est vérifiée ensuite, contre la liste réelle.
 */
const PickSchema = z.object({
  packId: z.string().min(1),
  lineId: z.string().min(1),
});

/** Une recherche est bornée : ce qui arrive ici sert à filtrer un millier d'entrées. */
const QuerySchema = z.string().max(60);
const FamilySchema = z.string().min(1).max(60);

/** Les textes de la fenêtre, traduits en un seul aller-retour. */
function labels(locale: Locale): Record<string, string> {
  const cles = [
    'title',
    'intro',
    'empty',
    'installed',
    'searchHint',
    'searchPlaceholder',
    'searchNone',
    'searchBusy',
    'searchFailed',
  ] as const;

  const textes: Record<string, string> = {};
  for (const cle of cles) textes[cle] = translate(locale, `chooser.${cle}`);
  return textes;
}

let wired = false;

/**
 * Branche les canaux une seule fois.
 *
 * `ipcMain.handle` lève sur un canal déjà pris : sans ce garde, rouvrir la fenêtre après
 * l'avoir fermée ferait tomber le processus principal.
 */
export function registerChooserIpc(deps: () => ChooserDeps | null, close: () => void): void {
  if (wired) return;
  wired = true;

  ipcMain.handle(CHANNEL_OFFER, async () => {
    const active = deps();
    if (active === null) return { labels: {}, choices: [] };

    return { labels: labels(active.locale()), choices: await active.choices() };
  });

  ipcMain.handle(CHANNEL_PICK, async (_event, payload: unknown) => {
    const active = deps();
    const parsed = PickSchema.safeParse(payload);
    if (active === null || !parsed.success) return { ok: false };

    const choice = parsed.data;
    if (!active.offers(choice.packId, choice.lineId)) return { ok: false };

    await active.onPick(choice.packId, choice.lineId);
    close();
    return { ok: true };
  });

  ipcMain.handle(CHANNEL_SEARCH, async (_event, payload: unknown) => {
    const active = deps();
    const parsed = QuerySchema.safeParse(payload);
    if (active === null || !parsed.success) return [];

    return active.search(parsed.data);
  });

  ipcMain.handle(CHANNEL_ADOPT, async (_event, payload: unknown) => {
    const active = deps();
    const parsed = FamilySchema.safeParse(payload);
    if (active === null || !parsed.success) return { ok: false };

    // Le téléchargement peut échouer — réseau coupé, source indisponible. C'est un cas
    // NORMAL : le rendu le dit, et la fenêtre reste ouverte pour réessayer.
    try {
      const ok = await active.onAdopt(parsed.data);
      if (ok) close();
      return { ok };
    } catch {
      return { ok: false };
    }
  });
}
