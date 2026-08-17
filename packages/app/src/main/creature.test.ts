import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCreaturePack } from '@perch/core';

import type { DiscoveredPack } from '../packs/discover.js';
import { createCompanion } from './creature.js';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/** Un pack sur disque, avec ses images : le chargement des assets fait partie du test. */
async function writePack(id = 'essai'): Promise<DiscoveredPack> {
  const directory = await mkdtemp(join(tmpdir(), 'perch-companion-'));
  await mkdir(join(directory, 'sprites'), { recursive: true });
  for (const nom of ['un-1', 'un-2', 'deux-1']) {
    await writeFile(join(directory, 'sprites', `${nom}.png`), PIXEL);
  }

  const stage = (id: string, name: string, fromLevel: number): unknown => ({
    id,
    name,
    sprite: `sprites/${id}.png`,
    fromLevel,
    clips: { repos: { frames: [`sprites/${id}.png`], fps: 8 } },
  });

  return {
    directory,
    pack: parseCreaturePack({
      schemaVersion: 1,
      id,
      name: id,
      license: 'CC0-1.0',
      lines: [
        { id: 'un', stages: [stage('un-1', 'Un', 1), stage('un-2', 'Un majeur', 16)] },
        { id: 'deux', stages: [stage('deux-1', 'Deux', 1)] },
      ],
    }),
  };
}

interface Sent {
  readonly channel: string;
  readonly payload: unknown;
}

function recorder(): { sent: Sent[]; retain: (channel: string, payload: unknown) => void } {
  const sent: Sent[] = [];
  return { sent, retain: (channel, payload) => sent.push({ channel, payload }) };
}

async function companionOn(lineId = 'un'): Promise<{
  companion: ReturnType<typeof createCompanion>;
  sink: ReturnType<typeof recorder>;
}> {
  const sink = recorder();
  const pack = await writePack();
  const companion = createCompanion({
    packs: () => [pack],
    sink,
    packId: 'essai',
    lineId,
  });
  return { companion, sink };
}

describe('createCompanion — apparence', () => {
  it('envoie le stade correspondant au niveau, avec ses images', async () => {
    const { companion, sink } = await companionOn();
    await companion.show(20);

    const [message] = sink.sent;
    expect(message?.channel).toBe('perch:creature');
    expect(message?.payload).toMatchObject({ stageId: 'un-2', name: 'Un majeur', evolved: false });
  });

  it('joint la table de lecture, que le rendu ne sait pas construire', async () => {
    const { companion, sink } = await companionOn();
    await companion.show(1);

    // Le rendu reçoit une table déjà résolue : à chaque état, une animation existante et
    // sa cadence. Aucun repli à calculer dans une page que rien ne teste.
    expect(sink.sent[0]?.payload).toMatchObject({
      byState: { sommeil: { clip: 'repos' }, marche: { clip: 'repos' } },
      frames: { repos: [`data:image/png;base64,${PIXEL.toString('base64')}`] },
    });
  });

  // Aucun sprite n'est committé (invariant I5) : sans pack téléchargé, le rendu doit
  // garder son marqueur de repli plutôt que de recevoir une créature vide.
  it('n’envoie rien quand aucun pack n’est installé', async () => {
    const sink = recorder();
    const orphelin = createCompanion({ packs: () => [], sink, packId: 'essai', lineId: 'un' });
    await orphelin.show(1);

    expect(sink.sent).toHaveLength(0);
  });
});

describe('createCompanion — choix', () => {
  it('propose une entrée par lignée, avec son portrait de départ', async () => {
    const { companion } = await companionOn();
    const choices = await companion.choices();

    expect(choices.map((choice) => choice.lineId)).toEqual(['un', 'deux']);
    expect(choices[0]?.name).toBe('Un');
    expect(choices[0]?.portrait).toMatch(/^data:image\/png;base64,/u);
  });

  // Ne proposer que le pack courant enfermerait dans un pack sans images : portraits vides
  // et aucun moyen d'en sortir.
  it('propose les lignées de TOUS les packs installés', async () => {
    const sink = recorder();
    const deux = [await writePack(), await writePack('autre')];
    const companion = createCompanion({
      packs: () => deux,
      sink,
      packId: 'essai',
      lineId: 'un',
    });

    const choices = await companion.choices();
    expect(choices.map((choice) => choice.packId)).toEqual(['essai', 'essai', 'autre', 'autre']);
  });

  // La fenêtre de choix est du code exécuté par un moteur web : ce qu'elle renvoie se
  // vérifie, et se vérifie sans relire une seule image.
  it('reconnaît un couple pack/lignée proposé, et rejette le reste', async () => {
    const { companion } = await companionOn();

    expect(companion.offers('essai', 'deux')).toBe(true);
    expect(companion.offers('essai', 'inconnue')).toBe(false);
    expect(companion.offers('inconnu', 'un')).toBe(false);
  });

  it('change de créature et rafraîchit aussitôt le rendu', async () => {
    const { companion, sink } = await companionOn();
    await companion.choose('essai', 'deux', 1);

    expect(sink.sent[0]?.payload).toMatchObject({ stageId: 'deux-1' });
  });

  it('suit le nouveau pack pour les évolutions suivantes', async () => {
    const sink = recorder();
    const deux = [await writePack(), await writePack('autre')];
    const companion = createCompanion({
      packs: () => deux,
      sink,
      packId: 'essai',
      lineId: 'deux',
    });

    expect(companion.evolutionAt(1, 20)).toBeNull();
    await companion.choose('autre', 'un', 20);
    expect(companion.evolutionAt(15, 16)?.name).toBe('Un majeur');
  });
});

describe('createCompanion — évolution', () => {
  it('reconnaît le franchissement d’un palier', () => {
    return companionOn().then(({ companion }) => {
      expect(companion.evolutionAt(15, 16)?.name).toBe('Un majeur');
    });
  });

  it('ne signale rien sur une montée de niveau ordinaire', async () => {
    const { companion } = await companionOn();
    expect(companion.evolutionAt(16, 17)).toBeNull();
  });

  it('ne signale rien pour une lignée à stade unique', async () => {
    const { companion } = await companionOn('deux');
    expect(companion.evolutionAt(1, 40)).toBeNull();
  });
});
