#!/usr/bin/env node
//
// Fabrique le catalogue des especes proposables.
//
// Du TEXTE, et rien d'autre : identifiants, noms, chaines d'evolution. Aucune image n'est
// versionnee (invariant I5) — les sprites se telechargent au moment ou quelqu'un choisit
// sa creature, dans son propre dossier.
//
// Deux sources, deux requetes :
//   - le pokedex de Showdown, qui donne les identifiants de sprites ET les chaines
//     d'evolution ;
//   - le jeu de donnees de PokeAPI, qui donne les noms traduits en un seul fichier.
//
// Usage : node scripts/build-species.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = join(RACINE, 'packages/app/assets/species.json');

const POKEDEX = 'https://play.pokemonshowdown.com/data/pokedex.json';
const NOMS =
  'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv';
/** Identifiant de langue francaise dans le jeu de donnees de PokeAPI. */
const FRANCAIS = '5';

async function recuperer(url) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${url} : ${String(reponse.status)}`);
  return reponse;
}

/** Noms francais, par numero du Pokedex national. */
async function nomsFrancais() {
  const csv = await (await recuperer(NOMS)).text();
  const [entete, ...lignes] = csv.trim().split('\n');
  const colonnes = entete.split(',');

  const noms = new Map();
  for (const ligne of lignes) {
    const valeurs = ligne.split(',');
    const champ = (nom) => valeurs[colonnes.indexOf(nom)];

    if (champ('local_language_id') === FRANCAIS) {
      noms.set(Number(champ('pokemon_species_id')), champ('name'));
    }
  }
  return noms;
}

/**
 * Les familles, une par premiere forme.
 *
 * On indexe par FAMILLE et non par espece : quelqu'un qui choisit Ectoplasma veut la
 * lignee, et la commencera en Fantominus — c'est son niveau qui decide du stade affiche.
 *
 * Les evolutions qui se separent en plusieurs branches ne gardent que la premiere. Evoli
 * en a huit ; les proposer toutes demanderait de choisir une branche a l'avance, ce que le
 * moteur ne sait pas exprimer.
 */
function chaine(depart, parNom, noms) {
  const stades = [];
  let courant = depart;

  while (courant !== undefined && stades.length < 3) {
    stades.push({
      id: courant.id,
      en: courant.name,
      fr: noms.get(courant.num) ?? courant.name,
    });
    const suivant = Array.isArray(courant.evos) ? courant.evos[0] : undefined;
    courant = suivant === undefined ? undefined : parNom.get(suivant);
  }

  return stades;
}

/** Une premiere forme, et rien d'autre : ni forme regionale, ni mega, ni gigamax. */
function estUneSouche(espece) {
  if (espece.forme !== undefined || espece.prevo !== undefined) return false;
  return typeof espece.num === 'number' && espece.num >= 1;
}

function familles(pokedex, noms) {
  const parNom = new Map();
  for (const [id, espece] of Object.entries(pokedex)) {
    if (typeof espece.name === 'string') parNom.set(espece.name, { id, ...espece });
  }

  const sortie = [];
  for (const [id, espece] of Object.entries(pokedex)) {
    if (!estUneSouche(espece)) continue;
    sortie.push({ id, num: espece.num, stages: chaine({ id, ...espece }, parNom, noms) });
  }

  return sortie.sort((a, b) => a.num - b.num);
}

const [pokedex, noms] = await Promise.all([(await recuperer(POKEDEX)).json(), nomsFrancais()]);

const catalogue = familles(pokedex, noms);

await mkdir(dirname(SORTIE), { recursive: true });
await writeFile(SORTIE, `${JSON.stringify(catalogue)}\n`, 'utf8');

const stades = catalogue.reduce((total, famille) => total + famille.stages.length, 0);
console.log(`${SORTIE} : ${String(catalogue.length)} familles, ${String(stades)} stades.`);
