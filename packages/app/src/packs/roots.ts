import { app } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Defaults } from '../main/bootstrap.js';

import { defaultsFrom } from './discover.js';
import type { PackRegistry } from './registry.js';
import { createPackRegistry } from './registry.js';

/**
 * Le dossier des packs de l'utilisateur.
 *
 * Seul emplacement inscriptible une fois l'application installée : c'est là qu'atterrit
 * une créature choisie, et là qu'on dépose un pack fabriqué à la main.
 */
export function userPacksRoot(): string {
  return join(app.getPath('userData'), 'packs');
}

/**
 * Où chercher des packs, par ordre de priorité.
 *
 * Le troisième chemin ne veut plus rien dire une fois empaqueté : il pointait dans le
 * point de montage de l'AppImage, et le compagnon démarrait sans visage alors que ses
 * images étaient bien livrées, deux dossiers plus loin.
 */
function packRoots(): readonly string[] {
  return [
    userPacksRoot(),
    join(process.resourcesPath, 'packs'),
    // Le dépôt, en développement seulement.
    fileURLToPath(new URL('../../../../packs', import.meta.url)),
  ];
}

/**
 * Packs installés, avec le pack et la lignée de départ qu'on en déduit (invariant I9).
 *
 * Aucun pack n'est un cas NORMAL, pas une panne : le dépôt n'en contient aucun
 * (invariant I5) et `npm run pack:fetch` les fabrique. On démarre alors avec un compagnon
 * sans nom plutôt que de refuser de se lancer — un non-technicien ne doit pas se heurter
 * à un code de sortie parce qu'il manque des images.
 */
export async function loadPacks(): Promise<{
  registry: PackRegistry;
  defaults: Defaults;
}> {
  const roots = packRoots();
  const registry = await createPackRegistry(roots);
  const defaults = defaultsFrom(registry.all());

  if (defaults === null) {
    console.warn(
      `[perch] aucun pack de creatures dans ${roots.join(' ni ')} — lancer « npm run pack:fetch ».`
    );
    return { registry, defaults: { packId: '', lineId: '' } };
  }
  return { registry, defaults };
}
