import { open, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Écriture atomique et durable d'un fichier texte.
 *
 * Fichier temporaire, `fsync`, puis renommage. Sans le `fsync`, la résistance aux coupures
 * de courant repose sur les seules heuristiques du système de fichiers — c'est-à-dire sur
 * rien de garanti. Le nom temporaire porte un suffixe aléatoire : un nom fixe fait que deux
 * écritures concurrentes se marchent dessus, et qu'un plantage laisse un résidu qui bloque
 * les suivantes.
 *
 * Utilisée pour l'état du compagnon comme pour la boîte d'échange : dans les deux cas un
 * lecteur extérieur peut ouvrir le fichier à tout instant, et ne doit jamais tomber sur un
 * JSON à moitié écrit.
 */
export async function writeAtomic(filePath: string, contents: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;

  const handle = await open(temporary, 'w');
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  await rename(temporary, filePath);

  // Le renommage n'est durable qu'une fois le répertoire lui-même synchronisé.
  try {
    const directory = await open(dirname(filePath), 'r');
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch {
    // Tous les systèmes de fichiers n'autorisent pas l'ouverture d'un répertoire.
    // L'écriture reste atomique ; seule la durabilité est un peu moins garantie.
  }
}
