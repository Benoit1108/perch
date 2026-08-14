import { app } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Defaults } from '../main/bootstrap.js';

import type { DiscoveredPack } from './discover.js';
import { defaultsFrom, discoverPacksIn } from './discover.js';

/**
 * Packs installés, avec le pack et la lignée de départ qu'on en déduit (invariant I9).
 *
 * Aucun pack n'est un cas NORMAL, pas une panne : le dépôt n'en contient aucun
 * (invariant I5) et `npm run pack:fetch` les fabrique. On démarre alors avec un compagnon
 * sans nom plutôt que de refuser de se lancer — un non-technicien ne doit pas se heurter
 * à un code de sortie parce qu'il manque des images.
 */
export async function loadPacks(): Promise<{
  packs: readonly DiscoveredPack[];
  defaults: Defaults;
}> {
  // Trois emplacements, dans cet ordre de priorité :
  //
  //   1. le dossier de l'utilisateur, seul inscriptible après installation — c'est là
  //      qu'atterrissent les packs téléchargés ou déposés à la main (invariant I5) ;
  //   2. les ressources livrées avec l'application, que la construction y a placées ;
  //   3. le dépôt, en développement seulement.
  //
  // Le troisième chemin ne veut plus rien dire une fois empaqueté : il pointait dans le
  // point de montage de l'AppImage, et le compagnon démarrait sans visage alors que ses
  // images étaient bien livrées, deux dossiers plus loin.
  const roots = [
    join(app.getPath('userData'), 'packs'),
    join(process.resourcesPath, 'packs'),
    fileURLToPath(new URL('../../../../packs', import.meta.url)),
  ];

  const packs = await discoverPacksIn(roots);
  const defaults = defaultsFrom(packs);

  if (defaults === null) {
    console.warn(
      `[perch] aucun pack de creatures dans ${roots.join(' ni ')} — lancer « npm run pack:fetch ».`
    );
    return { packs, defaults: { packId: '', lineId: '' } };
  }
  return { packs, defaults };
}
