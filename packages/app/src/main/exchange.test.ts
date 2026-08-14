import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCreaturePack, seal } from '@perch/core';

import { deposit } from '../exchange/box.js';
import type { DiscoveredPack } from '../packs/discover.js';
import { createExchange } from './exchange.js';

const scratch = (): Promise<string> => mkdtemp(join(tmpdir(), 'perch-echange-'));

function pack(id: string, especes: Readonly<Record<string, string | undefined>>): DiscoveredPack {
  return {
    directory: `/packs/${id}`,
    pack: parseCreaturePack({
      schemaVersion: 1,
      id,
      name: id,
      license: 'CC0-1.0',
      lines: Object.entries(especes).map(([ligne, espece]) => ({
        id: ligne,
        stages: [
          {
            id: `${ligne}-1`,
            name: ligne,
            sprite: 'a.png',
            fromLevel: 1,
            ...(espece !== undefined && { species: espece }),
          },
        ],
      })),
    }),
  };
}

async function echange(packs: readonly DiscoveredPack[] = [pack('local', { chouette: 'rowlet' })]) {
  const directory = await scratch();
  return {
    directory,
    exchange: createExchange({
      packs,
      directory,
      appVersion: '0.0.0',
      newId: () => 'depot-1',
      now: () => '2026-08-14T14:00:00Z',
    }),
  };
}

describe('dépôt', () => {
  it('confie l’espèce et le niveau, pas la courbe d’expérience', async () => {
    const { exchange } = await echange();
    const enveloppe = await exchange.send({
      packId: 'local',
      lineId: 'chouette',
      level: 12,
      xp: 4242,
    });

    expect(enveloppe?.creature).toMatchObject({ species: 'rowlet', level: 12 });
    expect(enveloppe?.origin.app).toBe('perch');
  });

  // Un pack entièrement original n'a personne avec qui échanger : écrire une enveloppe que
  // personne ne saurait ouvrir serait pire que refuser.
  it('refuse de déposer une créature sans espèce déclarée', async () => {
    const { exchange } = await echange([pack('original', { bidule: undefined })]);

    await expect(
      exchange.send({ packId: 'original', lineId: 'bidule', level: 3, xp: 0 })
    ).resolves.toBeNull();
  });

  it('laisse un mot à qui la retirera', async () => {
    const { exchange } = await echange();
    const enveloppe = await exchange.send(
      { packId: 'local', lineId: 'chouette', level: 1, xp: 0 },
      'Prends soin de lui.'
    );

    expect(enveloppe?.note).toBe('Prends soin de lui.');
  });
});

describe('retrait', () => {
  const venu = (species: string) =>
    seal({
      id: 'venu',
      at: '2026-08-14T10:00:00Z',
      app: 'claude-pokemon',
      creature: { species, name: 'Fantominus', level: 20, shiny: false },
    });

  it('adopte une espèce que nos packs savent loger', async () => {
    const { exchange, directory } = await echange();
    await deposit(directory, venu('rowlet'));

    await expect(exchange.take('venu')).resolves.toEqual({
      kind: 'adoptee',
      packId: 'local',
      lineId: 'chouette',
      // Le niveau voyage AVEC le retrait : l'enveloppe a quitté la boîte, on ne peut plus
      // y retourner le chercher.
      level: 20,
    });
  });

  // Le cas normal entre deux applications aux créatures distinctes : elles ne partagent
  // pas les mêmes espèces. Mieux vaut le dire que de faire semblant d'accueillir.
  it('avoue ne pas savoir loger une espèce inconnue', async () => {
    const { exchange, directory } = await echange();
    await deposit(directory, venu('gastly'));

    await expect(exchange.take('venu')).resolves.toEqual({ kind: 'inconnue', species: 'gastly' });
  });

  it('signale une créature déjà partie', async () => {
    const { exchange } = await echange();
    await expect(exchange.take('fantome')).resolves.toEqual({ kind: 'partie' });
  });

  it('montre ce qui attend dans la boîte', async () => {
    const { exchange, directory } = await echange();
    await deposit(directory, venu('gastly'));

    expect((await exchange.waiting()).map((e) => e.creature.name)).toEqual(['Fantominus']);
  });
});
