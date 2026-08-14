import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { seal } from '@perch/core';

import { boxDirectory, claim, deposit, ensureBox, listBox } from './box.js';

const scratch = (): Promise<string> => mkdtemp(join(tmpdir(), 'perch-box-'));

const enveloppe = (id: string, at = '2026-08-14T14:00:00Z') =>
  seal({
    id,
    at,
    app: 'perch',
    creature: { species: 'rowlet', name: 'Brindibou', level: 12, shiny: false },
  });

describe('boxDirectory', () => {
  // Le chemin est CONVENTIONNEL : deux programmes sans code commun doivent le calculer
  // pareil, sans se parler.
  it('suit la convention de chaque système', () => {
    expect(
      boxDirectory({ os: 'linux', home: '/home/x', xdgDataHome: undefined, appData: undefined })
    ).toBe('/home/x/.local/share/creature-box');

    expect(
      boxDirectory({ os: 'linux', home: '/home/x', xdgDataHome: '/data', appData: undefined })
    ).toBe('/data/creature-box');
  });

  it('se range dans les données d’application sur Windows', () => {
    expect(
      boxDirectory({
        os: 'win32',
        home: 'C:\\u',
        xdgDataHome: undefined,
        appData: 'C:\\u\\Roaming',
      })
    ).toBe(join('C:\\u\\Roaming', 'creature-box'));
  });
});

describe('boîte', () => {
  it('dépose puis relit', async () => {
    const boite = await scratch();
    await deposit(boite, enveloppe('aaa'));

    const attente = await listBox(boite);
    expect(attente.map((e) => e.id)).toEqual(['aaa']);
    expect(attente[0]?.creature.name).toBe('Brindibou');
  });

  it('range les enveloppes par ordre de dépôt', async () => {
    const boite = await scratch();
    await deposit(boite, enveloppe('tard', '2026-08-14T18:00:00Z'));
    await deposit(boite, enveloppe('tot', '2026-08-14T08:00:00Z'));

    expect((await listBox(boite)).map((e) => e.id)).toEqual(['tot', 'tard']);
  });

  // La boîte est partagée : n'importe quel programme peut y écrire n'importe quoi.
  it('ignore un intrus sans cacher les créatures qui l’entourent', async () => {
    const boite = await scratch();
    await deposit(boite, enveloppe('vraie'));
    await writeFile(join(boite, 'intrus.json'), 'ceci n’est pas du json', 'utf8');
    await writeFile(join(boite, 'autre.json'), '{"envelopeVersion":99}', 'utf8');

    expect((await listBox(boite)).map((e) => e.id)).toEqual(['vraie']);
  });

  it('ne voit rien dans une boîte inexistante', async () => {
    expect(await listBox(join(await scratch(), 'jamais-creee'))).toEqual([]);
  });

  it('laisse un mot d’explication à qui ouvrirait le dossier', async () => {
    const boite = await scratch();
    await ensureBox(boite);

    expect(await readdir(boite)).toContain('LISEZ-MOI.txt');
  });
});

describe('retrait', () => {
  it('rend la créature et vide la boîte', async () => {
    const boite = await scratch();
    await deposit(boite, enveloppe('aaa'));

    expect((await claim(boite, 'aaa'))?.creature.species).toBe('rowlet');
    expect(await listBox(boite)).toEqual([]);
  });

  // Le cœur du protocole : deux applications peuvent retirer en même temps, et une seule
  // doit obtenir la créature. Sans quoi elle serait dupliquée.
  it('n’est accordé qu’une fois, même sur deux retraits simultanés', async () => {
    const boite = await scratch();
    await deposit(boite, enveloppe('aaa'));

    const [un, deux] = await Promise.all([claim(boite, 'aaa'), claim(boite, 'aaa')]);
    expect([un, deux].filter((e) => e !== null)).toHaveLength(1);
  });

  it('ne rend rien pour une enveloppe inconnue', async () => {
    expect(await claim(await scratch(), 'fantome')).toBeNull();
  });

  it('ne laisse aucun résidu derrière un retrait', async () => {
    const boite = await scratch();
    await deposit(boite, enveloppe('aaa'));
    await claim(boite, 'aaa');

    expect((await readdir(boite)).filter((n) => n.endsWith('.retrait'))).toEqual([]);
  });
});
