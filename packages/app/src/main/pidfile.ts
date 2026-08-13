import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Emplacement du fichier PID.
 *
 * ⚠️ Cette logique doit rester IDENTIQUE à celle de `scripts/stop.mjs`, qui ne peut pas
 * l'importer : le script d'arrêt doit fonctionner même quand `dist/` n'est pas construit.
 */
export function pidFilePath(env: Record<string, string | undefined>, home: string): string {
  const base = env['XDG_RUNTIME_DIR'] ?? `${home}/.cache`;
  return `${base}/perch/perch.pid`;
}

export async function writePidFile(path: string, pid: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${String(pid)}\n`, 'utf8');
}

export async function removePidFile(path: string): Promise<void> {
  await rm(path, { force: true });
}
