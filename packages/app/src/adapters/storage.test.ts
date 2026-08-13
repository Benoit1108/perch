import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createFileStorage } from './storage.js';

const scratch = async (): Promise<string> => mkdtemp(join(tmpdir(), 'perch-'));

const created: string[] = [];
afterEach(() => {
  created.length = 0;
});

describe('createFileStorage', () => {
  it('renvoie null quand le fichier n existe pas', async () => {
    const dir = await scratch();
    created.push(dir);
    await expect(createFileStorage(join(dir, 'state.json')).read()).resolves.toBeNull();
  });

  it('relit ce qu il a écrit', async () => {
    const dir = await scratch();
    created.push(dir);
    const storage = createFileStorage(join(dir, 'nested', 'state.json'));

    await storage.write({ level: 3 });

    await expect(storage.read()).resolves.toEqual({ level: 3 });
  });

  it('crée les dossiers manquants', async () => {
    const dir = await scratch();
    created.push(dir);
    const target = join(dir, 'a', 'b', 'state.json');

    await createFileStorage(target).write({ ok: true });

    await expect(readFile(target, 'utf8')).resolves.toContain('"ok": true');
  });

  it('renvoie null sur un JSON corrompu au lieu de lever', async () => {
    const dir = await scratch();
    created.push(dir);
    const target = join(dir, 'state.json');
    await writeFile(target, '{ ceci n est pas du json', 'utf8');

    await expect(createFileStorage(target).read()).resolves.toBeNull();
  });

  it('écrit du JSON lisible, terminé par un saut de ligne', async () => {
    const dir = await scratch();
    created.push(dir);
    const target = join(dir, 'state.json');

    await createFileStorage(target).write({ a: 1 });

    await expect(readFile(target, 'utf8')).resolves.toBe('{\n  "a": 1\n}\n');
  });
});
