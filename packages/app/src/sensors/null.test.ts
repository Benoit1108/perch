import { describe, expect, it } from 'vitest';

import { nullSensors } from './null.js';

/**
 * Ces tests ne vérifient pas un algorithme : ils verrouillent un contrat.
 *
 * La tentation, quand le pet ne bouge pas, sera de faire renvoyer une position « par
 * défaut » à ce backend. Ce serait pire que de ne rien renvoyer : le pet suivrait un
 * curseur imaginaire. Le `null` doit rester.
 */
describe('nullSensors', () => {
  it('annonce honnêtement ne rien savoir faire', () => {
    expect(nullSensors.capabilities).toEqual({ pointer: false, windows: false });
  });

  it('renvoie null pour le curseur, jamais une position inventée', async () => {
    await expect(nullSensors.pointer()).resolves.toBeNull();
  });

  it('ne voit aucune fenêtre', async () => {
    await expect(nullSensors.windows()).resolves.toEqual([]);
  });

  it('ne voit aucun écran', async () => {
    await expect(nullSensors.monitors()).resolves.toEqual([]);
  });
});
