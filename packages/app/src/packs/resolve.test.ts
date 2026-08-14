import { describe, expect, it } from 'vitest';

import { parseCreaturePack } from '@perch/core';

import type { DiscoveredPack } from './discover.js';
import { resolveCreature } from './resolve.js';

function pack(id: string, lineIds: readonly string[]): DiscoveredPack {
  return {
    directory: `/packs/${id}`,
    pack: parseCreaturePack({
      schemaVersion: 1,
      id,
      name: id,
      license: 'CC0-1.0',
      lines: lineIds.map((lineId) => ({
        id: lineId,
        stages: [
          { id: `${lineId}-1`, name: `${lineId} I`, sprite: 'a.png', fromLevel: 1 },
          { id: `${lineId}-2`, name: `${lineId} II`, sprite: 'b.png', fromLevel: 16 },
        ],
      })),
    }),
  };
}

const packs = [pack('alpha', ['un', 'deux']), pack('beta', ['trois'])];

describe('resolveCreature', () => {
  it('retrouve le stade correspondant au niveau', () => {
    expect(resolveCreature(packs, 'alpha', 'deux', 20)?.stage.id).toBe('deux-2');
    expect(resolveCreature(packs, 'alpha', 'deux', 15)?.stage.id).toBe('deux-1');
  });

  it('donne le dossier du pack, pour y lire les images', () => {
    expect(resolveCreature(packs, 'beta', 'trois', 1)?.directory).toBe('/packs/beta');
  });

  // Un pack est un dossier : l'utilisateur peut le supprimer entre deux lancements. Refuser
  // de démarrer pour cette raison ferait perdre une progression à cause d'un fichier
  // d'images.
  it('se rabat sur le premier pack quand celui demandé a disparu', () => {
    expect(resolveCreature(packs, 'efface', 'un', 1)?.directory).toBe('/packs/alpha');
  });

  it('se rabat sur la première lignée quand celle demandée a disparu', () => {
    expect(resolveCreature(packs, 'alpha', 'inconnue', 1)?.stage.id).toBe('un-1');
  });

  it('ne renvoie rien quand aucun pack n’est installé', () => {
    expect(resolveCreature([], 'alpha', 'un', 1)).toBeNull();
  });
});
