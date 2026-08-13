import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { CreatureLine } from './manifest.js';
import {
  InvalidPackError,
  findLine,
  nextEvolutionLevel,
  parseCreaturePack,
  stageForLevel,
} from './pack.js';

/** Stades délibérément désordonnés : le manifeste ne garantit aucun tri. */
const fixture = {
  schemaVersion: 1,
  id: 'fixture',
  name: 'Fixture',
  license: 'CC0-1.0',
  lines: [
    {
      id: 'alpha',
      stages: [
        { id: 'alpha-1', name: 'Alpha', sprite: 'a1.png', fromLevel: 1 },
        { id: 'alpha-3', name: 'Alpha III', sprite: 'a3.png', fromLevel: 36 },
        { id: 'alpha-2', name: 'Alpha II', sprite: 'a2.png', fromLevel: 16 },
      ],
    },
  ],
};

const withLines = (lines: unknown): unknown => ({ ...fixture, lines });

/** Récupère la première lignée sans recourir à une assertion de type. */
function firstLine(): CreatureLine {
  const line = parseCreaturePack(fixture).lines[0];
  if (line === undefined) {
    throw new Error('fixture invalide : aucune lignée');
  }
  return line;
}

describe('parseCreaturePack', () => {
  it('accepte un manifeste valide', () => {
    expect(parseCreaturePack(fixture).id).toBe('fixture');
  });

  it('refuse un manifeste sans licence', () => {
    expect(() =>
      parseCreaturePack({
        schemaVersion: 1,
        id: 'fixture',
        name: 'Fixture',
        lines: fixture.lines,
      })
    ).toThrow();
  });

  it("refuse un identifiant qui n'est pas en kebab-case", () => {
    expect(() => parseCreaturePack({ ...fixture, id: 'Fixture' })).toThrow();
  });

  it('refuse une lignée sans stade au niveau 1', () => {
    const lines = [
      { id: 'alpha', stages: [{ id: 'a', name: 'A', sprite: 'a.png', fromLevel: 5 }] },
    ];
    expect(() => parseCreaturePack(withLines(lines))).toThrow(InvalidPackError);
  });

  it('refuse deux stades au même niveau de départ', () => {
    const lines = [
      {
        id: 'alpha',
        stages: [
          { id: 'a', name: 'A', sprite: 'a.png', fromLevel: 1 },
          { id: 'b', name: 'B', sprite: 'b.png', fromLevel: 1 },
        ],
      },
    ];
    expect(() => parseCreaturePack(withLines(lines))).toThrow(InvalidPackError);
  });

  it('refuse deux lignées de même identifiant', () => {
    const line = {
      id: 'alpha',
      stages: [{ id: 'a', name: 'A', sprite: 'a.png', fromLevel: 1 }],
    };
    expect(() => parseCreaturePack(withLines([line, line]))).toThrow(InvalidPackError);
  });
});

describe('findLine', () => {
  it('retrouve une lignée existante', () => {
    expect(findLine(parseCreaturePack(fixture), 'alpha')?.id).toBe('alpha');
  });

  it('renvoie undefined pour une lignée inconnue', () => {
    expect(findLine(parseCreaturePack(fixture), 'inconnue')).toBeUndefined();
  });
});

describe('stageForLevel', () => {
  it.each<[number, string]>([
    [1, 'alpha-1'],
    [15, 'alpha-1'],
    [16, 'alpha-2'],
    [35, 'alpha-2'],
    [36, 'alpha-3'],
    [100, 'alpha-3'],
  ])('niveau %i donne %s', (level, expected) => {
    expect(stageForLevel(firstLine(), level).id).toBe(expected);
  });

  it('lève si la lignée est vide', () => {
    const empty: CreatureLine = { id: 'vide', stages: [] };
    expect(() => stageForLevel(empty, 1)).toThrow(InvalidPackError);
  });
});

describe('nextEvolutionLevel', () => {
  it.each<[number, number]>([
    [1, 16],
    [15, 16],
    [16, 36],
    [35, 36],
  ])('depuis le niveau %i donne %i', (level, expected) => {
    expect(nextEvolutionLevel(firstLine(), level)).toBe(expected);
  });

  it('renvoie null au dernier stade', () => {
    expect(nextEvolutionLevel(firstLine(), 36)).toBeNull();
    expect(nextEvolutionLevel(firstLine(), 100)).toBeNull();
  });
});

describe('pack de test livré', () => {
  it('reste valide', () => {
    const manifestPath = fileURLToPath(
      new URL('../../../../packs/test-pack/manifest.json', import.meta.url)
    );
    const raw: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const pack = parseCreaturePack(raw);
    expect(pack.lines.map((line) => line.id)).toEqual(['brindille', 'braise']);
  });
});
