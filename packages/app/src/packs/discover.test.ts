import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { defaultsFrom, discoverPacks } from './discover.js';

const scratch = (): Promise<string> => mkdtemp(join(tmpdir(), 'perch-packs-'));

function manifest(id: string, lineIds: readonly string[]): string {
  return JSON.stringify({
    schemaVersion: 1,
    id,
    name: id,
    license: 'CC0-1.0',
    lines: lineIds.map((lineId) => ({
      id: lineId,
      stages: [{ id: `${lineId}-1`, name: lineId, sprite: 'a.png', fromLevel: 1 }],
    })),
  });
}

async function writePack(root: string, id: string, lineIds: readonly string[]): Promise<void> {
  const dir = join(root, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'manifest.json'), manifest(id, lineIds), 'utf8');
}

describe('discoverPacks', () => {
  it('trouve les packs valides et les trie par identifiant', async () => {
    const root = await scratch();
    await writePack(root, 'zeta', ['z1']);
    await writePack(root, 'alpha', ['a1']);

    const found = await discoverPacks(root);

    expect(found.map((entry) => entry.pack.id)).toEqual(['alpha', 'zeta']);
  });

  it('renvoie une liste vide si la racine n’existe pas', async () => {
    await expect(discoverPacks(join(await scratch(), 'nulle-part'))).resolves.toEqual([]);
  });

  it('ignore un dossier sans manifeste', async () => {
    const root = await scratch();
    await mkdir(join(root, 'vide'), { recursive: true });
    await writePack(root, 'bon', ['l1']);

    const found = await discoverPacks(root);

    expect(found.map((entry) => entry.pack.id)).toEqual(['bon']);
  });

  it('ignore un manifeste incohérent sans faire échouer les autres', async () => {
    const root = await scratch();
    const cassé = join(root, 'casse');
    await mkdir(cassé, { recursive: true });
    // Forme valide, mais aucun stade au niveau 1 : rejeté par parseCreaturePack.
    await writeFile(
      join(cassé, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: 'casse',
        name: 'Cassé',
        license: 'CC0-1.0',
        lines: [{ id: 'l', stages: [{ id: 's', name: 'S', sprite: 'a.png', fromLevel: 9 }] }],
      }),
      'utf8'
    );
    await writePack(root, 'bon', ['l1']);

    const found = await discoverPacks(root);

    expect(found.map((entry) => entry.pack.id)).toEqual(['bon']);
  });

  it('ignore les fichiers présents à la racine', async () => {
    const root = await scratch();
    await writeFile(join(root, 'README.md'), 'pas un pack', 'utf8');
    await writePack(root, 'bon', ['l1']);

    await expect(discoverPacks(root)).resolves.toHaveLength(1);
  });
});

describe('defaultsFrom', () => {
  it('prend le premier pack et sa première lignée', async () => {
    const root = await scratch();
    await writePack(root, 'alpha', ['premiere', 'seconde']);

    expect(defaultsFrom(await discoverPacks(root))).toEqual({
      packId: 'alpha',
      lineId: 'premiere',
    });
  });

  it('renvoie null quand aucun pack n’est installé', () => {
    expect(defaultsFrom([])).toBeNull();
  });
});
