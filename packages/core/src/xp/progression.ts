import type { Evidence } from '../quests/evidence.js';
import { deriveProfiles, mergeCommits, noEvidence } from '../quests/evidence.js';
import type { QuestConfig, QuestView } from '../quests/engine.js';
import { defaultQuestConfig, emptyQuests, evaluateQuests } from '../quests/engine.js';
import type { PerchState } from '../state/schema.js';
import { progressFor } from './curve.js';
import type { ActivitySample, EarnConfig } from './earn.js';
import { accumulate, dayKeyOf, defaultEarnConfig, emptyDay, signalsFrom } from './earn.js';

export interface AdvanceInput {
  readonly sample: ActivitySample;
  readonly elapsedMs: number;
  readonly nowMs: number;
  /** Ce que l'installation sait mesurer. Détermine les profils, donc les quêtes tirées. */
  readonly evidence?: Evidence;
  /** Hachages des commits relevés à cet instant. Fusionnés avec ceux déjà comptés. */
  readonly observedCommits?: readonly string[];
  /** Tâches achevées aujourd'hui, quand la liste interne existe. */
  readonly tasksDone?: number;
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
  const evidence: Evidence = input.evidence ?? noEvidence;

  const day = state.day ?? emptyDay(dayKeyOf(input.nowMs));
  const earned = accumulate(day, input.sample, input.elapsedMs, input.nowMs, earnConfig);

  const { dayKey } = earned.day;
  const git = mergeCommits(state.git, dayKey, input.observedCommits ?? []);
  const questState = state.quests ?? emptyQuests(dayKey);

  const outcome = evaluateQuests(
    dayKey,
    deriveProfiles(evidence),
    signalsFrom(earned.day, {
      commits: git.hashes.length,
      tasksDone: input.tasksDone ?? 0,
    }),
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
      git,
    },
    gainedBase: earned.xp,
    gainedQuests: outcome.xp,
    leveledTo: level > state.creature.level ? level : null,
    quests: outcome.quests,
    completedQuests: outcome.completed,
  };
}
