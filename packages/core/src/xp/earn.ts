import type { QuestSignals } from '../quests/catalog.js';
/**
 * Le socle d'expérience : la part identique pour tout le monde.
 *
 * INVARIANT I4 — ce calcul ne connaît ni git, ni Claude Code, ni aucune source
 * spécialisée. Quatre cinquièmes de la progression viennent d'ici, à l'identique pour un
 * développeur et pour quelqu'un qui n'ouvre jamais un terminal. Les sources spécialisées
 * remplissent des quêtes plafonnées (S4), elles n'ajoutent jamais d'expérience ici.
 *
 * INVARIANT I1 — l'activité se mesure à une durée d'inactivité fournie par le système.
 * Aucune frappe n'est lue.
 */

export interface EarnConfig {
  /** Au-delà de cette inactivité, le temps ne compte plus. */
  readonly idleThresholdMs: number;
  readonly baseXpPerMinute: number;
  /** Multiplicateur appliqué après une durée continue dans la même application. */
  readonly focusMultiplier: number;
  readonly focusAfterMs: number;
  /** Rendements décroissants au-delà de cette durée active dans la journée. */
  readonly diminishAfterMs: number;
  readonly diminishMultiplier: number;
}

export const defaultEarnConfig: EarnConfig = {
  idleThresholdMs: 60_000,
  baseXpPerMinute: 3,
  focusMultiplier: 1.5,
  focusAfterMs: 20 * 60_000,
  diminishAfterMs: 6 * 3_600_000,
  diminishMultiplier: 0.5,
};

/** Compteurs remis à zéro chaque jour. */
export interface DailyActivity {
  /** Jour UTC au format `AAAA-MM-JJ`. */
  readonly dayKey: string;
  readonly activeMs: number;
  readonly focusApp: string | null;
  readonly focusMs: number;
  /** Applications distinctes vues aujourd'hui. Alimente une quête universelle. */
  readonly apps: readonly string[];
  /** Pauses achevées d'au moins `breakAfterMs`. */
  readonly breaks: number;
  /** Inactivité continue en cours. Devient une pause quand l'activité reprend. */
  readonly idleRunMs: number;
}

/** Durée d'inactivité au-delà de laquelle une absence compte comme une vraie pause. */
export const BREAK_AFTER_MS = 5 * 60_000;

export interface ActivitySample {
  readonly idleMs: number;
  readonly app: string | null;
}

/** Jour UTC. L'UTC évite qu'un fuseau ou un changement d'heure crée ou efface une journée. */
export function dayKeyOf(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function emptyDay(dayKey: string): DailyActivity {
  return {
    dayKey,
    activeMs: 0,
    focusApp: null,
    focusMs: 0,
    apps: [],
    breaks: 0,
    idleRunMs: 0,
  };
}

/** Ajoute une application à la liste du jour, sans doublon et sans muter l'entrée. */
function withApp(apps: readonly string[], app: string | null): readonly string[] {
  if (app === null || apps.includes(app)) return apps;
  return [...apps, app];
}

export interface EarnResult {
  readonly day: DailyActivity;
  /** Expérience gagnée sur ce pas. Fractionnaire : l'arrondi n'a lieu qu'à l'affichage. */
  readonly xp: number;
}

/**
 * Un pas d'accumulation. Fonction pure.
 *
 * Les rendements décroissants sont évalués sur le temps actif AVANT ce pas : un pas ne
 * peut donc pas être coupé en deux à la frontière des 6 heures. La simplification est
 * invisible à l'échelle d'un tick d'une minute, et elle garde la fonction lisible.
 */
export function accumulate(
  day: DailyActivity,
  sample: ActivitySample,
  elapsedMs: number,
  nowMs: number,
  config: EarnConfig
): EarnResult {
  const today = dayKeyOf(nowMs);
  const base = day.dayKey === today ? day : emptyDay(today);

  if (elapsedMs <= 0 || sample.idleMs >= config.idleThresholdMs) {
    // Inactif : le temps ne compte pas, la concentration est rompue, et l'absence
    // s'accumule — elle deviendra une pause si l'activité reprend.
    return {
      day: {
        ...base,
        focusApp: null,
        focusMs: 0,
        idleRunMs: base.idleRunMs + Math.max(elapsedMs, 0),
      },
      xp: 0,
    };
  }

  // L'activité reprend : une absence assez longue compte pour une pause. On la crédite au
  // RETOUR et non pendant l'absence — sinon une machine abandonnée accumulerait des pauses.
  const breaks = base.idleRunMs >= BREAK_AFTER_MS ? base.breaks + 1 : base.breaks;

  const sameApp = sample.app !== null && sample.app === base.focusApp;
  const priorFocusMs = sameApp ? base.focusMs : 0;
  const focusMs = priorFocusMs + elapsedMs;

  // Les DEUX multiplicateurs s'évaluent sur l'état ANTÉRIEUR au pas. Juger la
  // concentration sur la durée d'après accorderait le bonus au pas qui atteint le seuil,
  // alors que les rendements décroissants, eux, ne mordent qu'au pas suivant — deux
  // règles voisines qui se comporteraient différemment sans raison.
  let multiplier = 1;
  if (sample.app !== null && priorFocusMs >= config.focusAfterMs) {
    multiplier *= config.focusMultiplier;
  }
  if (base.activeMs >= config.diminishAfterMs) {
    multiplier *= config.diminishMultiplier;
  }

  const xp = (elapsedMs / 60_000) * config.baseXpPerMinute * multiplier;

  return {
    day: {
      dayKey: today,
      activeMs: base.activeMs + elapsedMs,
      focusApp: sample.app,
      focusMs,
      apps: withApp(base.apps, sample.app),
      breaks,
      idleRunMs: 0,
    },
    xp,
  };
}

/** Traduit les compteurs du jour en signaux de quêtes, complétés par les sources externes. */
export function signalsFrom(
  day: DailyActivity,
  external: { readonly commits: number; readonly tasksDone: number }
): QuestSignals {
  return {
    activeMs: day.activeMs,
    focusMs: day.focusMs,
    distinctApps: day.apps.length,
    breaks: day.breaks,
    commits: external.commits,
    tasksDone: external.tasksDone,
  };
}
