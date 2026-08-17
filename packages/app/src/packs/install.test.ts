import { readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseCreaturePack } from '@perch/core';

import { installSpecies, PACK_PERSONNEL } from './install.js';
import type { SpeciesFamily } from './species.js';

const scratch = (): Promise<string> => mkdtemp(join(tmpdir(), 'perch-install-'));

/**
 * Un GIF minuscule mais VRAI : en-tête, table de couleurs, terminateur.
 *
 * Il contient des octets au-delà de 0x7F — c'est tout l'intérêt. Un fichier écrit en
 * texte les réécrirait, et le sprite arriverait illisible chez l'utilisateur.
 */
const GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0xff, 0x00, 0xc0, 0xde, 0xff,
  0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

const GASTLY: SpeciesFamily = {
  id: 'gastly',
  num: 92,
  stages: [
    { id: 'gastly', fr: 'Fantominus', en: 'Gastly' },
    { id: 'haunter', fr: 'Spectrum', en: 'Haunter' },
    { id: 'gengar', fr: 'Ectoplasma', en: 'Gengar' },
  ],
};

const MAGIKARP: SpeciesFamily = {
  id: 'magikarp',
  num: 129,
  stages: [
    { id: 'magikarp', fr: 'Magicarpe', en: 'Magikarp' },
    { id: 'gyarados', fr: 'Léviator', en: 'Gyarados' },
  ],
};

function servir(octets: Uint8Array = GIF): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(octets, { status: 200 })))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function manifeste(root: string): Promise<unknown> {
  return JSON.parse(await readFile(join(root, PACK_PERSONNEL, 'manifest.json'), 'utf8'));
}

describe('installSpecies', () => {
  it('écrit un manifeste conforme, avec les paliers d’évolution', async () => {
    servir();
    const root = await scratch();

    const { packId, lineId } = await installSpecies(root, GASTLY, 'Mes créatures');
    const pack = parseCreaturePack(await manifeste(root));

    expect({ packId, lineId }).toEqual({ packId: PACK_PERSONNEL, lineId: 'gastly' });

    const ligne = pack.lines[0];
    expect(ligne?.stages.map((stade) => [stade.name, stade.fromLevel])).toEqual([
      ['Fantominus', 1],
      ['Spectrum', 16],
      ['Ectoplasma', 36],
    ]);
    // L'espèce est le vocabulaire d'échange : sans elle, la boîte d'échange ne sait pas
    // nommer la créature à l'autre application.
    expect(ligne?.stages.map((stade) => stade.species)).toEqual(['gastly', 'haunter', 'gengar']);
  });

  it('télécharge les images sans les abîmer', async () => {
    servir();
    const root = await scratch();

    await installSpecies(root, GASTLY, 'Mes créatures');

    const ecrit = await readFile(join(root, PACK_PERSONNEL, 'sprites', 'gengar.gif'));
    expect(new Uint8Array(ecrit)).toEqual(GIF);
  });

  it('accumule les lignées au lieu de remplacer le pack', async () => {
    servir();
    const root = await scratch();

    await installSpecies(root, GASTLY, 'Mes créatures');
    await installSpecies(root, MAGIKARP, 'Mes créatures');
    const pack = parseCreaturePack(await manifeste(root));

    expect(pack.lines.map((ligne) => ligne.id)).toEqual(['gastly', 'magikarp']);
  });

  it('réinstalle une lignée déjà présente sans la dupliquer', async () => {
    servir();
    const root = await scratch();

    await installSpecies(root, GASTLY, 'Mes créatures');
    await installSpecies(root, GASTLY, 'Mes créatures');
    const pack = parseCreaturePack(await manifeste(root));

    expect(pack.lines).toHaveLength(1);
  });

  it('repart d’un manifeste abîmé plutôt que d’échouer', async () => {
    servir();
    const root = await scratch();

    await installSpecies(root, GASTLY, 'Mes créatures');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(root, PACK_PERSONNEL, 'manifest.json'), '{ pas du json', 'utf8');

    await installSpecies(root, MAGIKARP, 'Mes créatures');
    const pack = parseCreaturePack(await manifeste(root));

    expect(pack.lines.map((ligne) => ligne.id)).toEqual(['magikarp']);
  });

  it('échoue clairement si une image manque', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 404 })))
    );
    const root = await scratch();

    await expect(installSpecies(root, GASTLY, 'Mes créatures')).rejects.toThrow(/indisponible/u);
  });
});
