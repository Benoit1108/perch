import { describe, expect, it } from 'vitest';

import { PET_STATES } from '../motion/pet.js';
import { PLAYBACK } from './clips.js';

describe('PLAYBACK', () => {
  it('couvre tous les états du compagnon', () => {
    for (const state of PET_STATES) {
      expect(PLAYBACK[state].clips.length).toBeGreaterThan(0);
    }
  });

  // Le pack par défaut ne fournit qu'une boucle d'attente : si un état ne s'y rabattait
  // pas, la créature disparaîtrait purement et simplement pendant cet état.
  it('se rabat toujours sur le repos', () => {
    for (const state of PET_STATES) {
      expect(PLAYBACK[state].clips.at(-1)).toBe('repos');
    }
  });

  it('préfère une animation dédiée quand le pack en fournit une', () => {
    expect(PLAYBACK.marche.clips[0]).toBe('marche');
    expect(PLAYBACK.sommeil.clips[0]).toBe('sommeil');
    expect(PLAYBACK.chute.clips[0]).toBe('chute');
  });

  it('ralentit le sommeil et accélère le vol', () => {
    expect(PLAYBACK.sommeil.speed).toBeLessThan(1);
    expect(PLAYBACK.suit.speed).toBeGreaterThan(1);
  });

  // Une vitesse nulle figerait l'image : un compagnon en panne, pas un compagnon au repos.
  it('ne fige jamais complètement une animation', () => {
    for (const state of PET_STATES) {
      expect(PLAYBACK[state].speed).toBeGreaterThan(0);
    }
  });
});
