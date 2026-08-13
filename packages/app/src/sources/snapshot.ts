import { readConfig, tasksDoneOn } from '../config/repos.js';
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
  const today = new Date().toISOString().slice(0, 10);

  return {
    // Les profils naissent des PREUVES — un dépôt surveillé, une tâche créée — et non de
    // cases cochées. Une quête qu'aucune source ne sait mesurer n'est jamais proposée.
    evidence: { watchedRepos: config.repos.length, tasks: config.tasks.length },
    observedCommits: await collectCommits(config.repos),
    tasksDone: tasksDoneOn(config, today),
  };
}
