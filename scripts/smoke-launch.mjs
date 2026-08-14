#!/usr/bin/env node
//
// Lance l'application EMPAQUETÉE et exige qu'elle démarre pour de bon.
//
// Vérifier que le fichier existe ne prouve presque rien : les deux façons de casser un
// paquet ne se voient qu'à l'exécution. Un chemin qui ne survit pas à l'empaquetage — le
// compagnon démarre alors sans visage — et les fusibles Electron, qui peuvent refuser de
// charger une archive qu'ils jugent altérée.
//
// L'application s'arrête d'elle-même grâce à `PERCH_TIMEOUT`. On exige un code de sortie
// nul ET la ligne d'annonce, qui ne s'affiche qu'une fois l'état lu et les capteurs choisis.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SORTIE = 'release';
const SECONDES = 20;

/** Le binaire déployé, quel que soit le système qui l'a produit. */
function executable() {
  const deploye = readdirSync(SORTIE).find((nom) => nom.endsWith('-unpacked'));
  if (deploye === undefined) throw new Error(`aucun dossier déployé dans ${SORTIE}/`);

  const dossier = join(SORTIE, deploye);
  const candidats = ['Perch.exe', 'perch'];
  const trouve = candidats.map((nom) => join(dossier, nom)).find((chemin) => existsSync(chemin));

  if (trouve === undefined) {
    throw new Error(`aucun exécutable dans ${dossier} — cherché : ${candidats.join(', ')}`);
  }
  return trouve;
}

try {
  const binaire = executable();
  console.log(`Lancement de ${binaire} (arrêt automatique dans ${String(SECONDES)} s)…`);

  // `--no-sandbox` uniquement ici, et uniquement sur Linux : le bac à sable de Chromium
  // exige un binaire auxiliaire `setuid root`, que l'AppImage installe mais que le dossier
  // déployé brut ne porte pas. Le paquet réellement distribué, lui, garde son bac à sable.
  const drapeaux = process.platform === 'linux' ? ['--ozone-platform=x11', '--no-sandbox'] : [];
  const resultat = spawnSync(binaire, drapeaux, {
    encoding: 'utf8',
    timeout: (SECONDES + 40) * 1000,
    env: { ...process.env, PERCH_TIMEOUT: String(SECONDES) },
  });

  const sortie = `${resultat.stdout ?? ''}${resultat.stderr ?? ''}`;

  if (resultat.status !== 0) {
    throw new Error(`code de sortie ${String(resultat.status)}\n${sortie.slice(-2000)}`);
  }
  if (!sortie.includes('[perch]')) {
    throw new Error(`démarrage muet : aucune trace du processus principal\n${sortie.slice(-2000)}`);
  }
  if (/aucun pack de creatures/u.test(sortie)) {
    throw new Error(`l'application installée ne trouve pas ses créatures\n${sortie.slice(-2000)}`);
  }

  const annonce = /\[perch\] (.+) niveau \d+/u.exec(sortie);
  console.log(`Démarrage vérifié — ${annonce?.[1] ?? 'compagnon'} est en place.`);
} catch (erreur) {
  console.error(`Lancement refusé : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exit(1);
}
