import { describe, expect, it } from 'vitest';

import type { SpeciesFamily } from './species.js';
import { loadCatalogue, searchSpecies } from './species.js';

const famille = (id: string, num: number, noms: readonly [string, string][]): SpeciesFamily => ({
  id,
  num,
  stages: noms.map(([fr, en], rang) => ({ id: `${id}-${String(rang)}`, fr, en })),
});

const CATALOGUE: readonly SpeciesFamily[] = [
  famille('charmander', 4, [
    ['Salamèche', 'Charmander'],
    ['Reptincel', 'Charmeleon'],
    ['Dracaufeu', 'Charizard'],
  ]),
  famille('gastly', 92, [
    ['Fantominus', 'Gastly'],
    ['Spectrum', 'Haunter'],
    ['Ectoplasma', 'Gengar'],
  ]),
  famille('magikarp', 129, [
    ['Magicarpe', 'Magikarp'],
    ['Léviator', 'Gyarados'],
  ]),
];

describe('searchSpecies', () => {
  it('ignore les accents et la casse', () => {
    expect(searchSpecies(CATALOGUE, 'salameche').map((f) => f.id)).toEqual(['charmander']);
    expect(searchSpecies(CATALOGUE, 'SALAMÈCHE').map((f) => f.id)).toEqual(['charmander']);
  });

  it('trouve la famille par n’importe lequel de ses stades', () => {
    // Quelqu’un qui veut Ectoplasma cherche la lignée de Fantominus.
    expect(searchSpecies(CATALOGUE, 'ectoplasma').map((f) => f.id)).toEqual(['gastly']);
  });

  it('accepte le nom anglais', () => {
    expect(searchSpecies(CATALOGUE, 'gengar').map((f) => f.id)).toEqual(['gastly']);
  });

  it('place devant ce qui commence par la recherche', () => {
    // « ma » débute Magicarpe, mais n’apparaît qu’au milieu de Salamèche et d’Ectoplasma.
    expect(searchSpecies(CATALOGUE, 'ma').map((f) => f.id)).toEqual([
      'magikarp',
      'charmander',
      'gastly',
    ]);
  });

  it('ne renvoie rien sur une recherche vide', () => {
    expect(searchSpecies(CATALOGUE, '   ')).toEqual([]);
  });

  it('respecte la limite demandée', () => {
    expect(searchSpecies(CATALOGUE, 'e', 2)).toHaveLength(2);
  });
});

describe('loadCatalogue', () => {
  it('lit le catalogue livré et le valide', async () => {
    const catalogue = await loadCatalogue();

    // Le catalogue est un fichier construit : s’il est absent, la recherche ne propose
    // rien et personne ne peut plus choisir sa créature.
    expect(catalogue.length).toBeGreaterThan(400);

    const trouvee = searchSpecies(catalogue, 'fantominus');
    expect(trouvee[0]?.id).toBe('gastly');
    expect(trouvee[0]?.stages.map((stade) => stade.fr)).toEqual([
      'Fantominus',
      'Spectrum',
      'Ectoplasma',
    ]);
  });
});
