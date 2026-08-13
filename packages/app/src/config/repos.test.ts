import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { configPath, emptyConfig, readConfig, tasksDoneOn, writeConfig } from './repos.js';

const scratch = (): Promise<string> => mkdtemp(join(tmpdir(), 'perch-cfg-'));

describe('configPath', () => {
  it('préfère XDG_CONFIG_HOME', () => {
    expect(configPath({ XDG_CONFIG_HOME: '/x' }, '/home/u')).toBe('/x/perch/config.json');
  });

  it('se rabat sur ~/.config', () => {
    expect(configPath({}, '/home/u')).toBe('/home/u/.config/perch/config.json');
  });
});

describe('readConfig', () => {
  it('renvoie une configuration vide quand le fichier n’existe pas', async () => {
    await expect(readConfig(join(await scratch(), 'absent.json'))).resolves.toEqual(emptyConfig);
  });

  it('ne lève pas sur un fichier corrompu', async () => {
    const path = join(await scratch(), 'config.json');
    await writeFile(path, '{ pas du json', 'utf8');
    await expect(readConfig(path)).resolves.toEqual(emptyConfig);
  });

  it('relit une configuration écrite par une version antérieure', async () => {
    const path = join(await scratch(), 'config.json');
    // Config d'avant S5 : seuls les dépôts existaient.
    await writeFile(path, JSON.stringify({ repos: ['/a'] }), 'utf8');

    const config = await readConfig(path);

    expect(config.repos).toEqual(['/a']);
    expect(config.locale).toBeNull();
    expect(config.privateMode).toBe(false);
    expect(config.tasks).toEqual([]);
  });

  it('rejette une langue inconnue en repartant du défaut', async () => {
    const path = join(await scratch(), 'config.json');
    await writeFile(path, JSON.stringify({ locale: 'klingon' }), 'utf8');
    await expect(readConfig(path)).resolves.toEqual(emptyConfig);
  });
});

describe('writeConfig', () => {
  it('relit ce qu’il a écrit', async () => {
    const path = join(await scratch(), 'nested', 'config.json');
    const config = {
      ...emptyConfig,
      locale: 'fr' as const,
      privateMode: true,
      repos: ['/depot'],
      tasks: [{ id: 't1', label: 'Écrire', doneOn: null }],
    };

    await writeConfig(config, path);

    await expect(readConfig(path)).resolves.toEqual(config);
  });

  it('ne laisse aucun fichier temporaire', async () => {
    const dir = await scratch();
    const path = join(dir, 'config.json');
    await writeConfig(emptyConfig, path);
    await writeConfig(emptyConfig, path);

    const { readdir } = await import('node:fs/promises');
    expect((await readdir(dir)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });
});

describe('tasksDoneOn', () => {
  const config = {
    ...emptyConfig,
    tasks: [
      { id: '1', label: 'a', doneOn: '2026-08-13' },
      { id: '2', label: 'b', doneOn: '2026-08-12' },
      { id: '3', label: 'c', doneOn: null },
    ],
  };

  it('ne compte que les tâches cochées le jour demandé', () => {
    expect(tasksDoneOn(config, '2026-08-13')).toBe(1);
    expect(tasksDoneOn(config, '2026-08-12')).toBe(1);
    expect(tasksDoneOn(config, '2026-08-11')).toBe(0);
  });

  it('renvoie zéro sans tâche', () => {
    expect(tasksDoneOn(emptyConfig, '2026-08-13')).toBe(0);
  });
});
