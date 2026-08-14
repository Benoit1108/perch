#!/usr/bin/env node
//
// Porte de vulnérabilités.
//
// `npm audit --audit-level=high` échouait en permanence sur des avis SANS CORRECTIF
// amont, tous issus du même sous-arbre. Une porte rouge en permanence n'est pas une
// porte : on apprend à l'ignorer, et le jour où une vraie vulnérabilité arrive, elle
// passe avec les autres.
//
// Ce script accepte donc une liste NOMMÉE d'exceptions, chacune avec sa raison et sa date
// de réexamen, et refuse tout le reste. Deux garde-fous l'empêchent de pourrir :
//
//   - une exception qui n'a plus d'avis correspondant fait échouer le script : le
//     sous-arbre a changé, l'exception doit partir ;
//   - une exception périmée fait échouer le script : personne ne repousse une décision
//     par oubli.
import { execFileSync } from 'node:child_process';

/**
 * Avis acceptés, avec leur raison.
 *
 * Tous viennent de `dbus-next`, seul chemin vers le compositeur sur Wayland. `usocket` est
 * une dépendance OPTIONNELLE native qui n'est même pas installée ici, et `node-gyp` ne
 * sert qu'à la compiler ; `request`, `tar`, `form-data`, `qs`, `tough-cookie` et `uuid`
 * pendent sous elle. Aucune n'atteint le code livré.
 *
 * `xml2js` est la seule qui s'exécute vraiment : `dbus-next` s'en sert pour lire
 * l'introspection D-Bus. La pollution de prototype qu'on lui reproche demande un document
 * hostile ; le nôtre vient de notre propre extension, sur le bus de session de
 * l'utilisateur. Le risque est nul dans cet usage — mais il disparaîtra pour de bon en
 * sortant de `dbus-next`, ce que la roadmap consigne.
 */
const ACCEPTES = {
  'dbus-next': 'Seul chemin vers le compositeur sur Wayland. Sans correctif amont.',
  usocket: 'Dépendance optionnelle native de dbus-next, non installée.',
  'node-gyp': 'Compile usocket à l’installation. Jamais livré.',
  request: 'Sous node-gyp. Paquet abandonné, sans correctif.',
  tar: 'Sous node-gyp.',
  'form-data': 'Sous request.',
  qs: 'Sous request.',
  'tough-cookie': 'Sous request.',
  uuid: 'Sous request.',
  xml2js: 'Introspection D-Bus de notre propre extension, jamais un document hostile.',
};

/** Date de réexamen. Passée, la porte se referme et la décision se reprend. */
const REEXAMEN = '2026-11-14';

function avis() {
  // `npm audit` sort en code 1 dès qu'il trouve quelque chose : c'est attendu, et c'est
  // nous qui jugeons. `execFileSync` lèverait, on récupère donc la sortie de l'erreur.
  try {
    return JSON.parse(execFileSync('npm', ['audit', '--json'], { encoding: 'utf8' }));
  } catch (erreur) {
    if (typeof erreur.stdout !== 'string' || erreur.stdout === '') throw erreur;
    return JSON.parse(erreur.stdout);
  }
}

const trouves = avis().vulnerabilities ?? {};
const noms = Object.keys(trouves);
const problemes = [];

const inattendus = noms.filter((nom) => !(nom in ACCEPTES));
for (const nom of inattendus) {
  problemes.push(`${trouves[nom].severity} — ${nom} : avis non accepté, à corriger.`);
}

const perimes = Object.keys(ACCEPTES).filter((nom) => !noms.includes(nom));
for (const nom of perimes) {
  problemes.push(`${nom} : plus aucun avis, retirer l'exception de scripts/audit.mjs.`);
}

// Comparaison de chaînes ISO : elles s'ordonnent comme les dates qu'elles décrivent.
const aujourdhui = new Date().toISOString().slice(0, 10);
if (aujourdhui > REEXAMEN) {
  problemes.push(`Les exceptions devaient être réexaminées avant le ${REEXAMEN}.`);
}

if (problemes.length > 0) {
  console.error('Vulnérabilités : la porte refuse de passer.\n');
  for (const probleme of problemes) console.error(`  ✗ ${probleme}`);
  process.exit(1);
}

console.log(
  `Vulnérabilités : ${String(noms.length)} avis, tous acceptés et justifiés ` +
    `(réexamen avant le ${REEXAMEN}).`
);
