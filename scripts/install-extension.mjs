// Installe l'extension GNOME dans le dossier des extensions utilisateur.
//
// ⚠️ CONSTAT (GNOME 50, Wayland) : RIEN ne recharge le code d'une extension sans rouvrir
// la session.
//
//   - `gnome-extensions disable` puis `enable` ne relit PAS le fichier : depuis GNOME 45
//     les extensions sont des modules ESM, et le module reste en cache.
//   - `org.gnome.Shell.Extensions.ReloadExtension` est déclarée sur D-Bus mais répond
//     « Method ReloadExtension is not implemented ».
//
// Ce script copie donc les fichiers et le dit franchement : la nouvelle version ne prendra
// effet qu'à la prochaine ouverture de session.
import { cp, mkdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'packages/shell/dist');

const metadata = JSON.parse(await readFile(join(dist, 'metadata.json'), 'utf8'));
const { uuid } = metadata;
const target = join(homedir(), '.local/share/gnome-shell/extensions', uuid);

await mkdir(target, { recursive: true });
for (const file of ['extension.js', 'metadata.json']) {
  await cp(join(dist, file), join(target, file));
}
console.log(`Installee dans ${target}`);

// On active l'extension si elle ne l'est pas — utile au tout premier passage. Cela ne
// recharge PAS le code d'une version déjà chargée (voir l'avertissement en tête).
try {
  await run('gnome-extensions', ['enable', uuid]);
} catch {
  console.log(
    'Activation impossible — GNOME ne connaitra l’extension qu’apres reouverture de session.'
  );
}

console.log('\n⚠️  Le code deja charge par GNOME n’est PAS remplace a chaud.');
console.log('   Fermer puis rouvrir la session pour que cette version prenne effet.');

// Piège vécu : un interrupteur global peut neutraliser TOUTES les extensions utilisateur,
// sans que `gnome-extensions enable` ne signale quoi que ce soit.
try {
  const { stdout } = await run('gsettings', ['get', 'org.gnome.shell', 'disable-user-extensions']);
  if (stdout.trim() === 'true') {
    console.log('\n⚠️  Les extensions utilisateur sont desactivees globalement. Pour lever :');
    console.log('    gsettings set org.gnome.shell disable-user-extensions false');
  }
} catch {
  /* gsettings absent : rien à signaler */
}
