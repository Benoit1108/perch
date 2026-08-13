import { describe, expect, it } from 'vitest';

import { xpToReach } from './curve.js';
import { defaultEarnConfig, emptyDay } from './earn.js';
import { advance } from './progression.js';

const config = defaultEarnConfig;
const MINUTE = 60_000;
const T0 = Date.parse('2026-08-13T08:00:00Z');
const actif = { idleMs: 0, app: 'ide' };

describe('advance', () => {
  it('accumule l’expérience sans changer de niveau trop tôt', () => {
    const result = advance({ xp: 0, level: 1 }, emptyDay('2026-08-13'), actif, MINUTE, T0, config);

    expect(result.gained).toBeCloseTo(config.baseXpPerMinute, 5);
    expect(result.creature.xp).toBeCloseTo(config.baseXpPerMinute, 5);
    expect(result.creature.level).toBe(1);
    expect(result.leveledTo).toBeNull();
  });

  it('signale le franchissement d’un niveau', () => {
    const presqueDeux = xpToReach(2) - 1;
    const result = advance(
      { xp: presqueDeux, level: 1 },
      emptyDay('2026-08-13'),
      actif,
      MINUTE,
      T0,
      config
    );

    expect(result.creature.level).toBe(2);
    expect(result.leveledTo).toBe(2);
  });

  it('ne signale rien quand le niveau ne bouge pas', () => {
    const result = advance(
      { xp: xpToReach(5), level: 5 },
      emptyDay('2026-08-13'),
      actif,
      MINUTE,
      T0,
      config
    );
    expect(result.leveledTo).toBeNull();
  });

  it('n’avance pas pendant une inactivité', () => {
    const result = advance(
      { xp: 500, level: 2 },
      emptyDay('2026-08-13'),
      { idleMs: 10 * MINUTE, app: 'ide' },
      MINUTE,
      T0,
      config
    );

    expect(result.gained).toBe(0);
    expect(result.creature.xp).toBe(500);
  });

  it('atteint le niveau 16 en une quinzaine de journées normales', () => {
    let creature = { xp: 0, level: 1 };
    let jours = 0;

    while (creature.level < 16 && jours < 100) {
      jours += 1;
      // Nouveau jour : les compteurs journaliers repartent de zéro.
      let day = emptyDay(`jour-${String(jours)}`);

      // 4 h actives, dont 2 h dans la même application.
      for (let i = 0; i < 240; i++) {
        const app = i < 120 ? 'ide' : `app-${String(i)}`;
        const pas = advance(creature, day, { idleMs: 0, app }, MINUTE, T0, config);
        creature = pas.creature;
        day = pas.day;
      }

      expect(day.activeMs).toBe(240 * MINUTE);
    }

    expect(creature.level).toBe(16);
    expect(jours).toBeGreaterThan(10);
    expect(jours).toBeLessThan(30);
  });
});
