import type { DiscoveredPack } from './discover.js';
import { discoverPacksIn } from './discover.js';

/**
 * La liste des packs installés, RELUE à la demande.
 *
 * Le premier jet lisait le disque une fois au démarrage. C'était suffisant tant que les
 * packs arrivaient par une commande lancée avant l'application ; ça ne l'est plus depuis
 * qu'on peut choisir une créature en cours de route — elle atterrit sur le disque, et
 * l'instantané pris au démarrage ne la contient pas. Le compagnon restait alors sur son
 * marqueur de repli jusqu'au redémarrage suivant.
 */
export interface PackRegistry {
  /** Ce qui est installé, à cet instant. */
  readonly all: () => readonly DiscoveredPack[];
  /** Relit les emplacements, et renvoie la nouvelle liste. */
  readonly reload: () => Promise<readonly DiscoveredPack[]>;
}

export async function createPackRegistry(roots: readonly string[]): Promise<PackRegistry> {
  let packs = await discoverPacksIn(roots);

  return {
    all: () => packs,
    reload: async () => {
      packs = await discoverPacksIn(roots);
      return packs;
    },
  };
}
