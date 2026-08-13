import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CreaturePack } from '@perch/core';
import { parseCreaturePack } from '@perch/core';

export interface DiscoveredPack {
  readonly pack: CreaturePack;
  readonly directory: string;
}

/**
 * Découvre les packs de créatures disponibles.
 *
 * INVARIANT I9 — aucun identifiant de créature n'est écrit en dur dans le code. Le pack
 * et la lignée de départ sont DÉDUITS de ce qui est installé, pas nommés dans une
 * constante. C'est ce qui permet de remplacer entièrement le pack par défaut sans
 * toucher à une ligne de logique.
 *
 * Un pack illisible ou incohérent est ignoré plutôt que fatal : un fichier abîmé dans un
 * dossier ne doit pas empêcher l'application de démarrer avec les autres.
 */
export async function discoverPacks(packsRoot: string): Promise<DiscoveredPack[]> {
  let entries;
  try {
    entries = await readdir(packsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const found: DiscoveredPack[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const directory = join(packsRoot, entry.name);
    try {
      const raw: unknown = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
      found.push({ pack: parseCreaturePack(raw), directory });
    } catch {
      continue;
    }
  }

  return found.sort((a, b) => a.pack.id.localeCompare(b.pack.id));
}

/** Pack et lignée de départ, déduits du premier pack installé et de sa première lignée. */
export function defaultsFrom(
  packs: readonly DiscoveredPack[]
): { readonly packId: string; readonly lineId: string } | null {
  const first = packs[0];
  if (first === undefined) return null;

  const line = first.pack.lines[0];
  if (line === undefined) return null;

  return { packId: first.pack.id, lineId: line.id };
}
