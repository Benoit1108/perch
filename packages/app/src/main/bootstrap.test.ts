import { describe, expect, it } from 'vitest';

import type { ClockPort, StoragePort } from '@perch/core';
import { bootstrap } from './bootstrap.js';
import { nullSensors } from '../sensors/null.js';

const clock: ClockPort = { now: () => 1_000 };

function memoryStorage(initial: unknown): StoragePort & { readonly written: unknown[] } {
  const written: unknown[] = [];
  let value = initial;
  return {
    written,
    read: () => Promise.resolve(value),
    write: (next: unknown) => {
      value = next;
      written.push(next);
      return Promise.resolve();
    },
  };
}

const defaults = { packId: 'test-pack', lineId: 'brindille' };

describe('bootstrap', () => {
  it('crée un état neuf quand rien n est persisté', async () => {
    const storage = memoryStorage(null);

    const result = await bootstrap({ clock, storage, sensors: nullSensors }, defaults);

    expect(result.state.creature.level).toBe(1);
    expect(result.state.createdAt).toBe(1_000);
    expect(result.recovered).toBe(false);
    expect(storage.written).toHaveLength(1);
  });

  it('relit un état existant sans le réécrire', async () => {
    const existing = {
      schemaVersion: 1,
      createdAt: 55,
      creature: { packId: 'test-pack', lineId: 'braise', level: 12, xp: 900 },
    };
    const storage = memoryStorage(existing);

    const result = await bootstrap({ clock, storage, sensors: nullSensors }, defaults);

    expect(result.state.creature.level).toBe(12);
    expect(result.state.createdAt).toBe(55);
    expect(result.recovered).toBe(false);
    expect(storage.written).toHaveLength(0);
  });

  it('signale une récupération quand l état persisté est corrompu', async () => {
    const storage = memoryStorage({ creature: 'nope' });

    const result = await bootstrap({ clock, storage, sensors: nullSensors }, defaults);

    expect(result.recovered).toBe(true);
    expect(result.state.creature.level).toBe(1);
    expect(storage.written).toHaveLength(1);
  });
});
