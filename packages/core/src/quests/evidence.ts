import type { QuestProfile } from './catalog.js';

/** Ce que l'installation prouve savoir mesurer. */
export interface Evidence {
  /** Dépôts git explicitement surveillés par l'utilisateur. */
  readonly watchedRepos: number;
  /** Tâches créées dans la liste interne. */
  readonly tasks: number;
}

export const noEvidence: Evidence = { watchedRepos: 0, tasks: 0 };

/**
 * Profils actifs, DÉDUITS de ce qu'on sait mesurer — jamais d'une case à cochée.
 *
 * Une quête qu'on ne sait pas mesurer ne doit jamais être tirée : elle resterait à zéro
 * pour toujours et priverait le joueur d'un tiers de sa journée. Lier le profil à la
 * preuve rend cette situation impossible par construction, plutôt que de compter sur
 * l'utilisateur pour ne pas cocher une case qui ne le concerne pas.
 *
 * Sans aucune preuve, le pool universel s'applique — et il constitue un jeu complet.
 */
export function deriveProfiles(evidence: Evidence): readonly QuestProfile[] {
  const profiles: QuestProfile[] = [];
  if (evidence.watchedRepos > 0) profiles.push('dev');
  if (evidence.tasks > 0) profiles.push('taches');
  return profiles;
}

/** Commits distincts retenus pour la journée. */
export interface CommitLog {
  readonly dayKey: string;
  readonly hashes: readonly string[];
}

/**
 * Fusionne les commits observés avec ceux déjà comptés aujourd'hui.
 *
 * Le dédoublonnage par hachage n'est pas une précaution théorique : `git rebase` et
 * `git commit --amend` réécrivent les identifiants. Sans mémoire des hachages déjà vus,
 * réécrire l'historique du matin ferait re-valider la quête l'après-midi — et récompenser
 * deux fois le même travail.
 */
export function mergeCommits(
  previous: CommitLog | undefined,
  dayKey: string,
  observed: readonly string[]
): CommitLog {
  const base = previous?.dayKey === dayKey ? previous.hashes : [];
  return { dayKey, hashes: [...new Set([...base, ...observed])] };
}
