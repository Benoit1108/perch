import { readConfig } from '../config/repos.js';
import type { SourceSnapshot } from '../main/progression.js';
import { collectCommits } from './git.js';

/**
 * Relève l'état des sources spécialisées.
 *
 * La configuration est relue à CHAQUE appel : un `npm run watch` prend donc effet sans
 * redémarrer le compagnon. Le coût est un `readFile` par minute, largement inférieur à
 * celui d'une surveillance de fichier.
 */
export async function snapshotSources(): Promise<SourceSnapshot> {
  const config = await readConfig();

  return {
    // Le profil « dev » naît de la preuve — un dépôt surveillé — et non d'une case cochée.
    evidence: { watchedRepos: config.repos.length, tasks: 0 },
    observedCommits: await collectCommits(config.repos),
    // La liste de tâches interne arrive avec la fenêtre de réglages, en S5.
    tasksDone: 0,
  };
}
