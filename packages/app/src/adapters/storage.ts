import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { StoragePort } from '@perch/core';

/**
 * Persistance JSON sur disque, en écriture atomique.
 *
 * L'écriture passe par un fichier temporaire suivi d'un renommage : une coupure de
 * courant au mauvais moment ne doit pas laisser un `state.json` tronqué, qui coûterait
 * sa créature à l'utilisateur.
 */
export function createFileStorage(filePath: string): StoragePort {
  return {
    async read(): Promise<unknown> {
      try {
        const raw = await readFile(filePath, 'utf8');
        return JSON.parse(raw);
      } catch {
        // Fichier absent comme fichier illisible : dans les deux cas il n'y a rien de
        // récupérable, et l'appelant sait repartir d'un état neuf.
        return null;
      }
    },

    async write(value: unknown): Promise<void> {
      await mkdir(dirname(filePath), { recursive: true });
      const temporary = `${filePath}.tmp`;
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      await rename(temporary, filePath);
    },
  };
}
