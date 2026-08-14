import { readFile, rename } from 'node:fs/promises';

import type { StoragePort, StorageRead } from '@perch/core';

import { writeAtomic } from './atomic.js';

/** `code` sur les erreurs Node système. Lu sans assertion de type. */
function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    return typeof code === 'string' ? code : 'UNKNOWN';
  }
  return 'UNKNOWN';
}

/** Persistance JSON sur disque. L'écriture elle-même vit dans `writeAtomic`. */
export function createFileStorage(filePath: string): StoragePort {
  /**
   * Les écritures se suivent, elles ne se chevauchent jamais.
   *
   * Deux appelants écrivent réellement en même temps : la progression à chaque minute et
   * le choix du compagnon au clic. Chacun écrit son fichier temporaire puis renomme ; rien
   * ne garantit que les renommages arrivent dans l'ordre des appels, et le choix pouvait
   * donc être effacé par un tick parti avant lui.
   *
   * Le `catch` ne masque rien à l'appelant, qui reçoit sa propre promesse : il empêche
   * seulement qu'une écriture ratée bloque toutes les suivantes.
   */
  let queue: Promise<unknown> = Promise.resolve();

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
      const job = queue.then(async () =>
        writeAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`)
      );
      queue = job.catch(() => undefined);
      return job;
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
