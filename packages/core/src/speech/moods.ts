import type { PetState } from '../motion/pet.js';
import type { SpeechRequest } from './scheduler.js';

/** Ce que le compagnon perçoit de la situation, à un instant donné. */
export interface Mood {
  readonly state: PetState;
  /** Millisecondes depuis la dernière interaction de l'utilisateur. */
  readonly idleMs: number;
  /** Journée courante, pour reconnaître un nouveau jour. */
  readonly dayKey: string;
}

/** Inactivité à partir de laquelle il s'inquiète — bien avant de s'endormir lui-même. */
export const WONDERING_MS = 5 * 60_000;

/**
 * Ce que la situation inspire au compagnon, ou `null` s'il n'a rien à dire.
 *
 * Fonction des TRANSITIONS et non de l'état courant : sans cela, il redirait la même
 * chose à chaque passage de la boucle, et le cadenceur de parole passerait son temps à
 * écarter des demandes identiques.
 *
 * Ces trois phrases existaient dans le catalogue depuis S5 sans que rien ne les émette.
 * Le sommeil lui-même était inatteignable : la boucle transmettait une inactivité
 * toujours nulle au moteur, si bien que `sleepAfterMs` n'était jamais franchi.
 */
export function moodFor(previous: Mood | null, current: Mood): SpeechRequest | null {
  if (previous === null) return null;

  // Le premier passage d'une nouvelle journée. On salue quelqu'un qui est là, pas un
  // écran laissé allumé toute la nuit.
  if (previous.dayKey !== current.dayKey && current.idleMs < WONDERING_MS) {
    return { key: 'speech.greetMorning', register: 'humeur' };
  }

  if (previous.state !== 'sommeil' && current.state === 'sommeil') {
    return { key: 'speech.sleepy', register: 'humeur' };
  }

  // Au FRANCHISSEMENT du seuil seulement : tant que l'utilisateur reste absent, il se tait.
  if (previous.idleMs < WONDERING_MS && current.idleMs >= WONDERING_MS) {
    return { key: 'speech.idle', register: 'bavardage' };
  }

  return null;
}
