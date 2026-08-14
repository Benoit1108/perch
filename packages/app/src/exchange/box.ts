import { mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { Envelope } from '@perch/core';
import { open } from '@perch/core';

import { writeAtomic } from '../adapters/atomic.js';

/** Nom du dossier partagé. Neutre : aucune application n'en est propriétaire. */
const NOM = 'creature-box';

export interface BoxLocation {
  /** Valeur de `process.platform`. */
  readonly os: string;
  readonly home: string;
  readonly xdgDataHome: string | undefined;
  /** `%APPDATA%` sur Windows. */
  readonly appData: string | undefined;
}

/**
 * Où vit la boîte d'échange.
 *
 * Elle doit être trouvée par deux programmes qui ne partagent aucun code : une application
 * Electron et un script shell. Le chemin est donc CONVENTIONNEL, calculé de la même façon
 * des deux côtés, et documenté — pas négocié à l'exécution.
 *
 * Elle ne vit ni dans le dossier de l'une ni dans celui de l'autre : une boîte rangée chez
 * l'un serait supprimée avec lui.
 */
export function boxDirectory(location: BoxLocation): string {
  if (location.os === 'win32') {
    return join(location.appData ?? join(location.home, 'AppData', 'Roaming'), NOM);
  }
  return join(location.xdgDataHome ?? join(location.home, '.local', 'share'), NOM);
}

/** Mot d'explication laissé à qui ouvrirait ce dossier sans savoir ce que c'est. */
const LISEZMOI = `Boîte d'échange de créatures.

Chaque fichier .json est une créature déposée par une application compagnon, en attente
d'être retirée par une autre. Le format est décrit par « envelopeVersion ».

Retirer une créature, c'est prendre le fichier : celui qui le renomme le premier l'obtient.
Supprimer un fichier à la main relâche simplement la créature qu'il contenait.
`;

/** Crée la boîte si elle n'existe pas, avec son mot d'explication. */
export async function ensureBox(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const lisezmoi = join(directory, 'LISEZ-MOI.txt');

  try {
    await readFile(lisezmoi, 'utf8');
  } catch {
    await writeAtomic(lisezmoi, LISEZMOI);
  }
}

/** Dépose une enveloppe. Le nom du fichier vient de son identifiant, déjà contraint. */
export async function deposit(directory: string, envelope: Envelope): Promise<void> {
  await ensureBox(directory);
  await writeAtomic(
    join(directory, `${envelope.id}.json`),
    `${JSON.stringify(envelope, null, 2)}\n`
  );
}

/**
 * Enveloppes en attente.
 *
 * Un fichier illisible est ignoré et non fatal : la boîte est un dossier partagé où
 * n'importe quoi peut atterrir, et un intrus ne doit pas cacher les créatures qui
 * l'entourent.
 */
export async function listBox(directory: string): Promise<readonly Envelope[]> {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return [];
  }

  const lues = await Promise.all(
    entries
      .filter((nom) => nom.endsWith('.json'))
      .map(async (nom) => {
        try {
          return open(JSON.parse(await readFile(join(directory, nom), 'utf8')));
        } catch {
          return null;
        }
      })
  );

  return lues
    .filter((enveloppe): enveloppe is Envelope => enveloppe !== null)
    .sort((a, b) => a.depositedAt.localeCompare(b.depositedAt));
}

/**
 * Retire une enveloppe, ou renvoie `null` si quelqu'un l'a prise avant.
 *
 * Le retrait commence par un RENOMMAGE, pas par une lecture : c'est la seule opération que
 * le système garantit atomique. Deux applications qui retirent en même temps ne peuvent
 * pas obtenir la même créature — la seconde voit son renommage échouer, ce qui est
 * exactement la réponse attendue.
 */
export async function claim(directory: string, id: string): Promise<Envelope | null> {
  const source = join(directory, `${id}.json`);
  const reserve = join(directory, `.${randomUUID()}.retrait`);

  try {
    await rename(source, reserve);
  } catch {
    return null;
  }

  try {
    const enveloppe = open(JSON.parse(await readFile(reserve, 'utf8')));
    await rm(reserve, { force: true });
    return enveloppe;
  } catch {
    await rm(reserve, { force: true });
    return null;
  }
}
