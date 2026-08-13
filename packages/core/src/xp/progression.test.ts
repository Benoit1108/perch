import { describe, expect, it } from 'vitest';

import { defaultQuestConfig, rewardPerQuest } from '../quests/engine.js';
import type { PerchState } from '../state/schema.js';
import { xpToReach } from './curve.js';
import { advanceState } from './progression.js';

const MINUTE = 60_000;
const HEURE = 3_600_000;
const T0 = Date.parse('2026-08-13T08:00:00Z');
const JOUR = '2026-08-13';

function etat(overrides: Partial<PerchState> = {}): PerchState {
  return {
    schemaVersion: 1,
    createdAt: T0,
    creature: { packId: 'test-pack', lineId: 'brindille', level: 1, xp: 0 },
    ...overrides,
  };
}

const actif = { idleMs: 0, app: 'ide' };

/** Journée déjà bien remplie : de quoi valider n'importe quelle quête universelle. */
const journeeRemplie = {
  dayKey: JOUR,
  activeMs: 10 * HEURE,
  focusApp: 'ide',
  focusMs: 10 * HEURE,
  apps: ['ide', 'navigateur', 'terminal', 'musique'],
  breaks: 4,
  idleRunMs: 0,
};

describe('advanceState — socle', () => {
  it('accumule sans changer de niveau trop tôt', () => {
    const result = advanceState(etat(), { sample: actif, elapsedMs: MINUTE, nowMs: T0 });

    expect(result.gainedBase).toBeGreaterThan(0);
    expect(result.state.creature.level).toBe(1);
    expect(result.leveledTo).toBeNull();
  });

  it('n’avance pas pendant une inactivité', () => {
    const result = advanceState(
      etat({ creature: { packId: 'p', lineId: 'l', level: 2, xp: 500 } }),
      {
        sample: { idleMs: 10 * MINUTE, app: 'ide' },
        elapsedMs: MINUTE,
        nowMs: T0,
      }
    );

    expect(result.gainedBase).toBe(0);
    expect(result.gainedQuests).toBe(0);
    expect(result.state.creature.xp).toBe(500);
  });

  it('signale le franchissement d’un niveau', () => {
    const presqueDeux = etat({
      creature: { packId: 'p', lineId: 'l', level: 1, xp: xpToReach(2) - 1 },
    });
    const result = advanceState(presqueDeux, { sample: actif, elapsedMs: MINUTE, nowMs: T0 });

    expect(result.leveledTo).toBe(2);
  });

  it('relit un état écrit avant l’existence des compteurs journaliers', () => {
    const ancien = etat();
    expect(ancien.day).toBeUndefined();

    const result = advanceState(ancien, { sample: actif, elapsedMs: MINUTE, nowMs: T0 });

    expect(result.state.day?.dayKey).toBe(JOUR);
    expect(result.gainedBase).toBeGreaterThan(0);
  });
});

describe('advanceState — quêtes', () => {
  it('accorde l’expérience des quêtes achevées', () => {
    const result = advanceState(etat({ day: journeeRemplie }), {
      sample: actif,
      elapsedMs: MINUTE,
      nowMs: T0,
    });

    expect(result.completedQuests.length).toBeGreaterThan(0);
    expect(result.gainedQuests).toBe(
      result.completedQuests.length * rewardPerQuest(defaultQuestConfig)
    );
  });

  it('ne récompense pas deux fois la même quête', () => {
    const premier = advanceState(etat({ day: journeeRemplie }), {
      sample: actif,
      elapsedMs: MINUTE,
      nowMs: T0,
    });
    const second = advanceState(premier.state, {
      sample: actif,
      elapsedMs: MINUTE,
      nowMs: T0,
    });

    expect(premier.gainedQuests).toBeGreaterThan(0);
    expect(second.gainedQuests).toBe(0);
  });

  it('ne dépasse jamais le plafond quotidien de quêtes', () => {
    let state = etat({ day: journeeRemplie });
    let total = 0;

    for (let i = 0; i < 50; i++) {
      const pas = advanceState(state, {
        sample: actif,
        elapsedMs: MINUTE,
        nowMs: T0,
        evidence: { watchedRepos: 1, tasks: 1 },
        observedCommits: [`c${String(i)}`],
        tasksDone: 99,
      });
      state = pas.state;
      total += pas.gainedQuests;
    }

    expect(total).toBeLessThanOrEqual(defaultQuestConfig.dailyCap);
  });
});

/**
 * L'invariant I4, vérifié de bout en bout plutôt que sur le seul moteur de quêtes.
 *
 * Un développeur avec toutes ses sources branchées et quelqu'un sans aucune source
 * doivent finir la journée au même niveau. Si ce test tombe, le projet a deux populations.
 */
describe('équité entre profils, de bout en bout', () => {
  it('donne le même total quotidien avec et sans sources branchées', () => {
    function journee(evidence: { watchedRepos: number; tasks: number }) {
      let state = etat();

      // 4 h actives, dont 2 h dans la même application.
      for (let i = 0; i < 240; i++) {
        const app = i < 120 ? 'ide' : `app-${String(i % 4)}`;
        state = advanceState(state, {
          sample: { idleMs: 0, app },
          elapsedMs: MINUTE,
          nowMs: T0,
          evidence,
          observedCommits: ['a', 'b', 'c', 'd', 'e'],
          tasksDone: 99,
        }).state;
      }
      return state.creature.xp;
    }

    const sansSource = journee({ watchedRepos: 0, tasks: 0 });
    const toutBranche = journee({ watchedRepos: 3, tasks: 10 });

    expect(sansSource).toBe(toutBranche);
  });
});
