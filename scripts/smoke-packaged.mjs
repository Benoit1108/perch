#!/usr/bin/env node
//
// Vérifie ce qui sort de la construction.
//
// Produire un fichier ne prouve rien : la question est de savoir si l'application
// installée trouvera ses créatures. Deux chemins changent en passant du dépôt au paquet —
// celui du code compilé et celui des packs — et aucun test unitaire ne les emprunte.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SORTIE = 'release';

function dossierDeploye() {
  const candidats = readdirSync(SORTIE).filter((nom) => nom.endsWith('-unpacked'));
  const trouve = candidats[0];

  if (trouve === undefined) {
    throw new Error(`aucun dossier déployé dans ${SORTIE}/ — la construction n'a rien produit`);
  }
  return join(SORTIE, trouve);
}

function installeur() {
  const trouve = readdirSync(SORTIE).filter(
    (nom) => nom.endsWith('.exe') || nom.endsWith('.AppImage') || nom.endsWith('.deb')
  );

  if (trouve.length === 0) throw new Error(`aucun installeur dans ${SORTIE}/`);
  return trouve;
}

function packsLivres(ressources) {
  const racine = join(ressources, 'packs');
  if (!existsSync(racine)) {
    throw new Error(
      'aucun pack dans les ressources : l’application installée afficherait un compagnon ' +
        'sans visage. Lancer `npm run pack:fetch` avant de construire.'
    );
  }

  const packs = readdirSync(racine).filter((nom) => existsSync(join(racine, nom, 'manifest.json')));
  if (packs.length === 0) throw new Error('les ressources contiennent un dossier packs, mais vide');
  return packs;
}

try {
  const deploye = dossierDeploye();
  const ressources = join(deploye, 'resources');

  const asar = join(ressources, 'app.asar');
  if (!existsSync(asar)) throw new Error(`${asar} manquant : le code n'a pas été empaqueté`);

  const packs = packsLivres(ressources);
  const artefacts = installeur();

  console.log(`Paquet vérifié dans ${deploye}`);
  console.log(`  archive   ${(statSync(asar).size / 1024 / 1024).toFixed(1)} Mo`);
  console.log(`  packs     ${packs.join(', ')}`);
  console.log(`  installeur ${artefacts.join(', ')}`);
} catch (erreur) {
  console.error(`Paquet refusé : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exit(1);
}
