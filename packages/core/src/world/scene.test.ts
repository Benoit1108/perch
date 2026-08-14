import { describe, expect, it } from 'vitest';

import type { Rect } from '../ports/geometry.js';
import { sceneChanged } from './scene.js';

const fenetre = (x: number): Rect => ({ x, y: 100, width: 800, height: 600 });

describe('sceneChanged', () => {
  // Le cas visé : passer d'un espace de travail à l'autre remplace toutes les fenêtres.
  it('reconnaît un décor entièrement remplacé', () => {
    expect(sceneChanged([fenetre(0), fenetre(900)], [fenetre(300), fenetre(1200)])).toBe(true);
  });

  it('ne bronche pas quand rien ne bouge', () => {
    const decor = [fenetre(0), fenetre(900)];
    expect(sceneChanged(decor, decor)).toBe(false);
  });

  // Sans cette nuance, le compagnon commenterait chaque déplacement de fenêtre — et
  // déplacer une fenêtre, c'est tenir la souris, donc l'avoir juste à côté de soi.
  it('ne bronche pas pour une seule fenêtre déplacée', () => {
    const avant = [fenetre(0), fenetre(900), fenetre(1500)];
    const apres = [fenetre(0), fenetre(950), fenetre(1500)];

    expect(sceneChanged(avant, apres)).toBe(false);
  });

  it('reconnaît un bureau qu’on vide', () => {
    expect(sceneChanged([fenetre(0), fenetre(900)], [])).toBe(true);
  });

  // Le tout premier relevé : il n'y a pas de « avant » à comparer, donc rien à commenter.
  it('ne voit pas de changement au premier relevé', () => {
    expect(sceneChanged([], [fenetre(0)])).toBe(false);
  });

  it('juge sur la proportion, pas sur le nombre', () => {
    const avant = [fenetre(0), fenetre(900), fenetre(1500), fenetre(200)];

    // Une seule survivante sur quatre : le décor a changé.
    expect(sceneChanged(avant, [fenetre(0), fenetre(700)])).toBe(true);
    // Trois sur quatre : on a juste fermé une fenêtre.
    expect(sceneChanged(avant, [fenetre(0), fenetre(900), fenetre(1500)])).toBe(false);
  });
});
