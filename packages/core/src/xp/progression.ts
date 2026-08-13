import type { QuestConfig, QuestView } from '../quests/engine.js';
import { defaultQuestConfig, emptyQuests, evaluateQuests } from '../quests/engine.js';
import type { PerchState } from '../state/schema.js';
import { progressFor } from './curve.js';
import type { ActivitySample, EarnConfig } from './earn.js';
import { accumulate, dayKeyOf, defaultEarnConfig, emptyDay, signalsFrom } from './earn.js';

export interface ExternalSignals {
  readonly commits: number;
  readonly tasksDone: number;
}

export const noExternalSignals: ExternalSignals = { commits: 0, tasksDone: 0 };

export interface AdvanceInput {
  readonly sample: ActivitySample;
  readonly elapsedMs: number;
  readonly nowMs: number;
  /** Apportés par les sources branchées. Absents = profil sans source, ce qui est complet. */
  readonly external?: ExternalSignals;
  readonly earn?: EarnConfig;
  readonly quests?: QuestConfig;
}

export interface StateAdvance {
  readonly state: PerchState;
  /** Expérience du socle sur ce pas. */
  readonly gainedBase: number;
  /** Expérience issue de quêtes achevées à ce pas. Plafonnée par jour. */
  readonly gainedQuests: number;
  readonly leveledTo: number | null;
  readonly quests: readonly QuestView[];
  readonly completedQuests: readonly string[];
}

/**
 * Fait avancer la créature d'un pas : socle, puis quêtes.
 *
 * INVARIANT I4 — les deux apports sont calculés séparément et le second est plafonné.
 * Brancher une source ne peut donc jamais faire gagner davantage : elle change seulement
 * ce qu'on fait pour remplir les mêmes quêtes.
 *
 * Les états écrits avant l'existence de ces compteurs sont acceptés tels quels : personne
 * ne doit perdre sa créature parce qu'une mise à jour a ajouté un champ.
 */
export function advanceState(state: PerchState, input: AdvanceInput): StateAdvance {
  const earnConfig = input.earn ?? defaultEarnConfig;
  const questConfig = input.quests ?? defaultQuestConfig;
  const external = input.external ?? noExternalSignals;

  const day = state.day ?? emptyDay(dayKeyOf(input.nowMs));
  const earned = accumulate(day, input.sample, input.elapsedMs, input.nowMs, earnConfig);

  const { dayKey } = earned.day;
  const questState = state.quests ?? emptyQuests(dayKey);
  const outcome = evaluateQuests(
    dayKey,
    state.profiles,
    signalsFrom(earned.day, external),
    questState,
    questConfig
  );

  const xp = state.creature.xp + earned.xp + outcome.xp;
  const level = progressFor(xp).level;

  return {
    state: {
      ...state,
      creature: { ...state.creature, xp, level },
      day: earned.day,
      quests: outcome.state,
    },
    gainedBase: earned.xp,
    gainedQuests: outcome.xp,
    leveledTo: level > state.creature.level ? level : null,
    quests: outcome.quests,
    completedQuests: outcome.completed,
  };
}
