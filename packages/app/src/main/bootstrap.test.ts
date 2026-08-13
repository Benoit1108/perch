import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ClockPort, StoragePort, StorageRead } from '@perch/core';
import { createFileStorage } from '../adapters/storage.js';
import { nullSensors } from '../sensors/null.js';
import { bootstrap } from './bootstrap.js';

const clock: ClockPort = { now: () => 1_000 };
const defaults = { packId: 'test-pack', lineId: 'brindille' };

function memoryStorage(initial: StorageRead): StoragePort & {
  readonly written: unknown[];
  readonly archived: number;
} {
  const written: unknown[] = [];
  let archived = 0;
  let current = initial;

  return {
    written,
    get archived() {
      return archived;
    },
    read: () => Promise.resolve(current),
    write: (next: unknown) => {
      current = { kind: 'value', value: next };
      written.push(next);
      return Promise.resolve();
    },
    archive: () => {
      archived += 1;
      return Promise.resolve('/quelque/part/state.json.corrompu');
    },
  };
}

const validState = {
  schemaVersion: 1,
  createdAt: 55,
  creature: { packId: 'test-pack', lineId: 'braise', level: 12, xp: 900 },
};

describe('bootstrap', () => {
  it('crée un état neuf quand rien n’est persisté', async () => {
    const storage = memoryStorage({ kind: 'absent' });

    const result = await bootstrap({ clock, storage, sensors: nullSensors }, defaults);

    expect(result.recovery).toEqual({ kind: 'fresh' });
    expect(result.state.creature.level).toBe(1);
    expect(result.state.createdAt).toBe(1_000);
    expect(storage.written).toHaveLength(1);
    expect(storage.archived).toBe(0);
  });

  it('relit un état existant sans le réécrire ni l’archiver', async () => {
    const storage = memoryStorage({ kind: 'value', value: validState });

    const result = await bootstrap({ clock, storage, sensors: nullSensors }, defaults);

    expect(result.recovery).toEqual({ kind: 'restored' });
    expect(result.state.creature.level).toBe(12);
    expect(storage.written).toHaveLength(0);
    expect(storage.archived).toBe(0);
  });

  it('archive avant d’écraser un fichier illisible', async () => {
    const storage = memoryStorage({ kind: 'unreadable', reason: 'JSON invalide' });

    const result = await bootstrap({ clock, storage, sensors: nullSensors }, defaults);

    expect(result.recovery).toEqual({
      kind: 'recovered',
      reason: 'JSON invalide',
      archivedAt: '/quelque/part/state.json.corrompu',
    });
    expect(storage.archived).toBe(1);
    expect(result.state.creature.level).toBe(1);
  });

  it('archive aussi quand le contenu est du JSON valide mais hors schéma', async () => {
    const storage = memoryStorage({ kind: 'value', value: { creature: 'nope' } });

    const result = await bootstrap({ clock, storage, sensors: nullSensors }, defaults);

    expect(result.recovery.kind).toBe('recovered');
    expect(storage.archived).toBe(1);
  });
});

/**
 * Le test qui manquait : un vrai fichier tronqué sur un vrai disque.
 *
 * Les doublures de test passaient à côté du bug — `read()` confondait « absent » et
 * « illisible », et l'état corrompu était écrasé sans un mot. Une doublure ne reproduit
 * que ce qu'on a pensé à lui faire reproduire.
 */
describe('bootstrap sur un stockage réel', () => {
  it('conserve le fichier corrompu au lieu de le perdre', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'perch-'));
    const statePath = join(dir, 'state.json');
    await writeFile(statePath, '{ ceci n’est pas du json', 'utf8');

    const storage = createFileStorage(statePath);
    const result = await bootstrap({ clock, storage, sensors: nullSensors }, defaults);

    expect(result.recovery.kind).toBe('recovered');
    if (result.recovery.kind === 'recovered') {
      expect(result.recovery.archivedAt).toContain('corrompu');
    }

    // Le nouvel état est bien relisible ensuite.
    const reread = await storage.read();
    expect(reread.kind).toBe('value');
  });
});
