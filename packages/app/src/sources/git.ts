import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Relève les commits du jour dans les dépôts surveillés.
 *
 * TROIS RÈGLES qui rendent le comptage honnête, et qui sont l'essentiel du sujet :
 *
 * 1. **On ne lit que des hachages.** Jamais un message, un nom de fichier ou un diff. Le
 *    message dirait SUR QUOI tu travailles ; le hachage dit seulement QUE tu as
 *    travaillé. Même discipline que « classe WM plutôt que titre de fenêtre ».
 * 2. **Filtré sur l'adresse git DU DÉPÔT.** Elle varie d'un dépôt à l'autre — comptes
 *    personnel et professionnel — et sans ce filtre un `git pull` créditerait le travail
 *    des collègues.
 * 3. Le dédoublonnage par hachage est fait en amont, dans `core` : un `rebase` réécrit
 *    les identifiants et ferait sinon recompter la matinée.
 */
export async function collectCommits(repos: readonly string[]): Promise<readonly string[]> {
  const perRepo = await Promise.all(repos.map((repo) => commitsIn(repo)));
  return perRepo.flat();
}

async function commitsIn(repo: string): Promise<readonly string[]> {
  const email = await gitConfigEmail(repo);
  if (email === null) return [];

  try {
    const { stdout } = await run(
      'git',
      ['-C', repo, 'log', `--author=${email}`, '--since=midnight', '--format=%H'],
      { timeout: 5_000 }
    );
    return stdout.split('\n').filter((line) => line.length > 0);
  } catch {
    // Dépôt déplacé, supprimé ou illisible : on l'ignore. Une quête ne doit jamais
    // interrompre la boucle du compagnon.
    return [];
  }
}

/** Adresse effective du dépôt, `includeIf` compris. */
async function gitConfigEmail(repo: string): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['-C', repo, 'config', 'user.email'], { timeout: 5_000 });
    const email = stdout.trim();
    return email.length > 0 ? email : null;
  } catch {
    return null;
  }
}
