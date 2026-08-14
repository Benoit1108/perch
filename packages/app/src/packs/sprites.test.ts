import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { CreatureStage } from '@perch/core';

import { loadClips, loadPortrait } from './sprites.js';

const scratch = (): Promise<string> => mkdtemp(join(tmpdir(), 'perch-sprites-'));

/** Un PNG minuscule mais valide : on teste le chargement, pas le décodage. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function put(root: string, relative: string): Promise<void> {
  const target = join(root, relative);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, PIXEL);
}

function stage(overrides: Partial<CreatureStage> = {}): CreatureStage {
  return {
    id: 'alpha-1',
    name: 'Alpha',
    sprite: 'sprites/a/frame_00.png',
    fromLevel: 1,
    clips: {},
    ...overrides,
  };
}

describe('loadClips', () => {
  it('encode les images en URL de données', async () => {
    const root = await scratch();
    await put(root, 'sprites/a/frame_00.png');
    await put(root, 'sprites/a/frame_01.png');

    const decor = stage({
      clips: { repos: { frames: ['sprites/a/frame_00.png', 'sprites/a/frame_01.png'], fps: 8 } },
    });

    const clips = await loadClips(root, decor);
    expect(clips.repos?.frames).toHaveLength(2);
    expect(clips.repos?.frames[0]).toMatch(/^data:image\/png;base64,/u);
    await expect(loadPortrait(root, decor)).resolves.toMatch(/^data:image\/png;base64,/u);
  });

  // Le dépôt ne contient aucun sprite (invariant I5) : lancer l'application sans avoir
  // téléchargé le pack est un cas NORMAL, pas une panne.
  it('renvoie null plutôt que de lever quand le pack n’est pas téléchargé', async () => {
    const root = await scratch();

    await expect(loadPortrait(root, stage())).resolves.toBeNull();
    await expect(loadClips(root, stage())).resolves.toEqual({});
  });

  it('abandonne une animation dont une seule image manque', async () => {
    const root = await scratch();
    await put(root, 'sprites/a/frame_00.png');

    const clips = await loadClips(
      root,
      stage({
        clips: {
          repos: { frames: ['sprites/a/frame_00.png', 'sprites/a/frame_01.png'], fps: 8 },
        },
      })
    );

    // Une animation trouée sauterait visiblement : mieux vaut se rabattre sur une autre.
    expect(clips.repos).toBeUndefined();
  });

  it('garde les animations lisibles et écarte les autres', async () => {
    const root = await scratch();
    await put(root, 'sprites/a/frame_00.png');

    const clips = await loadClips(
      root,
      stage({
        clips: {
          repos: { frames: ['sprites/a/frame_00.png'], fps: 8 },
          sommeil: { frames: ['sprites/a/absente.png'], fps: 4 },
        },
      })
    );

    expect(clips.repos?.frames).toHaveLength(1);
    expect(clips.sommeil).toBeUndefined();
  });

  // Le schéma refuse déjà les chemins remontants, mais un lien symbolique déposé DANS le
  // pack contourne toute vérification textuelle. Le manifeste est une donnée externe : un
  // pack tiers s'installe en copiant un dossier.
  it('refuse de lire hors du pack, même par lien symbolique', async () => {
    const root = await scratch();
    const dehors = join(await scratch(), 'secret.png');
    await writeFile(dehors, PIXEL);
    await mkdir(join(root, 'sprites'), { recursive: true });
    await symlink(dehors, join(root, 'sprites', 'fuite.png'));

    await expect(loadPortrait(root, stage({ sprite: 'sprites/fuite.png' }))).resolves.toBeNull();
  });
});
