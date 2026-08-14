import { describe, expect, it } from 'vitest';

import type { Rect } from '../ports/geometry.js';
import { buildSurfaces } from '../world/surfaces.js';
import { nearestFoothold, release, step } from './machine.js';
import type { Pet, WorldView } from './pet.js';
import { defaultMotionConfig } from './pet.js';

const dp3: Rect = { x: 0, y: 0, width: 1920, height: 1080 };
const dp4: Rect = { x: 1920, y: 0, width: 1920, height: 1080 };
const edp1: Rect = { x: 1041, y: 1080, width: 1920, height: 1080 };
const surfaces = buildSurfaces([dp3, dp4, edp1], []);

const config = defaultMotionConfig;

function world(overrides: Partial<WorldView> = {}): WorldView {
  return { surfaces, pointer: null, idleMs: 0, ...overrides };
}

function pet(overrides: Partial<Pet> = {}): Pet {
  return { x: 500, y: 1080, vy: 0, facing: 1, state: 'repos', ...overrides };
}

describe('step — pesanteur', () => {
  it('tombe quand rien ne le soutient', () => {
    const enLAir = step(pet({ y: 200 }), world(), 16, config);
    expect(enLAir.state).toBe('chute');
    expect(enLAir.y).toBeGreaterThan(200);
    expect(enLAir.vy).toBeGreaterThan(0);
  });

  it('atterrit exactement sur la surface, sans la traverser', () => {
    let current = pet({ y: 1000, state: 'chute' });
    for (let i = 0; i < 200 && current.state !== 'repos'; i++) {
      current = step(current, world(), 16, config);
    }
    expect(current.state).toBe('repos');
    expect(current.y).toBe(1080);
    expect(current.vy).toBe(0);
  });

  it('traverse la zone de recouvrement jusqu’au bas du portable', () => {
    let current = pet({ x: 1500, y: 100, state: 'chute' });
    for (let i = 0; i < 400 && current.state !== 'repos'; i++) {
      current = step(current, world(), 16, config);
    }
    expect(current.y).toBe(2160);
  });

  it('plafonne la vitesse de chute', () => {
    let current = pet({ x: 1500, y: 0, state: 'chute' });
    for (let i = 0; i < 100; i++) current = step(current, world(), 16, config);
    expect(current.vy).toBeLessThanOrEqual(config.maxFallSpeed);
  });

  it('reste posé quand il est déjà sur une surface', () => {
    expect(step(pet(), world(), 16, config).y).toBe(1080);
  });
});

describe('step — la règle anti-vide', () => {
  it('fait demi-tour plutôt que de marcher au-dessus du vide', () => {
    // Sur le sol [0, 1041) à y=1080, en marchant vers la gauche : x=0 est le bord.
    const auBord = pet({ x: 0, y: 1080, facing: -1 });
    const apres = step(auBord, world({ pointer: { x: -500, y: 1080 } }), 16, config);

    expect(apres.facing).toBe(1);
    expect(apres.x).toBe(0);
  });

  it('ne sort jamais du bureau, même poursuivi longtemps vers le vide', () => {
    let current = pet({ x: 200, y: 1080, facing: -1 });
    for (let i = 0; i < 500; i++) {
      current = step(current, world({ pointer: { x: -9000, y: 1080 } }), 16, config);
      expect(current.x).toBeGreaterThanOrEqual(0);
      expect(current.x).toBeLessThan(1041);
    }
  });

  it('ne se coince pas hors écran si le sol disparaît sous lui', () => {
    // Le portable est débranché : plus aucune surface sous ce point.
    const sansPortable = buildSurfaces([dp3, dp4], []);
    const perdu = pet({ x: 1500, y: 1500, state: 'chute' });

    const sauve = step(perdu, { ...world(), surfaces: sansPortable }, 16, config);

    expect(sauve.state).toBe('repos');
    expect(sauve.y).toBe(1080);
  });

  it('ne bouge pas quand il ne reste aucune surface du tout', () => {
    const nulle = step(pet({ y: 500, state: 'chute' }), { ...world(), surfaces: [] }, 16, config);
    expect(nulle.state).toBe('repos');
  });
});

