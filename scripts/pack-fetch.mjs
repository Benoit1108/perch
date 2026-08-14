#!/usr/bin/env node
//
// Lance le fabricant de pack avec l'interpréteur Python qui existe ici.
//
// `python3` n'est pas un nom universel : il est la norme sur Linux et macOS, absent de
// beaucoup d'installations Windows où seul `python` répond. Écrire l'un ou l'autre dans le
// script npm, c'est choisir la moitié des machines sur lesquelles la commande marchera.
import { spawnSync } from 'node:child_process';

const CANDIDATS = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3'];

function disponible(commande) {
  const essai = spawnSync(commande, ['--version'], { stdio: 'ignore' });
  return essai.error === undefined && essai.status === 0;
}

const interpreteur = CANDIDATS.find(disponible);

if (interpreteur === undefined) {
  console.error(`Python introuvable — essayé : ${CANDIDATS.join(', ')}.`);
  console.error('Le pack de créatures se fabrique avec Python 3 et Pillow.');
  process.exit(1);
}

const resultat = spawnSync(interpreteur, ['scripts/fetch-pack.py', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(resultat.status ?? 1);
