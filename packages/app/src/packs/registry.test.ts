import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createPackRegistry } from './registry.js';

const scratch = (): Promise<string> => mkdtemp(join(tmpdir(), 'perch-registry-'));

async function ecrirePack(root: string, id: string): Promise<void> {
  await mkdir(join(root, id), { recursive: true });
  await writeFile(
    join(root, id, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      id,
      name: id,
      license: 'CC0-1.0',
      lines: [{ id, stages: [{ id, name: id, sprite: 'a.png', fromLevel: 1 }] }],
    }),
    'utf8'
  );
}

describe('createPackRegistry', () => {
  it('voit un pack ajouté après le démarrage', async () => {
    const root = await scratch();
    const registre = await createPackRegistry([root]);

    expect(registre.all()).toEqual([]);

    await ecrirePack(root, 'perso');

    // Toujours rien tant qu'on n'a pas relu : la liste ne se devine pas.
    expect(registre.all()).toEqual([]);

    expect((await registre.reload()).map((entry) => entry.pack.id)).toEqual(['perso']);
    expect(registre.all().map((entry) => entry.pack.id)).toEqual(['perso']);
  });

  it('oublie un pack retiré', async () => {
    const root = await scratch();
    await ecrirePack(root, 'perso');
    const registre = await createPackRegistry([root]);

    await rm(join(root, 'perso'), { recursive: true });
    await registre.reload();

    expect(registre.all()).toEqual([]);
  });
});