describe('step — poursuite du curseur', () => {
  it('court vers un curseur éloigné', () => {
    const apres = step(pet({ x: 500 }), world({ pointer: { x: 1000, y: 1080 } }), 16, config);
    expect(apres.state).toBe('court');
    expect(apres.x).toBeGreaterThan(500);
    expect(apres.facing).toBe(1);
  });

  it('marche quand le curseur est proche, court quand il est loin', () => {
    const proche = step(
      pet({ x: 500 }),
      world({ pointer: { x: 500 + config.runBeyond - 10, y: 1080 } }),
      16,
      config
    );
    const loin = step(
      pet({ x: 500 }),
      world({ pointer: { x: 500 + config.runBeyond + 200, y: 1080 } }),
      16,
      config
    );

    expect(proche.state).toBe('suit');
    expect(loin.state).toBe('court');
    // La course couvre bien plus de terrain sur le même pas de temps.
    expect(loin.x - 500).toBeGreaterThan(proche.x - 500);
  });

  it('se retourne pour un curseur situé à gauche', () => {
    const apres = step(pet({ x: 500 }), world({ pointer: { x: 100, y: 1080 } }), 16, config);
    expect(apres.facing).toBe(-1);
    expect(apres.x).toBeLessThan(500);
  });

  it('reste au repos quand le curseur est déjà proche', () => {
    const apres = step(pet({ x: 500 }), world({ pointer: { x: 560, y: 1080 } }), 16, config);
    expect(apres.state).toBe('repos');
    expect(apres.x).toBe(500);
  });

  it('ne suit rien quand la position du curseur est inconnue', () => {
    // Le cas Wayland sans extension : `pointer` vaut null, et c'est normal.
    expect(step(pet(), world({ pointer: null }), 16, config).state).toBe('repos');
  });
});

describe('step — sommeil et saisie', () => {
  it('s’endort après une longue inactivité', () => {
    const apres = step(pet(), world({ idleMs: config.sleepAfterMs + 1 }), 16, config);
    expect(apres.state).toBe('sommeil');
  });

  it('ignore le curseur pendant qu’il dort', () => {
    const apres = step(
      pet(),
      world({ idleMs: config.sleepAfterMs, pointer: { x: 1800, y: 1080 } }),
      16,
      config
    );
    expect(apres.state).toBe('sommeil');
    expect(apres.x).toBe(500);
  });

  it('reste immobile tant qu’il est attrapé', () => {
    const attrape = pet({ state: 'attrape', y: 300 });
    expect(step(attrape, world(), 16, config)).toEqual(attrape);
  });

  it('retombe une fois relâché', () => {
    const relache = release(pet({ state: 'attrape', y: 300 }));
    expect(relache.state).toBe('chute');
    expect(step(relache, world(), 16, config).y).toBeGreaterThan(300);
  });
});

describe('nearestFoothold', () => {
  it('renvoie null sans aucune surface', () => {
    expect(nearestFoothold([], 0, 0)).toBeNull();
  });

  it('ramène dans les bornes du segment le plus proche', () => {
    const point = nearestFoothold(surfaces, -500, 1080);
    expect(point).not.toBeNull();
    expect(point?.x).toBe(0);
    expect(point?.y).toBe(1080);
  });
});

describe('step — escalade', () => {
  // Une fenêtre posée sur DP-3, dont le bord haut est à portée depuis le sol.
  const avecFenetre = buildSurfaces([dp3], [{ x: 300, y: 900, width: 800, height: 180 }]);

  it('grimpe sur le bord d’une fenêtre quand le curseur est au-dessus', () => {
    const apres = step(
      pet({ x: 500, y: 1080 }),
      { surfaces: avecFenetre, pointer: { x: 500, y: 400 }, idleMs: 0 },
      16,
      config
    );

    expect(apres.state).toBe('escalade');
    expect(apres.y).toBe(900);
  });

  it('ne grimpe pas vers une surface hors de portée', () => {
    const tropHaut = buildSurfaces([dp3], [{ x: 300, y: 100, width: 800, height: 200 }]);
    const apres = step(
      pet({ x: 500, y: 1080 }),
      { surfaces: tropHaut, pointer: { x: 500, y: 0 }, idleMs: 0 },
      16,
      config
    );

    expect(apres.state).not.toBe('escalade');
    expect(apres.y).toBe(1080);
  });

  it('ne grimpe pas là où aucune fenêtre ne se trouve au-dessus', () => {
    const apres = step(
      pet({ x: 1500, y: 1080 }),
      { surfaces: avecFenetre, pointer: { x: 1500, y: 300 }, idleMs: 0 },
      16,
      config
    );

    expect(apres.state).not.toBe('escalade');
  });

  it('redescend en tombant quand la fenêtre disparaît', () => {
    let current = pet({ x: 500, y: 900, state: 'repos' });
    for (let i = 0; i < 200 && current.y !== 1080; i++) {
      current = step(
        current,
        { surfaces: buildSurfaces([dp3], []), pointer: null, idleMs: 0 },
        16,
        config
      );
    }
    expect(current.y).toBe(1080);
  });
});
