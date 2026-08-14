#!/usr/bin/env node
//
// Valide un pack fabriqué, avec le schéma que l'application utilisera vraiment.
//
// La validation vivait auparavant dans le script Python, réécrite à la main dans un autre
// langage — et elle en manquait déjà : format des identifiants de stade, bornes de niveau,
// nom non vide. Deux copies d'une même règle finissent toujours par diverger, et c'est
// justement le silence au démarrage qu'on cherchait à éviter : un pack invalide est ignoré
// sans un mot par `discoverPacks`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseCreaturePack } from '@perch/core';

const dossier = process.argv[2] ?? 'packs/perch-classic';
const manifeste = join(dossier, 'manifest.json');

let pack;
try {
  pack = parseCreaturePack(JSON.parse(readFileSync(manifeste, 'utf8')));
} catch (erreur) {
  console.error(`Manifeste refusé : ${manifeste}`);
  console.error(erreur instanceof Error ? erreur.message : String(erreur));
  process.exit(1);
}

const stades = pack.lines.reduce((total, ligne) => total + ligne.stages.length, 0);
console.log(`Pack « ${pack.name} » validé : ${pack.lines.length} lignées, ${stades} stades.`);
