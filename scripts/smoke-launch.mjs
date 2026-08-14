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
import { spawn, spawnSync } from 'node:child_process';
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

/**
 * Lance l'application en coupant sa sortie standard aussitôt.
 *
 * C'est la situation d'un lanceur de bureau : le terminal parent se referme, plus personne
 * ne lit. Le premier `console.log` levait alors `EPIPE`, Electron affichait sa boîte
 * « A JavaScript error occurred in the main process », et le compagnon restait planté
 * dessus indéfiniment. Le défaut est passé jusqu'à un vrai lancement, d'où cette épreuve.
 */
async function survitSansLecteur(binaire, drapeaux) {
  const enfant = spawn(binaire, drapeaux, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PERCH_TIMEOUT: String(SECONDES) },
  });

  // On coupe le lecteur, pas le processus : c'est ce que fait un terminal qui se ferme.
  enfant.stdout.destroy();
  enfant.stderr.destroy();

  const code = await new Promise((resolve) => {
    const minuteur = setTimeout(
      () => {
        enfant.kill('SIGKILL');
        resolve('bloquée');
      },
      (SECONDES + 30) * 1000
    );

    enfant.on('exit', (sortie) => {
      clearTimeout(minuteur);
      resolve(sortie);
    });
  });

  if (code !== 0) {
    throw new Error(`sortie coupée : l'application a fini en ${String(code)} au lieu de 0`);
  }
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
    // Une seule instance à la fois : lancée alors qu'une autre tourne, l'application sort
    // aussitôt et sans un mot. Le diagnostic mérite d'être dit, il coûte sinon un quart
    // d'heure de perplexité.
    throw new Error(
      `démarrage muet : aucune trace du processus principal.\n` +
        `Une autre instance tourne peut-être déjà — la fermer, puis recommencer.\n${sortie.slice(-2000)}`
    );
  }
  if (/aucun pack de creatures/u.test(sortie)) {
    throw new Error(`l'application installée ne trouve pas ses créatures\n${sortie.slice(-2000)}`);
  }

  const annonce = /\[perch\] (.+) niveau \d+/u.exec(sortie);
  console.log(`Démarrage vérifié — ${annonce?.[1] ?? 'compagnon'} est en place.`);

  await survitSansLecteur(binaire, drapeaux);
  console.log('Sortie coupée : elle survit et s’arrête d’elle-même.');
} catch (erreur) {
  console.error(`Lancement refusé : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exit(1);
}
