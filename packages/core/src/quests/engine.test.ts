import { describe, expect, it } from 'vitest';

import type { QuestProfile, QuestSignals } from './catalog.js';
import { CATALOG, poolFor } from './catalog.js';

import {
  defaultQuestConfig,
  emptyQuests,
  evaluateQuests,
  questsForDay,
  rewardPerQuest,
} from './engine.js';

/** Journée vierge. Vit ICI : la production ne part jamais de zéro, elle part du réel. */
const noSignals: QuestSignals = {
  activeMs: 0,
  focusMs: 0,
  distinctApps: 0,
  breaks: 0,
  commits: 0,
  tasksDone: 0,
};

const config = defaultQuestConfig;
const HEURE = 3_600_000;
const JOUR = '2026-08-13';

/** De quoi réussir n'importe quelle quête, quel que soit le profil. */
const toutReussi: QuestSignals = {
  activeMs: 12 * HEURE,
  focusMs: 12 * HEURE,
  distinctApps: 20,
  breaks: 5,
  commits: 50,
  tasksDone: 50,
};

describe('poolFor', () => {
  it('inclut toujours les quêtes universelles', () => {
    expect(poolFor([]).every((q) => q.profile === 'universel')).toBe(true);
    expect(poolFor([]).length).toBeGreaterThan(0);
  });

  it('ajoute les quêtes du profil demandé', () => {
    const ids = poolFor(['dev']).map((q) => q.id);
    expect(ids).toContain('trois-commits');
    expect(ids).not.toContain('cinq-taches');
  });
});

describe('questsForDay', () => {
  it('propose le même nombre de quêtes à tous les profils', () => {
    const profils: QuestProfile[][] = [[], ['dev'], ['taches'], ['dev', 'taches']];
    for (const profil of profils) {
      expect(questsForDay(JOUR, profil, config)).toHaveLength(config.perDay);
    }
  });

  it('est déterministe pour un jour donné', () => {
    expect(questsForDay(JOUR, ['dev'], config)).toEqual(questsForDay(JOUR, ['dev'], config));
  });

  it('change d’un jour à l’autre', () => {
    const a = questsForDay('2026-08-13', ['dev'], config).map((q) => q.id);
    let different = false;
    for (const jour of ['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17']) {
      const b = questsForDay(jour, ['dev'], config).map((q) => q.id);
      if (JSON.stringify(a) !== JSON.stringify(b)) different = true;
    }
    expect(different).toBe(true);
  });

  it('ne propose jamais plus que le catalogue disponible', () => {
    const large = { perDay: 99, dailyCap: 200 };
    expect(questsForDay(JOUR, ['dev', 'taches'], large).length).toBe(CATALOG.length);
  });
});

/**
 * LA DÉFINITION DE FINI DU SPRINT.
 *
 * Si ce test tombe, le projet a deux populations : celle qui joue le vrai jeu et celle
 * qui joue une version bridée. C'est exactement ce que l'invariant I4 interdit.
 */
describe('équité entre profils', () => {
  it('donne le même XP quotidien à un profil sans source et à un profil tout branché', () => {
    const nu = evaluateQuests(JOUR, [], toutReussi, emptyQuests(JOUR), config);
    const equipe = evaluateQuests(JOUR, ['dev', 'taches'], toutReussi, emptyQuests(JOUR), config);

    expect(nu.xp).toBe(equipe.xp);
    expect(nu.quests).toHaveLength(equipe.quests.length);
    expect(nu.completed).toHaveLength(equipe.completed.length);
  });

  it('vaut ce plafond sur trente jours consécutifs', () => {
    let sansSource = 0;
    let toutBranche = 0;

    for (let i = 1; i <= 30; i++) {
      const jour = `2026-09-${String(i).padStart(2, '0')}`;
      sansSource += evaluateQuests(jour, [], toutReussi, emptyQuests(jour), config).xp;
      toutBranche += evaluateQuests(
        jour,
        ['dev', 'taches'],
        toutReussi,
        emptyQuests(jour),
        config
      ).xp;
    }

    expect(sansSource).toBe(toutBranche);
    expect(sansSource).toBe(30 * config.perDay * rewardPerQuest(config));
  });

  it('ne laisse jamais un profil dépasser le plafond quotidien', () => {
    const outcome = evaluateQuests(JOUR, ['dev', 'taches'], toutReussi, emptyQuests(JOUR), config);
    expect(outcome.xp).toBeLessThanOrEqual(config.dailyCap);
  });
});

describe('evaluateQuests', () => {
  it('n’accorde rien sans aucun signal', () => {
    const outcome = evaluateQuests(JOUR, [], noSignals, emptyQuests(JOUR), config);
    expect(outcome.xp).toBe(0);
    expect(outcome.quests.every((q) => !q.done)).toBe(true);
  });

  it('ne récompense une quête qu’une seule fois', () => {
    const premier = evaluateQuests(JOUR, [], toutReussi, emptyQuests(JOUR), config);
    const second = evaluateQuests(JOUR, [], toutReussi, premier.state, config);

    expect(premier.xp).toBeGreaterThan(0);
    expect(second.xp).toBe(0);
    expect(second.quests.every((q) => q.claimed)).toBe(true);
  });

  it('remet les quêtes à zéro au changement de jour', () => {
    const hier = evaluateQuests('2026-08-12', [], toutReussi, emptyQuests('2026-08-12'), config);
    const aujourdhui = evaluateQuests(JOUR, [], toutReussi, hier.state, config);

    expect(aujourdhui.xp).toBeGreaterThan(0);
    expect(aujourdhui.state.dayKey).toBe(JOUR);
  });

  it('rapporte un avancement plafonné à la cible', () => {
    const outcome = evaluateQuests(JOUR, [], toutReussi, emptyQuests(JOUR), config);
    for (const quest of outcome.quests) {
      expect(quest.progress).toBeLessThanOrEqual(quest.target);
    }
  });

  it('ignore un signal négatif', () => {
    const absurde: QuestSignals = { ...noSignals, commits: -10, activeMs: -1 };
    const outcome = evaluateQuests(JOUR, ['dev'], absurde, emptyQuests(JOUR), config);
    expect(outcome.quests.every((q) => q.progress >= 0)).toBe(true);
    expect(outcome.xp).toBe(0);
  });

  it('accorde l’expérience au fur et à mesure des réussites', () => {
    const partiel: QuestSignals = { ...noSignals, distinctApps: 99, breaks: 99 };
    const premier = evaluateQuests(JOUR, [], partiel, emptyQuests(JOUR), config);
    const complet = evaluateQuests(JOUR, [], toutReussi, premier.state, config);

    expect(premier.xp + complet.xp).toBe(config.perDay * rewardPerQuest(config));
  });
});

describe('rewardPerQuest', () => {
  it('répartit le plafond à parts égales', () => {
    expect(rewardPerQuest({ perDay: 4, dailyCap: 200 })).toBe(50);
  });

  it('ne divise pas par zéro', () => {
    expect(rewardPerQuest({ perDay: 0, dailyCap: 200 })).toBe(0);
  });
});
