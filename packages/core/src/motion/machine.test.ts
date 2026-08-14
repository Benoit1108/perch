import { describe, expect, it } from 'vitest';

import type { Rect } from '../ports/geometry.js';
import { buildSurfaces } from '../world/surfaces.js';
import { nearestFoothold, release, step } from './machine.js';
import type { Pet, WorldView } from './pet.js';
import { defaultMotionConfig, newPet } from './pet.js';

const dp3: Rect = { x: 0, y: 0, width: 1920, height: 1080 };
const dp4: Rect = { x: 1920, y: 0, width: 1920, height: 1080 };
const edp1: Rect = { x: 1041, y: 1080, width: 1920, height: 1080 };
const surfaces = buildSurfaces([dp3, dp4, edp1], []);

const config = defaultMotionConfig;
const T0 = 1_000_000;

function world(overrides: Partial<WorldView> = {}): WorldView {
  return { surfaces, pointer: null, idleMs: 0, nowMs: T0, ...overrides };
}

function pet(overrides: Partial<Pet> = {}): Pet {
  return { ...newPet(500, 1080), state: 'repos', ...overrides };
}

/** Fait tourner le moteur avec l'horloge qui avance, le curseur restant figé. */
function tenir(start: Pet, build: (nowMs: number) => WorldView, ticks: number): Pet {
  let current = start;
  for (let i = 0; i < ticks; i++) {
    current = step(current, build(T0 + i * 16), 16, config);
  }
  return current;
}

describe('mode suit — le comportement principal', () => {
  it('décolle dès que le curseur bouge', () => {
    const apres = step(pet(), world({ pointer: { x: 900, y: 400 } }), 16, config);

    expect(apres.mode).toBe('suit');
    expect(apres.state).toBe('suit');
  });

  /**
   * LE point qui manquait depuis S2.
   *
   * Un marcheur ne peut être que là où il y a une surface : jamais au milieu de l'écran,
   * donc jamais vraiment avec son utilisateur. En vol, il rejoint n'importe quel point.
   */
  it('rejoint le curseur au MILIEU de l’écran, loin de toute surface', () => {
    let current = pet();

    for (let i = 0; i < 200; i++) {
      current = step(current, world({ pointer: { x: 900 + (i % 2), y: 400 } }), 16, config);
    }

    expect(current.x).toBeCloseTo(900, -1);
    expect(current.y).toBeCloseTo(400 + config.flyOffset, -1);
  });

  it('se tient sous le curseur, jamais dessus', () => {
    let current = pet();
    for (let i = 0; i < 200; i++) {
      current = step(current, world({ pointer: { x: 900 + (i % 2), y: 400 } }), 16, config);
    }
    expect(current.y).toBeGreaterThan(400);
  });

  it('ne tombe pas pendant qu’il vole', () => {
    const enVol = step(pet({ y: 300 }), world({ pointer: { x: 500, y: 300 } }), 16, config);
    expect(enVol.vy).toBe(0);
    expect(enVol.state).not.toBe('chute');
  });

  it('se retourne selon la direction du curseur', () => {
    expect(step(pet({ x: 900 }), world({ pointer: { x: 100, y: 500 } }), 16, config).facing).toBe(
      -1
    );
  });

  it('ne se téléporte jamais, même vers un curseur très éloigné', () => {
    const apres = step(pet({ x: 0 }), world({ pointer: { x: 3800, y: 100 } }), 16, config);
    expect(apres.x).toBeLessThanOrEqual(config.flySpeed * 0.016 + 0.001);
  });

  it('ne suit rien quand la position du curseur est inconnue', () => {
    expect(step(pet(), world({ pointer: null }), 16, config).mode).toBe('pose');
  });
});

