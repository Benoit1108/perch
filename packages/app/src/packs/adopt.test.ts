import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAdoption } from './adopt.js';
import { createPackRegistry } from './registry.js';
import type { SpeciesFamily } from './species.js';

const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0xff, 0x3b]);

const CATALOGUE: readonly SpeciesFamily[] = [
  {
    id: 'gastly',
    num: 92,
    stages: [
      { id: 'gastly', fr: 'Fantominus', en: 'Gastly' },
      { id: 'haunter', fr: 'Spectrum', en: 'Haunter' },
      { id: 'gengar', fr: 'Ectoplasma', en: 'Gengar' },
    ],
  },
];

async function monter(): Promise<{
  adoption: ReturnType<typeof createAdoption>;
  registre: Awaited<ReturnType<typeof createPackRegistry>>;
  root: string;
  lectures: () => number;
}> {
  const root = await mkdtemp(join(tmpdir(), 'perch-adopt-'));
  const registre = await createPackRegistry([root]);
  let lectures = 0;

  const adoption = createAdoption({
    registry: registre,
    root: () => root,
    catalogue: () => {
      lectures += 1;
      return Promise.resolve(CATALOGUE);
    },
    packName: () => 'Mes créatures',
  });

  return { adoption, registre, root, lectures: () => lectures };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function servir(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(GIF, { status: 200 })))
  );
}

describe('createAdoption', () => {
  it('propose la lignée entière, nommée par son premier stade', async () => {
    const { adoption } = await monter();

    // La recherche porte sur la forme finale, la proposition parle du premier stade : on
    // reçoit un Fantominus, pas un Ectoplasma.
    expect(await adoption.search('ectoplasma')).toEqual([
      {
        familyId: 'gastly',
        name: 'Fantominus',
        line: ['Fantominus', 'Spectrum', 'Ectoplasma'],
      },
    ]);
  });

  it('ne lit le catalogue qu’une fois', async () => {
    const { adoption, lectures } = await monter();

    await adoption.search('fantominus');
    await adoption.search('magicarpe');

    expect(lectures()).toBe(1);
  });

  it('installe la lignée et la rend visible au compagnon', async () => {
    servir();
    const { adoption, registre, root } = await monter();

    const adoptee = await adoption.adopt('gastly');

    expect(adoptee).toEqual({ packId: 'perso', lineId: 'gastly' });
    // Relu AVANT de rendre la main : le compagnon doit pouvoir s'afficher tout de suite.
    expect(registre.all().map((entry) => entry.pack.id)).toEqual(['perso']);
    expect((await readdir(join(root, 'perso', 'sprites'))).sort()).toEqual([
      'gastly.gif',
      'gengar.gif',
      'haunter.gif',
    ]);
  });

  it('refuse une famille inconnue sans rien télécharger', async () => {
    const appels = vi.fn();
    vi.stubGlobal('fetch', appels);
    const { adoption } = await monter();

    expect(await adoption.adopt('pas-une-creature')).toBeNull();
    expect(appels).not.toHaveBeenCalled();
  });
});
