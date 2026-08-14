import { describe, expect, it } from 'vitest';

import { PET_STATES } from '@perch/core';

import { playbackTable } from './playback.js';

const clip = (fps: number): { fps: number; frames: readonly string[] } => ({
  fps,
  frames: ['a.png'],
});

describe('playbackTable', () => {
  // Le pack par défaut ne fournit qu'une boucle d'attente : tous les états doivent
  // néanmoins avoir de quoi s'afficher, sinon la créature disparaît pendant ceux-là.
  it('rabat tous les états sur la seule animation disponible', () => {
    const table = playbackTable({ repos: clip(8) });

    for (const state of PET_STATES) {
      expect(table[state]?.clip).toBe('repos');
    }
  });

  it('préfère une animation dédiée quand le pack en fournit une', () => {
    const table = playbackTable({ repos: clip(8), marche: clip(8), sommeil: clip(8) });

    expect(table.marche?.clip).toBe('marche');
    expect(table.sommeil?.clip).toBe('sommeil');
    expect(table.escalade?.clip).toBe('marche');
    expect(table.chute?.clip).toBe('marche');
  });

  it('applique le facteur de vitesse de l’état à la cadence du clip', () => {
    const table = playbackTable({ repos: clip(10) });

    expect(table.repos?.fps).toBe(10);
    expect(table.sommeil?.fps).toBeLessThan(10);
    expect(table.suit?.fps).toBeGreaterThan(10);
  });

  it('laisse la table vide quand aucune animation n’est chargée', () => {
    expect(playbackTable({})).toEqual({});
  });

  // Cas d'un pack partiellement lisible : une animation dont une image manque est écartée
  // au chargement. Les états qui n'ont plus rien restent absents, et le rendu affiche son
  // marqueur — plutôt qu'une image manquante.
  it('laisse sans animation les états qu’aucun clip disponible ne couvre', () => {
    const table = playbackTable({ sommeil: clip(8) });

    expect(table.sommeil?.clip).toBe('sommeil');
    expect(table.repos).toBeUndefined();
    expect(table.marche).toBeUndefined();
  });
});