describe('bascule entre les deux modes', () => {
  const fige = { x: 900, y: 400 };
  const ticksPourSePoser = Math.ceil(config.settleAfterMs / 16) + 5;

  it('reste en vol tant que le curseur bouge', () => {
    let current = pet();
    for (let i = 0; i < 400; i++) {
      // Amplitude franchement au-delà de `pointerEpsilon` : un tremblement de un pixel
      // n'est PAS un mouvement, et le compagnon a raison de l'ignorer.
      current = step(
        current,
        world({ pointer: { x: 900 + (i % 3) * 40, y: 400 }, nowMs: T0 + i * 16 }),
        16,
        config
      );
    }
    expect(current.mode).toBe('suit');
  });

  it('ignore un tremblement de quelques pixels', () => {
    const fige = pet();
    const ticks = Math.ceil(config.settleAfterMs / 16) + 5;
    let current = fige;

    for (let i = 0; i < ticks; i++) {
      current = step(
        current,
        world({ pointer: { x: 900 + (i % 2), y: 400 }, nowMs: T0 + i * 16 }),
        16,
        config
      );
    }

    expect(current.mode).toBe('pose');
  });

  it('se pose après quelques secondes d’immobilité du curseur', () => {
    const apres = tenir(pet(), (nowMs) => world({ pointer: fige, nowMs }), ticksPourSePoser);
    expect(apres.mode).toBe('pose');
  });

  it('redécolle dès que le curseur rebouge', () => {
    const pose = tenir(pet(), (nowMs) => world({ pointer: fige, nowMs }), ticksPourSePoser);
    const apres = step(
      pose,
      world({ pointer: { x: 300, y: 800 }, nowMs: T0 + 99_999 }),
      16,
      config
    );

    expect(apres.mode).toBe('suit');
  });

  it('retombe sur une surface une fois posé', () => {
    const apres = tenir(pet(), (nowMs) => world({ pointer: fige, nowMs }), ticksPourSePoser + 400);

    expect(apres.mode).toBe('pose');
    // Sur UNE des surfaces : en se promenant il peut franchir le bord du sol de DP-3 et
    // descendre sur le portable. C'est le comportement voulu, pas une dérive.
    expect(surfaces.some((surface) => surface.y === apres.y)).toBe(true);
  });
});

describe('mode posé — il vit sa vie', () => {
  const sansCurseur = (nowMs: number): WorldView => world({ pointer: null, nowMs });

  it('tombe jusqu’à la surface', () => {
    expect(tenir(pet({ y: 200, state: 'chute' }), sansCurseur, 300).y).toBe(1080);
  });

  it('se promène le long de sa surface', () => {
    const depart = pet();
    // Assez long pour couvrir une pause éventuelle : ses décisions sont espacées de
    // plusieurs secondes.
    expect(tenir(depart, sansCurseur, 900).x).not.toBe(depart.x);
  });

  it('ne sort jamais du bureau et se tient toujours sur une surface', () => {
    let current = pet({ x: 30, facing: -1 });

    for (let i = 0; i < 2000; i++) {
      current = step(current, sansCurseur(T0 + i * 16), 16, config);

      // Il peut franchir le bord d'un sol pour descendre sur l'écran d'en dessous —
      // c'est voulu. Ce qu'il ne doit jamais faire, c'est quitter le bureau.
      expect(current.x).toBeGreaterThanOrEqual(0);
      expect(current.x).toBeLessThanOrEqual(3840);

      if (current.state === 'marche' || current.state === 'repos') {
        expect(surfaces.some((s) => Math.abs(s.y - current.y) < 1)).toBe(true);
      }
    }
  });

  it('s’endort après une longue inactivité', () => {
    const apres = step(
      pet(),
      world({ pointer: null, idleMs: config.sleepAfterMs + 1 }),
      16,
      config
    );
    expect(apres.state).toBe('sommeil');
  });

  it('se rattrape si le sol disparaît sous lui', () => {
    const sansPortable = buildSurfaces([dp3, dp4], []);
    const perdu = pet({ x: 1500, y: 1500, state: 'chute' });

    const sauve = step(perdu, { ...world({ pointer: null }), surfaces: sansPortable }, 16, config);

    expect(sauve.state).toBe('repos');
    expect(sauve.y).toBe(1080);
  });

  it('ne bouge pas quand il ne reste aucune surface', () => {
    const nulle = step(
      pet({ y: 500, state: 'chute' }),
      { ...world({ pointer: null }), surfaces: [] },
      16,
      config
    );
    expect(nulle.state).toBe('repos');
  });
});

