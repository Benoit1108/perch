import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createFileStorage } from './storage.js';

const scratch = (): Promise<string> => mkdtemp(join(tmpdir(), 'perch-'));

describe('createFileStorage — lecture', () => {
  it('distingue « absent » de « illisible »', async () => {
    const dir = await scratch();
    await expect(createFileStorage(join(dir, 'state.json')).read()).resolves.toEqual({
      kind: 'absent',
    });
  });

  it('signale un JSON corrompu comme illisible, sans lever', async () => {
    const dir = await scratch();
    const target = join(dir, 'state.json');
    await writeFile(target, '{ ceci n’est pas du json', 'utf8');

    await expect(createFileStorage(target).read()).resolves.toEqual({
      kind: 'unreadable',
      reason: 'JSON invalide',
    });
  });

  it('signale un répertoire là où un fichier est attendu', async () => {
    const dir = await scratch();
    const result = await createFileStorage(dir).read();
    expect(result.kind).toBe('unreadable');
  });

  it('relit ce qu’il a écrit', async () => {
    const dir = await scratch();
    const storage = createFileStorage(join(dir, 'nested', 'state.json'));

    await storage.write({ level: 3 });

    await expect(storage.read()).resolves.toEqual({ kind: 'value', value: { level: 3 } });
  });
});

describe('createFileStorage — écriture', () => {
  it('crée les dossiers manquants', async () => {
    const dir = await scratch();
    const target = join(dir, 'a', 'b', 'state.json');

    await createFileStorage(target).write({ ok: true });

    await expect(readFile(target, 'utf8')).resolves.toContain('"ok": true');
  });

  it('écrit du JSON lisible, terminé par un saut de ligne', async () => {
    const dir = await scratch();
    const target = join(dir, 'state.json');

    await createFileStorage(target).write({ a: 1 });

    await expect(readFile(target, 'utf8')).resolves.toBe('{\n  "a": 1\n}\n');
  });

  it('ne laisse aucun fichier temporaire derrière lui', async () => {
    const dir = await scratch();
    const storage = createFileStorage(join(dir, 'state.json'));

    await storage.write({ a: 1 });
    await storage.write({ a: 2 });

    const left = await readdir(dir);
    expect(left.filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  // Le cas réel : la progression écrit à la minute, le choix du compagnon au clic. Sans
  // sérialisation, rien ne garantit l'ordre des renommages, et le choix se faisait
  // effacer par un tick parti avant lui.
  it('applique les écritures concurrentes dans l’ordre des appels', async () => {
    const dir = await scratch();
    const storage = createFileStorage(join(dir, 'state.json'));

    await Promise.all([
      storage.write({ rang: 1 }),
      storage.write({ rang: 2 }),
      storage.write({ rang: 3 }),
    ]);

    await expect(storage.read()).resolves.toEqual({ kind: 'value', value: { rang: 3 } });
  });

  it('reste utilisable après une écriture en échec', async () => {
    const dir = await scratch();
    const storage = createFileStorage(join(dir, 'state.json'));

    // Une valeur cyclique fait échouer la sérialisation : sans précaution, la file
    // resterait bloquée sur cette promesse rejetée et plus rien ne s'écrirait jamais.
    const cyclique: Record<string, unknown> = {};
    cyclique['moi'] = cyclique;

    await expect(storage.write(cyclique)).rejects.toThrow();
    await storage.write({ apres: true });

    await expect(storage.read()).resolves.toEqual({ kind: 'value', value: { apres: true } });
  });
});

describe('createFileStorage — archivage', () => {
  it('met le fichier de côté et renvoie son emplacement', async () => {
    const dir = await scratch();
    const target = join(dir, 'state.json');
    await writeFile(target, 'contenu abîmé', 'utf8');

    const archived = await createFileStorage(target).archive();

    expect(archived).toContain('corrompu');
    expect(archived).not.toBeNull();
    if (archived !== null) {
      await expect(readFile(archived, 'utf8')).resolves.toBe('contenu abîmé');
    }
  });

  it('renvoie null quand il n’y a rien à sauver', async () => {
    const dir = await scratch();
    await expect(createFileStorage(join(dir, 'absent.json')).archive()).resolves.toBeNull();
  });
});
