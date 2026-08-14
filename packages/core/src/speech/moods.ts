import type { PetState } from '../motion/pet.js';
import type { Rect } from '../ports/geometry.js';
import { sceneChanged } from '../world/scene.js';
import type { SpeechRequest } from './scheduler.js';

/** Ce que le compagnon perçoit de la situation, à un instant donné. */
export interface Mood {
  readonly state: PetState;
  /** Millisecondes depuis la dernière interaction de l'utilisateur. */
  readonly idleMs: number;
  /** Journée courante, pour reconnaître un nouveau jour. */
  readonly dayKey: string;
  /** Fenêtres visibles. Leur remplacement en bloc trahit un changement de bureau. */
  readonly windows: readonly Rect[];
  /** Application au premier plan. `null` quand la plateforme ne sait pas le dire. */
  readonly app: string | null;
  /** Le compagnon souffle-t-il, après avoir beaucoup bougé ? */
  readonly tired: boolean;
}

/** Inactivité à partir de laquelle il s'inquiète — bien avant de s'endormir lui-même. */
export const WONDERING_MS = 5 * 60_000;

/** Une situation reconnue, et ce qu'elle inspire. */
type Regle = (avant: Mood, apres: Mood) => SpeechRequest | null;

/** Le premier passage d'une nouvelle journée, quelqu'un étant là pour l'entendre. */
const bonjour: Regle = (avant, apres) =>
  avant.dayKey !== apres.dayKey && apres.idleMs < WONDERING_MS
    ? { key: 'speech.greetMorning', register: 'humeur' }
    : null;

const sendort: Regle = (avant, apres) =>
  avant.state !== 'sommeil' && apres.state === 'sommeil'
    ? { key: 'speech.sleepy', register: 'humeur' }
    : null;

/** Toutes les fenêtres remplacées d'un coup : on a changé d'espace de travail. */
const decor: Regle = (avant, apres) =>
  sceneChanged(avant.windows, apres.windows)
    ? { key: 'speech.newScene', register: 'bavardage' }
    : null;

/** Il vient de se hisser sur un perchoir : le moment où il est le plus fier. */
const perchoir: Regle = (avant, apres) =>
  avant.state === 'escalade' && apres.state === 'marche'
    ? { key: 'speech.perched', register: 'humeur' }
    : null;

const souffle: Regle = (avant, apres) =>
  !avant.tired && apres.tired ? { key: 'speech.tired', register: 'humeur' } : null;

/** Une fenêtre en moins sans que le reste bouge : on vient d'en réduire ou d'en fermer une. */
const fenetreEnMoins: Regle = (avant, apres) =>
  apres.windows.length < avant.windows.length
    ? { key: 'speech.windowGone', register: 'bavardage' }
    : null;

const fenetreEnPlus: Regle = (avant, apres) =>
  apres.windows.length > avant.windows.length
    ? { key: 'speech.windowNew', register: 'bavardage' }
    : null;

/**
 * Un alt-tab, un autre onglet, un autre chantier.
 *
 * Les deux valeurs doivent être connues : sans extension pour répondre, l'application vaut
 * `null` et inventer un changement le ferait parler à chaque relevé.
 */
const application: Regle = (avant, apres) =>
  avant.app !== null && apres.app !== null && avant.app !== apres.app
    ? { key: 'speech.switched', register: 'bavardage' }
    : null;

/** Au FRANCHISSEMENT du seuil seulement : tant que l'utilisateur reste absent, il se tait. */
const absence: Regle = (avant, apres) =>
  avant.idleMs < WONDERING_MS && apres.idleMs >= WONDERING_MS
    ? { key: 'speech.idle', register: 'bavardage' }
    : null;

/**
 * L'ordre EST la priorité : la première situation reconnue l'emporte.
 *
 * Saluer passe avant tout le reste, et une remarque sur les fenêtres ne doit pas éclipser
 * un endormissement.
 */
const REGLES: readonly Regle[] = [
  bonjour,
  sendort,
  decor,
  perchoir,
  souffle,
  fenetreEnMoins,
  fenetreEnPlus,
  application,
  absence,
];

/**
 * Ce que la situation inspire au compagnon, ou `null` s'il n'a rien à dire.
 *
 * Fonction des TRANSITIONS et non de l'état courant : sans cela, il redirait la même chose
 * à chaque passage de la boucle, et le cadenceur de parole passerait son temps à écarter
 * des demandes identiques.
 */
export function moodFor(previous: Mood | null, current: Mood): SpeechRequest | null {
  if (previous === null) return null;

  for (const regle of REGLES) {
    const inspiration = regle(previous, current);
    if (inspiration !== null) return inspiration;
  }
  return null;
}
