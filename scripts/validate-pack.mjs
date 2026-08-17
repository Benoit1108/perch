#!/usr/bin/env node
//
// Valide un pack fabriqué, avec le schéma que l'application utilisera vraiment.
//
// La validation vivait auparavant dans le script Python, réécrite à la main dans un autre
// langage — et elle en manquait déjà : format des identifiants de stade, bornes de niveau,
// nom non vide. Deux copies d'une même règle finissent toujours par diverger, et c'est
// justement le silence au démarrage qu'on cherchait à éviter : un pack invalide est ignoré
// sans un mot par `discoverPacks`.
import { existsSync, readFileSync } from 'node:fs';
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

// Les images sont vérifiées SUR LE DISQUE, et pas seulement dans le manifeste : un chemin
// mal recopié passe le schéma sans difficulté, et la créature apparaît alors sans visage —
// exactement le genre de panne muette que ce script existe pour empêcher.
const manquantes = [];
for (const ligne of pack.lines) {
  for (const stade of ligne.stages) {
    const fichiers = [stade.sprite, ...Object.values(stade.clips).flatMap((clip) => clip.frames)];
    for (const fichier of new Set(fichiers)) {
      if (!existsSync(join(dossier, fichier))) manquantes.push(`${stade.id} → ${fichier}`);
    }
  }
}

if (manquantes.length > 0) {
  console.error(`Images absentes de ${dossier} :`);
  for (const manquante of manquantes) console.error(`  ${manquante}`);
  process.exit(1);
}

const stades = pack.lines.reduce((total, ligne) => total + ligne.stages.length, 0);
console.log(`Pack « ${pack.name} » validé : ${pack.lines.length} lignées, ${stades} stades.`);
