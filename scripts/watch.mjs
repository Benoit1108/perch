// Ajoute le dépôt git courant à la liste surveillée.
//
// On ne devine JAMAIS où sont rangés les dépôts : il n'existe aucune convention
// (~/repositories, ~/dev, ~/Projects, ~/code…) et se tromper signifie soit ne rien
// trouver, soit fouiller là où on n'a rien à faire. Le dépôt s'annonce lui-même, depuis
// l'intérieur — au moment où l'utilisateur y est déjà.
//
//   npm run watch              # ajoute le dépôt courant
//   npm run watch -- --voisins # ajoute aussi les dépôts frères du dossier parent
//   npm run watch -- --liste   # affiche la liste surveillée
//
// ⚠️ Le calcul du chemin doit rester IDENTIQUE à packages/app/src/config/repos.ts.
// Il n'est pas importé à dessein : la commande doit fonctionner sans `dist/`.
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const base = process.env.XDG_CONFIG_HOME ?? `${homedir()}/.config`;
const configPath = `${base}/perch/config.json`;

async function readConfig() {
  try {
    const parsed = JSON.parse(await readFile(configPath, 'utf8'));
    return { repos: Array.isArray(parsed.repos) ? parsed.repos : [] };
  } catch {
    return { repos: [] };
  }
}

async function writeConfig(config) {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

async function repoRoot(from) {
  const { stdout } = await run('git', ['-C', from, 'rev-parse', '--show-toplevel']);
  return stdout.trim();
}

async function siblingsOf(root) {
  const parent = dirname(root);
  const entries = await readdir(parent, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(parent, entry.name);
    try {
      found.push(await repoRoot(candidate));
    } catch {
      // Pas un dépôt : on passe.
    }
  }
  return found;
}

const args = process.argv.slice(2);
const config = await readConfig();

if (args.includes('--liste')) {
  console.log(
    config.repos.length === 0
      ? 'Aucun depot surveille.'
      : `Depots surveilles (${config.repos.length}) :\n  ${config.repos.join('\n  ')}`
  );
  process.exit(0);
}

let root;
try {
  root = await repoRoot(resolve(process.cwd()));
} catch {
  console.error("Le dossier courant n'est pas un depot git.");
  process.exit(1);
}

const ajouts = args.includes('--voisins') ? await siblingsOf(root) : [root];
const avant = new Set(config.repos);
const apres = [...new Set([...config.repos, ...ajouts])];
const nouveaux = apres.filter((r) => !avant.has(r));

await writeConfig({ ...config, repos: apres });

if (nouveaux.length === 0) {
  console.log('Deja surveille. Rien a faire.');
} else {
  console.log(`Ajoute (${nouveaux.length}) :\n  ${nouveaux.join('\n  ')}`);
  if (!args.includes('--voisins')) {
    console.log(
      `\nAstuce : \`npm run watch -- --voisins\` ajoute les depots freres de ${dirname(root)}`
    );
  }
}
console.log(`\nTotal surveille : ${apres.length}. Configuration : ${configPath}`);
