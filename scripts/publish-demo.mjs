#!/usr/bin/env node
//
// Publie le GIF de démonstration comme ressource de release.
//
// Il n'est PAS versionné dans le dépôt : il contient des sprites, ce que l'invariant I5
// interdit — « un DMCA ne peut pas viser un dépôt qui ne contient qu'un script de
// téléchargement ». Une ressource de release vit à côté du code, pas dedans.
//
// Le TYPE MIME compte : GitHub fait transiter les images du README par un relais qui
// refuse `application/octet-stream`, et `gh release upload` ne pose que celui-là. On passe
// donc par l'API, en déclarant `image/gif`, sans quoi le README affiche une image cassée.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const DEPOT = 'Benoit1108/perch';
const TAG = 'demo';
const FICHIER = 'release/demo.gif';

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

if (!existsSync(FICHIER)) {
  console.error(`${FICHIER} absent — lancer d'abord \`npm run demo\`.`);
  process.exit(1);
}

const release = gh(['api', `repos/${DEPOT}/releases/tags/${TAG}`, '--jq', '.id']);

// Une ressource de même nom ne peut pas coexister : on retire l'ancienne d'abord. L'URL
// publique, elle, ne change pas — c'est ce qui permet au README de la citer une fois pour
// toutes.
const ancienne = gh([
  'api',
  `repos/${DEPOT}/releases/${release}/assets`,
  '--jq',
  `.[] | select(.name=="demo.gif") | .id`,
]);

if (ancienne !== '') gh(['api', '-X', 'DELETE', `repos/${DEPOT}/releases/assets/${ancienne}`]);

const url = gh([
  'api',
  '--method',
  'POST',
  '-H',
  'Content-Type: image/gif',
  `https://uploads.github.com/repos/${DEPOT}/releases/${release}/assets?name=demo.gif`,
  '--input',
  FICHIER,
  '--jq',
  '.browser_download_url',
]);

console.log(`Démonstration publiée : ${url}`);
