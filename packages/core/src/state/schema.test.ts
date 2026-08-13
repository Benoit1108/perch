import { describe, expect, it } from 'vitest';

import type { ClockPort } from '../ports/clock.js';
import { STATE_SCHEMA_VERSION, createInitialState, readState } from './schema.js';

/** Horloge figée : c'est tout l'intérêt du ClockPort. */
const frozenClock = (at: number): ClockPort => ({ now: () => at });

describe('createInitialState', () => {
  it('lit la date depuis le ClockPort et non depuis Date.now', () => {
    const state = createInitialState(frozenClock(1_700_000_000_000), 'test-pack', 'brindille');
    expect(state.createdAt).toBe(1_700_000_000_000);
  });

  it('démarre au niveau 1 sans expérience', () => {
    const state = createInitialState(frozenClock(0), 'test-pack', 'brindille');
    expect(state.creature.level).toBe(1);
    expect(state.creature.xp).toBe(0);
    expect(state.schemaVersion).toBe(STATE_SCHEMA_VERSION);
  });
});

describe('readState', () => {
  const valid = createInitialState(frozenClock(42), 'test-pack', 'brindille');

  it('relit un état valide', () => {
    expect(readState(structuredClone(valid))).toEqual(valid);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['une chaîne', 'nope'],
    ['un objet vide', {}],
    ['une version de schéma inconnue', { ...valid, schemaVersion: 99 }],
    ['un niveau hors bornes', { ...valid, creature: { ...valid.creature, level: 0 } }],
    ['un niveau au-delà de 100', { ...valid, creature: { ...valid.creature, level: 101 } }],
    ['une expérience négative', { ...valid, creature: { ...valid.creature, xp: -1 } }],
  ])('renvoie null pour %s', (_label, raw) => {
    expect(readState(raw)).toBeNull();
  });

  it('ne lève jamais : un fichier corrompu ne doit pas empêcher le démarrage', () => {
    expect(() => readState({ creature: { level: 'beaucoup' } })).not.toThrow();
  });
});
