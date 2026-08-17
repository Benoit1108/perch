import type { MessageKey } from '../i18n/catalog.js';

/**
 * Quatre registres, par ordre de priorité décroissante.
 *
 * L'ordre n'est pas décoratif : quand plusieurs choses veulent être dites, la file écarte
 * les moins importantes au lieu de les empiler. Un compagnon qui rattrape son retard de
 * bavardage après une réunion est insupportable.
 */
const PRIORITY = {
  evenement: 0,
  interaction: 1,
  humeur: 2,
  bavardage: 3,
} as const;

/** Dérivé de la table : la liste et les priorités ne peuvent pas se contredire. */
export type SpeechRegister = keyof typeof PRIORITY;

export interface SpeechRequest {
  readonly key: MessageKey;
  readonly register: SpeechRegister;
  readonly params?: Readonly<Record<string, string | number>>;
}

/** Ce que le moteur doit savoir du contexte pour décider de se taire. */
export interface SpeechContext {
  readonly nowMs: number;
  /** L'utilisateur est en période de concentration. */
  readonly focused: boolean;
  /** Une application est en plein écran : visioconférence, présentation, jeu. */
  readonly fullscreen: boolean;
}

export interface SpeechConfig {
  /**
   * Silence minimal avant de reparler, PAR REGISTRE.
   *
   * Un seuil unique ne pouvait pas convenir : réglé assez haut pour que le bavardage reste
   * discret, il retenait aussi les réactions. Le compagnon disait alors une phrase au
   * démarrage et plus rien — chaque alt-tab, chaque fenêtre réduite était mise en file,
   * puis jetée pour cause de péremption avant d'avoir eu le droit d'être dite.
   *
   * Une montée de niveau doit sortir presque tout de suite ; une remarque de fond peut
   * attendre.
   */
  readonly minIntervalMs: Readonly<Record<SpeechRegister, number>>;
  /** Taille maximale de la file. Au-delà, la moins prioritaire est écartée. */
  readonly maxQueue: number;
  /** Au-delà de cet âge, une demande n'a plus de sens et est abandonnée. */
  readonly staleAfterMs: number;
}

export const defaultSpeechConfig: SpeechConfig = {
  minIntervalMs: {
    evenement: 5_000,
    interaction: 15_000,
    humeur: 45_000,
    bavardage: 90_000,
  },
  maxQueue: 3,
  staleAfterMs: 2 * 60_000,
};

interface Pending extends SpeechRequest {
  readonly at: number;
}

export interface SpeechState {
  readonly lastSpokeAt: number | null;
  readonly queue: readonly Pending[];
}

export const emptySpeech: SpeechState = { lastSpokeAt: null, queue: [] };

const byPriority = (a: Pending, b: Pending): number =>
  PRIORITY[a.register] - PRIORITY[b.register] || a.at - b.at;

/**
 * Dépose une demande.
 *
 * La file est bornée et triée : au-delà de `maxQueue`, c'est la demande la MOINS
 * prioritaire qui disparaît, pas la plus ancienne. Un bavardage n'a jamais à évincer une
 * montée de niveau.
 *
 * Seul l'horodatage est requis : les règles de silence s'appliquent au moment de PARLER,
 * pas au moment de demander. Exiger un contexte complet ici laisserait croire qu'une
 * demande peut être refusée à l'entrée.
 */
export function say(
  state: SpeechState,
  request: SpeechRequest,
  nowMs: number,
  config: SpeechConfig
): SpeechState {
  const queue = [...state.queue, { ...request, at: nowMs }]
    .filter((pending) => nowMs - pending.at <= config.staleAfterMs)
    .sort(byPriority)
    .slice(0, config.maxQueue);

  return { ...state, queue };
}

/**
 * Décide s'il est permis de dire CETTE demande maintenant.
 *
 * INVARIANT I6 — silence pendant la concentration et en plein écran. Le compagnon
 * n'interrompt pas ce que l'économie d'expérience récompense, et ne s'affiche pas
 * par-dessus une visioconférence.
 *
 * Le délai dépend du registre de la demande : il serait absurde de faire attendre une
 * évolution le temps qu'on ferait patienter un bavardage.
 */
export function canSpeak(
  state: SpeechState,
  context: SpeechContext,
  config: SpeechConfig,
  register: SpeechRegister
): boolean {
  if (context.focused || context.fullscreen) return false;
  if (state.lastSpokeAt === null) return true;
  return context.nowMs - state.lastSpokeAt >= config.minIntervalMs[register];
}

export interface SpeechPull {
  readonly state: SpeechState;
  /** Message à afficher, ou `null` s'il faut se taire. */
  readonly speak: SpeechRequest | null;
}

/**
 * Retire la prochaine bulle à afficher, si les conditions le permettent.
 *
 * Les demandes périmées sont écartées même quand on ne parle pas : une réaction à un
 * événement d'il y a dix minutes n'a plus de sens.
 */
export function pull(state: SpeechState, context: SpeechContext, config: SpeechConfig): SpeechPull {
  const fresh = state.queue.filter((pending) => context.nowMs - pending.at <= config.staleAfterMs);

  const [next, ...rest] = fresh;
  if (next === undefined || !canSpeak(state, context, config, next.register)) {
    return { state: { ...state, queue: fresh }, speak: null };
  }

  return {
    state: { lastSpokeAt: context.nowMs, queue: rest },
    speak: { key: next.key, register: next.register, ...(next.params && { params: next.params }) },
  };
}
