import type { PerchState } from '../state/schema.js';
import { progressFor } from './curve.js';
import type { ActivitySample, DailyActivity, EarnConfig } from './earn.js';
import { accumulate, dayKeyOf, emptyDay } from './earn.js';

export interface CreatureProgress {
  readonly xp: number;
  readonly level: number;
}

export interface AdvanceResult {
  readonly creature: CreatureProgress;
  readonly day: DailyActivity;
  /** Gain de ce pas, pour l'affichage. */
  readonly gained: number;
  /** Niveau franchi pendant ce pas, `null` sinon. Sert à déclencher une réaction. */
  readonly leveledTo: number | null;
}

/**
 * Fait avancer la créature d'un pas.
 *
 * Point de jonction entre le socle d'expérience et la courbe de niveaux. Séparer les deux
 * n'est pas de la décoration : la courbe se rééquilibre sans toucher au calcul du temps
 * actif, et le socle se règle sans risquer de casser la monotonie des paliers.
 */
export function advance(
  creature: CreatureProgress,
  day: DailyActivity,
  sample: ActivitySample,
  elapsedMs: number,
  nowMs: number,
  config: EarnConfig
): AdvanceResult {
  const earned = accumulate(day, sample, elapsedMs, nowMs, config);
  const xp = creature.xp + earned.xp;
  const level = progressFor(xp).level;

  return {
    creature: { xp, level },
    day: earned.day,
    gained: earned.xp,
    leveledTo: level > creature.level ? level : null,
  };
}

export interface StateAdvance {
  readonly state: PerchState;
  readonly gained: number;
  readonly leveledTo: number | null;
}

/**
 * Même chose, appliqué à l'état complet.
 *
 * Les états écrits avant S3 n'ont pas de compteurs journaliers : on en fabrique un vide
 * plutôt que de refuser l'état. Personne ne doit perdre sa créature parce qu'une mise à
 * jour a ajouté un champ.
 */
export function advanceState(
  state: PerchState,
  sample: ActivitySample,
  elapsedMs: number,
  nowMs: number,
  config: EarnConfig
): StateAdvance {
  const day = state.day ?? emptyDay(dayKeyOf(nowMs));
  const result = advance(state.creature, day, sample, elapsedMs, nowMs, config);

  return {
    state: {
      ...state,
      creature: { ...state.creature, xp: result.creature.xp, level: result.creature.level },
      day: result.day,
    },
    gained: result.gained,
    leveledTo: result.leveledTo,
  };
}
