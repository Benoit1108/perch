import { describe, expect, it } from 'vitest';

import type { ActivitySample, DailyActivity } from './earn.js';
import { accumulate, dayKeyOf, defaultEarnConfig, emptyDay } from './earn.js';

const config = defaultEarnConfig;
const MINUTE = 60_000;
const JOUR = '2026-08-13';
const T0 = Date.parse(`${JOUR}T08:00:00Z`);

const actif = (app: string | null = 'ide'): ActivitySample => ({ idleMs: 0, app });
const inactif: ActivitySample = { idleMs: 5 * MINUTE, app: 'ide' };

describe('dayKeyOf', () => {
  it('donne le jour UTC', () => {
    expect(dayKeyOf(Date.parse('2026-08-13T23:30:00Z'))).toBe('2026-08-13');
    expect(dayKeyOf(Date.parse('2026-08-14T00:30:00Z'))).toBe('2026-08-14');
  });
});

describe('accumulate — le socle', () => {
  it('rapporte le taux de base pendant une minute active', () => {
    const { xp } = accumulate(emptyDay(JOUR), actif(), MINUTE, T0, config);
    expect(xp).toBeCloseTo(config.baseXpPerMinute, 5);
  });

  it('ne rapporte rien quand l’utilisateur est inactif', () => {
    const { xp } = accumulate(emptyDay(JOUR), inactif, MINUTE, T0, config);
    expect(xp).toBe(0);
  });

  it('ne rapporte rien pour un pas de durée nulle ou négative', () => {
    expect(accumulate(emptyDay(JOUR), actif(), 0, T0, config).xp).toBe(0);
    expect(accumulate(emptyDay(JOUR), actif(), -1000, T0, config).xp).toBe(0);
  });

  it('compte le temps actif', () => {
    const { day } = accumulate(emptyDay(JOUR), actif(), MINUTE, T0, config);
    expect(day.activeMs).toBe(MINUTE);
  });

  it('ne compte pas le temps inactif', () => {
    const { day } = accumulate(emptyDay(JOUR), inactif, MINUTE, T0, config);
    expect(day.activeMs).toBe(0);
  });
});

describe('accumulate — concentration', () => {
  function apres(minutes: number, app: string): DailyActivity {
    let day = emptyDay(JOUR);
    for (let i = 0; i < minutes; i++) {
      day = accumulate(day, actif(app), MINUTE, T0, config).day;
    }
    return day;
  }

  it('n’applique aucun bonus avant le seuil', () => {
    const day = apres(19, 'ide');
    const { xp } = accumulate(day, actif('ide'), MINUTE, T0, config);
    expect(xp).toBeCloseTo(config.baseXpPerMinute, 5);
  });

  it('applique le bonus une fois le seuil atteint', () => {
    const day = apres(21, 'ide');
    const { xp } = accumulate(day, actif('ide'), MINUTE, T0, config);
    expect(xp).toBeCloseTo(config.baseXpPerMinute * config.focusMultiplier, 5);
  });

  it('rompt la concentration en changeant d’application', () => {
    const day = apres(40, 'ide');
    const { day: apresChangement, xp } = accumulate(day, actif('navigateur'), MINUTE, T0, config);
    expect(xp).toBeCloseTo(config.baseXpPerMinute, 5);
    expect(apresChangement.focusMs).toBe(MINUTE);
  });

  it('rompt la concentration en s’absentant', () => {
    const day = apres(40, 'ide');
    const { day: apresPause } = accumulate(day, inactif, MINUTE, T0, config);
    expect(apresPause.focusMs).toBe(0);
    expect(apresPause.focusApp).toBeNull();
  });

  it('n’accorde aucun bonus quand l’application est inconnue', () => {
    let day = emptyDay(JOUR);
    for (let i = 0; i < 40; i++) day = accumulate(day, actif(null), MINUTE, T0, config).day;
    const { xp } = accumulate(day, actif(null), MINUTE, T0, config);
    expect(xp).toBeCloseTo(config.baseXpPerMinute, 5);
  });
});

describe('accumulate — rendements décroissants et jours', () => {
  it('réduit le gain au-delà de six heures actives', () => {
    const charge: DailyActivity = { ...emptyDay(JOUR), activeMs: config.diminishAfterMs };
    const { xp } = accumulate(charge, actif(null), MINUTE, T0, config);
    expect(xp).toBeCloseTo(config.baseXpPerMinute * config.diminishMultiplier, 5);
  });

  it('remet les compteurs à zéro au changement de jour', () => {
    const hier: DailyActivity = {
      dayKey: '2026-08-12',
      activeMs: 5 * 3_600_000,
      focusApp: 'ide',
      focusMs: 9e6,
    };
    const { day, xp } = accumulate(hier, actif('ide'), MINUTE, T0, config);

    expect(day.dayKey).toBe(JOUR);
    expect(day.activeMs).toBe(MINUTE);
    expect(xp).toBeCloseTo(config.baseXpPerMinute, 5);
  });
});

/**
 * La définition de fini du sprint.
 *
 * Une journée entière doit se simuler en quelques millisecondes : c'est tout l'intérêt du
 * `ClockPort`. Un moteur qui lirait l'horloge système demanderait 24 heures pour ce test.
 */
describe('journée simulée', () => {
  it('donne un socle plausible pour 4 h actives, dont 2 h de concentration', () => {
    const debut = performance.now();

    let day = emptyDay(JOUR);
    let total = 0;

    // 2 h dans la même application : la concentration s'installe.
    for (let i = 0; i < 120; i++) {
      const pas = accumulate(day, actif('ide'), MINUTE, T0, config);
      day = pas.day;
      total += pas.xp;
    }
    // 2 h de papillonnage : aucune concentration.
    for (let i = 0; i < 120; i++) {
      const pas = accumulate(day, actif(`app-${String(i)}`), MINUTE, T0, config);
      day = pas.day;
      total += pas.xp;
    }

    expect(total).toBeGreaterThan(800);
    expect(total).toBeLessThan(950);
    expect(day.activeMs).toBe(240 * MINUTE);
    expect(performance.now() - debut).toBeLessThan(200);
  });

  it('ne rapporte rien pour une machine allumée mais inutilisée', () => {
    let day = emptyDay(JOUR);
    let total = 0;

    for (let i = 0; i < 1440; i++) {
      const pas = accumulate(day, inactif, MINUTE, T0, config);
      day = pas.day;
      total += pas.xp;
    }

    expect(total).toBe(0);
  });
});
