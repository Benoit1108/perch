import { describe, expect, it } from 'vitest';

import type { Rect } from '../ports/geometry.js';
import { boundingBox, buildSurfaces, groundBelow, isSupported } from './surfaces.js';

/**
 * La disposition réelle de la machine de développement : deux écrans côte à côte, le
 * portable décalé en dessous. La surface totale n'est PAS un rectangle.
 *
 *         0        1920      3840
 *       0 ┌─────────┬─────────┐
 *         │  DP-3   │  DP-4   │
 *    1080 ├────┬────┴────┬────┤
 *         │////│ eDP-1   │////│   //// = le vide
 *    2160 └────┴─────────┴────┘
 *             1041     2961
 */
const dp3: Rect = { x: 0, y: 0, width: 1920, height: 1080 };
const dp4: Rect = { x: 1920, y: 0, width: 1920, height: 1080 };
const edp1: Rect = { x: 1041, y: 1080, width: 1920, height: 1080 };
const enL = [dp3, dp4, edp1];

describe('buildSurfaces — disposition en L', () => {
  const surfaces = buildSurfaces(enL, []);

  it('ne rend marchable que la portion du bas de DP-3 qui surplombe le vide', () => {
    const dp3Floors = surfaces.filter((s) => s.y === 1080 && s.start < 1041);
    expect(dp3Floors).toEqual([{ y: 1080, start: 0, end: 1041, kind: 'ecran' }]);
  });

  it('ne rend marchable que la portion du bas de DP-4 qui surplombe le vide', () => {
    const dp4Floors = surfaces.filter((s) => s.y === 1080 && s.start >= 2961);
    expect(dp4Floors).toEqual([{ y: 1080, start: 2961, end: 3840, kind: 'ecran' }]);
  });

  it('ne crée aucun sol là où le portable se trouve juste dessous', () => {
    const auDessusDuPortable = surfaces.filter(
      (s) => s.y === 1080 && s.start >= 1041 && s.end <= 2961
    );
    expect(auDessusDuPortable).toEqual([]);
  });

  it('rend tout le bas du portable marchable', () => {
    expect(surfaces.filter((s) => s.y === 2160)).toEqual([
      { y: 2160, start: 1041, end: 2961, kind: 'ecran' },
    ]);
  });
});

describe('groundBelow — la règle anti-chute-infinie', () => {
  const surfaces = buildSurfaces(enL, []);

  it('trouve le bas de DP-3 depuis le haut de DP-3', () => {
    expect(groundBelow(surfaces, 500, 0)?.y).toBe(1080);
  });

  it('traverse vers le portable là où les écrans se recouvrent', () => {
    // x = 1500 : sous DP-3, mais le portable commence à 1080 — le sol est tout en bas.
    expect(groundBelow(surfaces, 1500, 0)?.y).toBe(2160);
  });

  it('ne trouve AUCUN sol dans la zone vide en bas à gauche', () => {
    expect(groundBelow(surfaces, 500, 1100)).toBeNull();
    expect(isSupported(surfaces, 500, 1100)).toBe(false);
  });

  it('ne trouve AUCUN sol dans la zone vide en bas à droite', () => {
    expect(groundBelow(surfaces, 3500, 1100)).toBeNull();
  });

  it('ne trouve aucun sol au-delà de la surface totale', () => {
    expect(groundBelow(surfaces, -50, 0)).toBeNull();
    expect(groundBelow(surfaces, 5000, 0)).toBeNull();
  });

  it('exclut la borne haute du segment', () => {
    // Le sol de gauche est [0, 1041) : 1041 appartient déjà au portable.
    expect(groundBelow(surfaces, 1040, 1000)?.y).toBe(1080);
    expect(groundBelow(surfaces, 1041, 1000)?.y).toBe(2160);
  });
});

describe('buildSurfaces — fenêtres', () => {
  const fenetre: Rect = { x: 300, y: 400, width: 600, height: 500 };
  const surfaces = buildSurfaces(enL, [fenetre]);

  it('ajoute le bord supérieur d’une fenêtre comme surface', () => {
    expect(surfaces).toContainEqual({ y: 400, start: 300, end: 900, kind: 'fenetre' });
  });

  it('fait atterrir sur la fenêtre plutôt que sur l’écran', () => {
    const sol = groundBelow(surfaces, 500, 0);
    expect(sol?.y).toBe(400);
    expect(sol?.kind).toBe('fenetre');
  });

  it('ignore une fenêtre de largeur nulle', () => {
    const degenere = buildSurfaces(enL, [{ x: 10, y: 20, width: 0, height: 100 }]);
    expect(degenere.filter((s) => s.kind === 'fenetre')).toEqual([]);
  });

  it('rend les surfaces triées du haut vers le bas', () => {
    const ys = surfaces.map((s) => s.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
});

describe('buildSurfaces — cas dégénérés', () => {
  it('ne produit rien sans écran', () => {
    expect(buildSurfaces([], [])).toEqual([]);
  });

  it('gère un écran unique', () => {
    expect(buildSurfaces([dp3], [])).toEqual([{ y: 1080, start: 0, end: 1920, kind: 'ecran' }]);
  });

  it('gère deux écrans parfaitement empilés : aucun sol intermédiaire', () => {
    const bas: Rect = { x: 0, y: 1080, width: 1920, height: 1080 };
    const surfaces = buildSurfaces([dp3, bas], []);
    expect(surfaces).toEqual([{ y: 2160, start: 0, end: 1920, kind: 'ecran' }]);
  });
});

describe('boundingBox', () => {
  it('englobe la disposition en L, vide compris', () => {
    expect(boundingBox(enL)).toEqual({ x: 0, y: 0, width: 3840, height: 2160 });
  });

  it('renvoie null sans rectangle', () => {
    expect(boundingBox([])).toBeNull();
  });

  it('gère des coordonnées négatives', () => {
    expect(boundingBox([{ x: -100, y: -50, width: 200, height: 100 }])).toEqual({
      x: -100,
      y: -50,
      width: 200,
      height: 100,
    });
  });
});
