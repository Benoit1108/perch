import type { QuestDefinition, QuestProfile, QuestSignals } from './catalog.js';
import { poolFor } from './catalog.js';

export interface QuestConfig {
  /** Nombre de quêtes proposées chaque jour. Identique pour TOUS les profils. */
  readonly perDay: number;
  /** Plafond quotidien d'expérience issue des quêtes. */
  readonly dailyCap: number;
}

export const defaultQuestConfig: QuestConfig = { perDay: 3, dailyCap: 200 };

/** Quêtes déjà récompensées aujourd'hui. */
export interface QuestState {
  readonly dayKey: string;
  readonly claimed: readonly string[];
}

export const emptyQuests = (dayKey: string): QuestState => ({ dayKey, claimed: [] });

export interface QuestView {
  readonly id: string;
  readonly labelKey: string;
  readonly target: number;
  readonly progress: number;
  readonly done: boolean;
  readonly claimed: boolean;
}

export interface QuestOutcome {
  readonly quests: readonly QuestView[];
  readonly state: QuestState;
  /** Expérience accordée à cet appel. Nulle si rien de nouveau n'a été achevé. */
  readonly xp: number;
  readonly completed: readonly string[];
}

/**
 * Hachage déterministe (FNV-1a).
 *
 * Le tirage du jour doit être reproductible : deux lancements le même jour proposent les
 * mêmes quêtes, et un test peut vérifier l'équité entre profils. `Math.random()` rendrait
 * l'un et l'autre impossibles.
 */
function hash(input: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/**
 * Tirage du jour : `perDay` quêtes, les mêmes à chaque appel pour un jour donné.
 *
 * Le nombre est identique quel que soit le profil. C'est la moitié de la garantie
 * d'équité ; l'autre moitié est que chaque quête vaut le même montant.
 */
export function questsForDay(
  dayKey: string,
  profiles: readonly QuestProfile[],
  config: QuestConfig
): readonly QuestDefinition[] {
  const pool = [...poolFor(profiles)];
  pool.sort((a, b) => hash(dayKey + a.id) - hash(dayKey + b.id) || a.id.localeCompare(b.id));
  return pool.slice(0, Math.min(config.perDay, pool.length));
}

/** Valeur d'une quête : le plafond réparti à parts égales, arrondi à l'entier inférieur. */
export function rewardPerQuest(config: QuestConfig): number {
  return config.perDay <= 0 ? 0 : Math.floor(config.dailyCap / config.perDay);
}

/**
 * Évalue les quêtes du jour et accorde l'expérience des nouvelles réussites.
 *
 * Le plafond n'est pas une limite qu'on approche : c'est une répartition. Ajouter une
 * source ne peut donc jamais faire gagner davantage, seulement changer ce qu'on fait pour
 * y arriver.
 */
export function evaluateQuests(
  dayKey: string,
  profiles: readonly QuestProfile[],
  signals: QuestSignals,
  state: QuestState,
  config: QuestConfig
): QuestOutcome {
  const base = state.dayKey === dayKey ? state : emptyQuests(dayKey);
  const selection = questsForDay(dayKey, profiles, config);
  const reward = rewardPerQuest(config);

  const claimed = new Set(base.claimed);
  const completed: string[] = [];

  const quests = selection.map((quest): QuestView => {
    const progress = Math.max(0, quest.measure(signals));
    const done = progress >= quest.target;

    if (done && !claimed.has(quest.id)) {
      claimed.add(quest.id);
      completed.push(quest.id);
    }

    return {
      id: quest.id,
      labelKey: quest.labelKey,
      target: quest.target,
      progress: Math.min(progress, quest.target),
      done,
      claimed: claimed.has(quest.id),
    };
  });

  return {
    quests,
    state: { dayKey, claimed: [...claimed] },
    xp: completed.length * reward,
    completed,
  };
}
