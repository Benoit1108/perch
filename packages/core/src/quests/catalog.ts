/**
 * Catalogue des quêtes quotidiennes.
 *
 * INVARIANT I4 — le profil ne change QUE le contenu des quêtes, jamais leur valeur. Un
 * développeur et quelqu'un qui n'ouvre jamais un terminal reçoivent le même nombre de
 * quêtes, pour le même total d'expérience. « Trois commits » et « deux heures de
 * concentration » valent exactement pareil.
 *
 * C'est ce qui empêche l'apparition de deux populations : celle qui joue le vrai jeu et
 * celle qui joue une version bridée.
 */

export type QuestProfile = 'universel' | 'dev' | 'taches';

/** Ce qu'on sait de la journée. Chaque signal absent vaut zéro, jamais `undefined`. */
export interface QuestSignals {
  readonly activeMs: number;
  readonly focusMs: number;
  /** Nombre d'applications distinctes utilisées aujourd'hui. */
  readonly distinctApps: number;
  /** Pauses d'au moins cinq minutes prises pendant une journée de travail. */
  readonly breaks: number;
  readonly commits: number;
  readonly tasksDone: number;
}

export const noSignals: QuestSignals = {
  activeMs: 0,
  focusMs: 0,
  distinctApps: 0,
  breaks: 0,
  commits: 0,
  tasksDone: 0,
};

export interface QuestDefinition {
  readonly id: string;
  readonly profile: QuestProfile;
  /** Clé de traduction. Invariant I8 : aucun texte d'interface en dur. */
  readonly labelKey: string;
  readonly target: number;
  /** Avancement brut, dans la même unité que `target`. */
  readonly measure: (signals: QuestSignals) => number;
}

const HEURE = 3_600_000;

/**
 * Les quêtes universelles doivent rester réalisables SANS aucune source branchée : elles
 * ne s'appuient que sur la mesure d'inactivité, disponible partout.
 */
const UNIVERSELLES: readonly QuestDefinition[] = [
  {
    id: 'concentration-2h',
    profile: 'universel',
    labelKey: 'quest.focus2h',
    target: 2 * HEURE,
    measure: (s) => s.focusMs,
  },
  {
    id: 'actif-3h',
    profile: 'universel',
    labelKey: 'quest.active3h',
    target: 3 * HEURE,
    measure: (s) => s.activeMs,
  },
  {
    id: 'trois-applications',
    profile: 'universel',
    labelKey: 'quest.threeApps',
    target: 3,
    measure: (s) => s.distinctApps,
  },
  {
    id: 'une-pause',
    profile: 'universel',
    labelKey: 'quest.oneBreak',
    target: 1,
    measure: (s) => s.breaks,
  },
];

const DEV: readonly QuestDefinition[] = [
  {
    id: 'trois-commits',
    profile: 'dev',
    labelKey: 'quest.threeCommits',
    target: 3,
    measure: (s) => s.commits,
  },
  {
    id: 'un-commit',
    profile: 'dev',
    labelKey: 'quest.oneCommit',
    target: 1,
    measure: (s) => s.commits,
  },
];

const TACHES: readonly QuestDefinition[] = [
  {
    id: 'cinq-taches',
    profile: 'taches',
    labelKey: 'quest.fiveTasks',
    target: 5,
    measure: (s) => s.tasksDone,
  },
];

export const CATALOG: readonly QuestDefinition[] = [...UNIVERSELLES, ...DEV, ...TACHES];

/** Quêtes disponibles pour un ensemble de profils actifs. */
export function poolFor(profiles: readonly QuestProfile[]): readonly QuestDefinition[] {
  const actifs = new Set<QuestProfile>([...profiles, 'universel']);
  return CATALOG.filter((quest) => actifs.has(quest.profile));
}