describe('perchage sur les fenêtres', () => {
  const maximisee = buildSurfaces([dp3], [{ x: 0, y: 25, width: 1920, height: 1055 }]);
  const perche = (nowMs: number): WorldView => ({
    surfaces: maximisee,
    pointer: null,
    idleMs: 0,
    nowMs,
  });

  it('grimpe vers le perchoir le plus proche du dernier curseur connu', () => {
    const vise = pet({ x: 500, y: 1080, lastPointer: { x: 500, y: 40 } });
    const apres = step(vise, perche(T0), 16, config);

    expect(apres.state).toBe('escalade');
    expect(apres.climbTo).toBe(25);
  });

  it('monte progressivement, sans se téléporter', () => {
    const vise = pet({ x: 500, y: 1080, lastPointer: { x: 500, y: 40 } });
    const premier = step(vise, perche(T0), 16, config);
    const second = step(premier, perche(T0 + 16), 16, config);

    expect(1080 - second.y).toBeLessThan(50);
  });

  /**
   * Deux règles opposées faisaient l'ascenseur dès que le curseur était à mi-hauteur.
   *
   * Les décisions autonomes sont neutralisées ici : on isole la logique dirigée par le
   * curseur, sinon les changements de perchoir volontaires — souhaitables — masqueraient
   * le défaut qu'on veut figer.
   */
  it('ne fait pas l’ascenseur : il se stabilise sur un seul perchoir', () => {
    // Vie autonome neutralisée : on isole la logique dirigée par le curseur, sinon les
    // changements de perchoir volontaires — souhaitables — masqueraient le défaut figé ici.
    const sansDecision = { ...config, changePerchChance: 0, lapsMin: 1e9, lapsMax: 1e9 };
    let current = pet({ x: 500, y: 1080, lastPointer: { x: 500, y: 550 }, lapsLeft: 1e9 });
    const hauteurs = new Set<number>();

    for (let i = 0; i < 600; i++) {
      current = step(current, perche(T0 + i * 16), 16, sansDecision);
      if (current.state === 'repos' || current.state === 'marche') hauteurs.add(current.y);
    }

    expect(hauteurs.size).toBeLessThanOrEqual(1);
  });
});

describe('saisie à la souris', () => {
  it('reste immobile tant qu’il est attrapé', () => {
    const attrape = pet({ state: 'attrape', y: 300 });
    expect(step(attrape, world({ pointer: { x: 10, y: 10 } }), 16, config)).toEqual(attrape);
  });

  it('retombe une fois relâché', () => {
    const relache = release(pet({ state: 'attrape', y: 300 }));
    expect(relache.state).toBe('chute');
    expect(relache.mode).toBe('pose');
  });
});

describe('nearestFoothold', () => {
  it('renvoie null sans aucune surface', () => {
    expect(nearestFoothold([], 0, 0)).toBeNull();
  });

  it('ramène dans les bornes du segment le plus proche', () => {
    const point = nearestFoothold(surfaces, -500, 1080);
    expect(point?.x).toBe(0);
    expect(point?.y).toBe(1080);
  });
});

describe('vie autonome en mode posé', () => {
  const avecFenetres = buildSurfaces(
    [dp3],
    [
      { x: 100, y: 700, width: 900, height: 300 },
      { x: 300, y: 350, width: 1200, height: 300 },
    ]
  );
  const seul = (nowMs: number): WorldView => ({
    surfaces: avecFenetres,
    pointer: null,
    idleMs: 0,
    nowMs,
  });

  /** Le défaut signalé : il ne faisait que des allers-retours sur une seule surface. */
  it('change de perchoir de sa propre initiative', () => {
    let current: Pet = { ...pet({ x: 500, y: 1080 }), lastPointer: null };
    const hauteurs = new Set<number>();

    for (let i = 0; i < 4000; i++) {
      current = step(current, seul(T0 + i * 16), 16, config);
      hauteurs.add(Math.round(current.y));
    }

    // Il a visité plusieurs niveaux, pas seulement le sol.
    const niveaux = [...hauteurs].filter((y) => [1080, 700, 350].includes(y));
    expect(niveaux.length).toBeGreaterThan(1);
  });

  it('ne se contente pas de marcher : il s’arrête aussi', () => {
    let current: Pet = { ...pet({ x: 500, y: 1080 }), lastPointer: null };
    const etats = new Set<string>();

    for (let i = 0; i < 4000; i++) {
      current = step(current, seul(T0 + i * 16), 16, config);
      etats.add(current.state);
    }

    expect(etats.has('marche')).toBe(true);
    expect(etats.has('repos')).toBe(true);
  });

  it('reste reproductible à graine égale', () => {
    const rejouer = (): Pet => {
      let current: Pet = { ...pet({ x: 500, y: 1080 }), lastPointer: null };
      for (let i = 0; i < 500; i++) current = step(current, seul(T0 + i * 16), 16, config);
      return current;
    };

    expect(rejouer()).toEqual(rejouer());
  });

  it('reste toujours sur une surface connue', () => {
    let current: Pet = { ...pet({ x: 500, y: 1080 }), lastPointer: null };

    for (let i = 0; i < 4000; i++) {
      current = step(current, seul(T0 + i * 16), 16, config);
      if (current.state === 'marche' || current.state === 'repos') {
        expect(avecFenetres.some((s) => Math.abs(s.y - current.y) < 1)).toBe(true);
      }
    }
  });
});
