import { describe, expect, it } from 'vitest';

import { contains, subtract } from './intervals.js';

const base = { start: 0, end: 100 };

describe('subtract', () => {
  it('renvoie la base entière quand rien ne la troue', () => {
    expect(subtract(base, [])).toEqual([base]);
  });

  it('coupe un trou central en deux morceaux', () => {
    expect(subtract(base, [{ start: 40, end: 60 }])).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ]);
  });

  it('rogne un trou qui déborde à gauche', () => {
    expect(subtract(base, [{ start: -50, end: 30 }])).toEqual([{ start: 30, end: 100 }]);
  });

  it('rogne un trou qui déborde à droite', () => {
    expect(subtract(base, [{ start: 70, end: 500 }])).toEqual([{ start: 0, end: 70 }]);
  });

  it('renvoie rien quand un trou recouvre tout', () => {
    expect(subtract(base, [{ start: -10, end: 110 }])).toEqual([]);
  });

  it('fusionne des trous qui se chevauchent', () => {
    expect(
      subtract(base, [
        { start: 20, end: 50 },
        { start: 40, end: 70 },
      ])
    ).toEqual([
      { start: 0, end: 20 },
      { start: 70, end: 100 },
    ]);
  });

  it('accepte des trous donnés dans le désordre', () => {
    expect(
      subtract(base, [
        { start: 70, end: 80 },
        { start: 10, end: 20 },
      ])
    ).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 70 },
      { start: 80, end: 100 },
    ]);
  });

  it('ignore les trous hors de la base', () => {
    expect(subtract(base, [{ start: 200, end: 300 }])).toEqual([base]);
  });

  it('ignore les trous vides ou inversés', () => {
    expect(
      subtract(base, [
        { start: 50, end: 50 },
        { start: 80, end: 20 },
      ])
    ).toEqual([base]);
  });

  it('renvoie rien pour une base vide', () => {
    expect(subtract({ start: 10, end: 10 }, [])).toEqual([]);
  });

  it('ne produit jamais d’intervalle vide', () => {
    const result = subtract(base, [
      { start: 0, end: 40 },
      { start: 40, end: 100 },
    ]);
    expect(result).toEqual([]);
  });
});

describe('contains', () => {
  it('inclut la borne basse et exclut la haute', () => {
    expect(contains(base, 0)).toBe(true);
    expect(contains(base, 99)).toBe(true);
    expect(contains(base, 100)).toBe(false);
    expect(contains(base, -1)).toBe(false);
  });
});
