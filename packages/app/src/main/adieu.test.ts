import { describe, expect, it, vi } from 'vitest';

import type { PerchState, StoragePort } from '@perch/core';
import { createInitialState } from '@perch/core';

import { adieu } from './adieu.js';

const ETAT: PerchState = createInitialState({ now: () => 1_755_432_000_000 }, 'poro', 'poro');

function monter(write: () => Promise<void>) {
  const differes: (() => void)[] = [];
  const journal: string[] = [];

  const storage: StoragePort = {
    read: () => Promise.resolve({ kind: 'absent' }),
    write: (etat: PerchState) => {
      journal.push(`ecrit:${etat.creature.lineId}`);
      return write();
    },
    archive: () => Promise.resolve(null),
  };

  const gestionnaire = adieu({
    storage,
    state: () => ETAT,
    arreter: () => {
      journal.push('arrete');
    },
    quitter: () => {
      journal.push('quitte');
    },
    differer: (action) => {
      differes.push(action);
    },
  });

  return {
    gestionnaire,
    journal,
    echoirLeDelai: () => {
      for (const action of differes) action();
    },
  };
}

const evenement = () => ({ preventDefault: vi.fn() });

describe('adieu', () => {
  it('diffère la fermeture, écrit, puis la reprend', async () => {
    const { gestionnaire, journal } = monter(() => Promise.resolve());
    const event = evenement();

    gestionnaire(event);
    await vi.waitFor(() => {
      expect(journal).toContain('quitte');
    });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(journal).toEqual(['arrete', 'ecrit:poro', 'quitte']);
  });

  it('ne réécrit pas au second « will-quit »', async () => {
    const { gestionnaire, journal } = monter(() => Promise.resolve());

    gestionnaire(evenement());
    await vi.waitFor(() => {
      expect(journal).toContain('quitte');
    });

    const second = evenement();
    gestionnaire(second);

    // La reprise déclenche un second événement : sans le garde, la fermeture se
    // différerait à l'infini et l'application ne se fermerait plus jamais.
    expect(second.preventDefault).not.toHaveBeenCalled();
    expect(journal.filter((ligne) => ligne.startsWith('ecrit'))).toHaveLength(1);
  });

  it('ferme quand même si l’écriture échoue', async () => {
    const { gestionnaire, journal } = monter(() => Promise.reject(new Error('disque plein')));

    gestionnaire(evenement());

    await vi.waitFor(() => {
      expect(journal).toContain('quitte');
    });
  });

  it('ferme quand même si l’écriture n’aboutit jamais', () => {
    const { gestionnaire, journal, echoirLeDelai } = monter(() => new Promise(() => undefined));

    gestionnaire(evenement());
    expect(journal).not.toContain('quitte');

    echoirLeDelai();
    expect(journal).toContain('quitte');
  });

  it('ne ferme qu’une fois si le délai échoit après l’écriture', async () => {
    const { gestionnaire, journal, echoirLeDelai } = monter(() => Promise.resolve());

    gestionnaire(evenement());
    await vi.waitFor(() => {
      expect(journal).toContain('quitte');
    });
    echoirLeDelai();

    expect(journal.filter((ligne) => ligne === 'quitte')).toHaveLength(1);
  });
});
