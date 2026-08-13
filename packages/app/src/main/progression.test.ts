import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityPort, ClockPort, PerchState, StoragePort } from '@perch/core';
import { defaultEarnConfig } from '@perch/core';

import { startProgression } from './progression.js';

const MINUTE = 60_000;
const T0 = Date.parse('2026-08-13T08:00:00Z');

const etatInitial: PerchState = {
  schemaVersion: 1,
  createdAt: T0,
  creature: { packId: 'test-pack', lineId: 'brindille', level: 1, xp: 0 },
};

function horlogePilotee(): ClockPort & { avance(ms: number): void } {
  let now = T0;
  return {
    now: () => now,
    avance: (ms) => {
      now += ms;
    },
  };
}

function activite(idleMs: number, app: string | null): ActivityPort {
  return {
    idleMs: () => Promise.resolve(idleMs),
    focusedApp: () => Promise.resolve(app),
  };
}

function stockage(): StoragePort & { readonly ecrits: unknown[] } {
  const ecrits: unknown[] = [];
  return {
    ecrits,
    read: () => Promise.resolve({ kind: 'absent' as const }),
    write: (value) => {
      ecrits.push(value);
      return Promise.resolve();
    },
    archive: () => Promise.resolve(null),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('startProgression', () => {
  it('accumule et persiste à chaque tick', async () => {
    const clock = horlogePilotee();
    const storage = stockage();
    const p = startProgression(etatInitial, {
      clock,
      activity: activite(0, 'ide'),
      storage,
      tickMs: MINUTE,
    });

    for (let i = 0; i < 3; i++) {
      clock.avance(MINUTE);
      await vi.advanceTimersByTimeAsync(MINUTE);
    }
    p.stop();

    expect(storage.ecrits).toHaveLength(3);
    expect(p.current().creature.xp).toBeCloseTo(3 * defaultEarnConfig.baseXpPerMinute, 5);
  });

  it('n’accumule rien quand l’utilisateur est absent', async () => {
    const clock = horlogePilotee();
    const p = startProgression(etatInitial, {
      clock,
      activity: activite(10 * MINUTE, 'ide'),
      storage: stockage(),
      tickMs: MINUTE,
    });

    clock.avance(MINUTE);
    await vi.advanceTimersByTimeAsync(MINUTE);
    p.stop();

    expect(p.current().creature.xp).toBe(0);
  });

  /**
   * Le piège de la veille.
   *
   * Au réveil, `Date.now()` a bondi de plusieurs heures et l'utilisateur bouge sa souris :
   * il paraît donc parfaitement actif. Sans borne, la créature encaisserait une nuit
   * entière d'expérience pour une seconde de présence.
   */
  it('borne le temps écoulé après une longue veille', async () => {
    const clock = horlogePilotee();
    const p = startProgression(etatInitial, {
      clock,
      activity: activite(0, 'ide'),
      storage: stockage(),
      tickMs: MINUTE,
    });

    clock.avance(8 * 3_600_000);
    await vi.advanceTimersByTimeAsync(MINUTE);
    p.stop();

    // Au plus deux ticks, pas huit heures.
    expect(p.current().creature.xp).toBeLessThanOrEqual(2 * defaultEarnConfig.baseXpPerMinute);
  });

  it('signale un passage de niveau', async () => {
    const clock = horlogePilotee();
    const niveaux: number[] = [];
    const presqueDeux: PerchState = {
      ...etatInitial,
      creature: { ...etatInitial.creature, xp: 299 },
    };

    const p = startProgression(presqueDeux, {
      clock,
      activity: activite(0, 'ide'),
      storage: stockage(),
      tickMs: MINUTE,
      onLevelUp: (level) => niveaux.push(level),
    });

    clock.avance(MINUTE);
    await vi.advanceTimersByTimeAsync(MINUTE);
    p.stop();

    expect(niveaux).toEqual([2]);
  });

  it('cesse d’écrire après l’arrêt', async () => {
    const clock = horlogePilotee();
    const storage = stockage();
    const p = startProgression(etatInitial, {
      clock,
      activity: activite(0, 'ide'),
      storage,
      tickMs: MINUTE,
    });

    clock.avance(MINUTE);
    await vi.advanceTimersByTimeAsync(MINUTE);
    p.stop();
    const compte = storage.ecrits.length;

    clock.avance(5 * MINUTE);
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(storage.ecrits).toHaveLength(compte);
  });
});
