import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { pidFilePath, removePidFile, writePidFile } from './pidfile.js';

describe('pidFilePath', () => {
  it('préfère XDG_RUNTIME_DIR quand il est défini', () => {
    expect(pidFilePath({ XDG_RUNTIME_DIR: '/run/user/1000' }, '/home/x')).toBe(
      '/run/user/1000/perch/perch.pid'
    );
  });

  it('se rabat sur ~/.cache sinon', () => {
    expect(pidFilePath({}, '/home/x')).toBe('/home/x/.cache/perch/perch.pid');
  });
});

describe('writePidFile', () => {
  it('crée les dossiers manquants et écrit le pid', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'perch-pid-'));
    const path = join(dir, 'a', 'b', 'perch.pid');

    await writePidFile(path, 4242);

    await expect(readFile(path, 'utf8')).resolves.toBe('4242\n');
  });

  it('est effaçable, et l’effacement d’un fichier absent ne lève pas', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'perch-pid-'));
    const path = join(dir, 'perch.pid');

    await writePidFile(path, 1);
    await removePidFile(path);
    await expect(removePidFile(path)).resolves.toBeUndefined();
  });
});
