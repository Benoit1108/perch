#!/usr/bin/env node
//
// Limite de taille des fichiers, pour TOUT le code source.
//
// ESLint la tenait déjà, mais uniquement sur le TypeScript. Les pages de rendu y
// échappaient, et l'une d'elles avait dérivé à 361 lignes en embarquant du style, du
// balisage et de la logique — trois responsabilités qu'aucune règle ne séparait plus.
//
// Les lignes vides et les commentaires ne comptent pas : la règle vise la quantité de
// code à tenir en tête, pas la quantité d'explications. C'est la même convention que
// `max-lines` côté ESLint, pour que les deux verdicts ne se contredisent jamais.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const LIMITE = 200;
const EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs', '.html', '.css', '.py', '.sh']);

// Les tests décrivent des cas, pas des responsabilités : les brider pousserait à en
// écrire moins. Même exemption que dans la configuration ESLint.
const EXEMPTS = /\.test\.ts$/;

const DEBUTS_DE_COMMENTAIRE = ['//', '/*', '*', '#', '<!--'];

/** Une ligne qui pèse : ni vide, ni purement explicative. */
function compte(contenu) {
  return contenu
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== '')
    .filter((ligne) => !DEBUTS_DE_COMMENTAIRE.some((debut) => ligne.startsWith(debut))).length;
}

// `--others --exclude-standard` : un fichier tout juste écrit n'est pas encore suivi, et
// c'est précisément le moment où sa taille se décide.
const suivis = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((chemin) => chemin !== '' && EXTENSIONS.has(extname(chemin)) && !EXEMPTS.test(chemin));

const trop = suivis
  .map((chemin) => ({ chemin, lignes: compte(readFileSync(chemin, 'utf8')) }))
  .filter(({ lignes }) => lignes > LIMITE)
  .sort((a, b) => b.lignes - a.lignes);

if (trop.length > 0) {
  for (const { chemin, lignes } of trop) {
    console.error(`max-lines : ${chemin} — ${String(lignes)} lignes de code (limite ${LIMITE})`);
  }
  process.exit(1);
}

console.log(`taille : ${String(suivis.length)} fichiers sous la limite de ${LIMITE} lignes.`);
