import { open, mkdir, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { StoragePort, StorageRead } from '@perch/core';

/** `code` sur les erreurs Node système. Lu sans assertion de type. */
function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    return typeof code === 'string' ? code : 'UNKNOWN';
  }
  return 'UNKNOWN';
}

/**
 * Persistance JSON sur disque, en écriture atomique et durable.
 *
 * L'écriture passe par un fichier temporaire, un `fsync`, puis un renommage. Sans le
 * `fsync`, la promesse de résistance aux coupures de courant repose uniquement sur les
 * heuristiques d'ext4 — c'est-à-dire sur rien de garanti. Le nom temporaire porte un
 * suffixe aléatoire : un nom fixe fait que deux écritures concurrentes se marchent
 * dessus, et qu'un plantage laisse un résidu qui bloque les suivantes.
 */
export function createFileStorage(filePath: string): StoragePort {
  return {
    async read(): Promise<StorageRead> {
      let raw: string;
      try {
        raw = await readFile(filePath, 'utf8');
      } catch (error: unknown) {
        const code = errorCode(error);
        return code === 'ENOENT'
          ? { kind: 'absent' }
          : { kind: 'unreadable', reason: `lecture impossible (${code})` };
      }

      try {
        return { kind: 'value', value: JSON.parse(raw) };
      } catch {
        return { kind: 'unreadable', reason: 'JSON invalide' };
      }
    },

    async write(value: unknown): Promise<void> {
      await mkdir(dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${randomUUID()}.tmp`;

      const handle = await open(temporary, 'w');
      try {
        await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
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
    },

    async archive(): Promise<string | null> {
      const target = `${filePath}.corrompu-${String(Date.now())}`;
      try {
        await rename(filePath, target);
        return target;
      } catch {
        return null;
      }
    },
  };
}
