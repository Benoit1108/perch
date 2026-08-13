import { describe, expect, it } from 'vitest';

import { MAX_LEVEL, progressFor, xpToReach } from './curve.js';

describe('xpToReach', () => {
  it('ne demande rien pour le niveau 1', () => {
    expect(xpToReach(1)).toBe(0);
  });

  it('rabat les niveaux hors bornes sur les extrêmes', () => {
    expect(xpToReach(0)).toBe(0);
    expect(xpToReach(-5)).toBe(0);
    expect(xpToReach(999)).toBe(xpToReach(MAX_LEVEL));
  });

  it('croît strictement à chaque niveau', () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(xpToReach(level)).toBeGreaterThan(xpToReach(level - 1));
    }
  });

  /**
   * L'invariant qui compte vraiment.
   *
   * Si un écart est plus petit que le précédent, le joueur franchit un niveau plus vite
   * que le précédent : la progression semble s'accélérer au moment où elle devrait
   * ralentir. C'est le bug que produit un ratio appliqué au cumul au lieu des écarts.
   */
  it('a des écarts monotones croissants du niveau 1 au niveau 100', () => {
    let previousDelta = 0;

    for (let level = 2; level <= MAX_LEVEL; level++) {
      const delta = xpToReach(level) - xpToReach(level - 1);
      expect(delta).toBeGreaterThanOrEqual(previousDelta);
      previousDelta = delta;
    }
  });

  it('place les paliers d’évolution à des durées plausibles', () => {
    // ~900 XP par jour d'usage normal : environ deux semaines, puis ~4 mois.
    expect(xpToReach(16) / 900).toBeGreaterThan(10);
    expect(xpToReach(16) / 900).toBeLessThan(25);
    expect(xpToReach(36) / 900).toBeGreaterThan(80);
    expect(xpToReach(36) / 900).toBeLessThan(200);
  });

  it('demande plusieurs années pour le niveau 100', () => {
    const jours = xpToReach(MAX_LEVEL) / 900;
    expect(jours).toBeGreaterThan(700);
  });
});

describe('progressFor', () => {
  it('démarre au niveau 1 sans expérience', () => {
    expect(progressFor(0)).toEqual({ level: 1, inLevel: 0, toNext: xpToReach(2) });
  });

  it('reste au niveau 1 juste avant le seuil', () => {
    expect(progressFor(xpToReach(2) - 1).level).toBe(1);
  });

  it('passe au niveau 2 pile au seuil', () => {
    expect(progressFor(xpToReach(2)).level).toBe(2);
    expect(progressFor(xpToReach(2)).inLevel).toBe(0);
  });

  it('rapporte la progression DANS le niveau courant', () => {
    const total = xpToReach(5) + 42;
    const progress = progressFor(total);
    expect(progress.level).toBe(5);
    expect(progress.inLevel).toBe(42);
    expect(progress.toNext).toBe(xpToReach(6) - xpToReach(5));
  });

  it('annonce toNext null au niveau maximum', () => {
    const progress = progressFor(xpToReach(MAX_LEVEL) + 10_000);
    expect(progress.level).toBe(MAX_LEVEL);
    expect(progress.toNext).toBeNull();
  });

  it('ignore une expérience négative ou fractionnaire', () => {
    expect(progressFor(-100).level).toBe(1);
    expect(progressFor(12.9).inLevel).toBe(12);
  });

  it('est cohérente avec xpToReach à tous les niveaux', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(progressFor(xpToReach(level)).level).toBe(level);
    }
  });
});
