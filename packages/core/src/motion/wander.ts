import type { Surface } from '../world/surfaces.js';
import type { MotionConfig, Pet, WorldView } from './pet.js';

export const CONTACT = 0.5;

/**
 * Générateur pseudo-aléatoire (xorshift32).
 *
 * Le hasard est PORTÉ PAR L'ÉTAT, jamais pris dans `Math.random()` : `step` reste une
 * fonction pure, et une vie entière se rejoue à l'identique dans un test.
 */
export function nextRandom(seed: number): { readonly value: number; readonly seed: number } {
  let s = seed | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  const next = s >>> 0;
  return { value: next / 0x1_0000_0000, seed: next };
}

/** Surfaces atteignables depuis la position courante, la sienne exceptée. */
export function reachablePerches(
  surfaces: readonly Surface[],
  pet: Pet,
  reach: number
): readonly Surface[] {
  return surfaces.filter(
    (surface) =>
      pet.x >= surface.start &&
      pet.x < surface.end &&
      Math.abs(surface.y - pet.y) > CONTACT &&
      Math.abs(surface.y - pet.y) <= reach
  );
}

/** Entame une flânerie : quelques allers-retours avant de reconsidérer. */
export function startWander(pet: Pet, config: MotionConfig): Pet {
  const roll = nextRandom(pet.seed);
  const span = config.lapsMax - config.lapsMin + 1;

  return {
    ...newLeg({ ...pet, seed: roll.seed }, config),
    plan: 'flane',
    lapsLeft: config.lapsMin + Math.floor(roll.value * span),
    state: 'marche',
  };
}

/** Tire la longueur du prochain trajet. */
export function newLeg(pet: Pet, config: MotionConfig): Pet {
  const roll = nextRandom(pet.seed);
  return {
    ...pet,
    seed: roll.seed,
    legRemaining: config.legMinPx + roll.value * (config.legMaxPx - config.legMinPx),
  };
}

/**
 * Entame une vraie pause.
 *
 * Sa durée dépend de la fatigue accumulée : quelques secondes après une courte
 * promenade, une demi-minute après une longue. C'est ce qui distingue un compagnon qui
 * souffle d'un compagnon qui saccade.
 */
export function startRest(pet: Pet, world: WorldView, config: MotionConfig): Pet {
  const duration = config.restMinMs + pet.tiredness * (config.restMaxMs - config.restMinMs);

  return {
    ...pet,
    plan: 'repose',
    planUntil: world.nowMs + duration,
    tiredness: 0,
    vy: 0,
    state: 'repos',
  };
}

/**
 * Choisit la suite après quelques allers-retours : changer de perchoir, ou souffler.
 *
 * L'ordre du schéma voulu : on flâne, on monte, on flâne encore, PUIS on se repose. Le
 * changement de perchoir est donc privilégié tant qu'il en existe un — la pause vient
 * après, quand il n'y a plus rien à explorer ou que la fatigue l'emporte.
 */
export function afterLaps(pet: Pet, world: WorldView, config: MotionConfig): Pet {
  const roll = nextRandom(pet.seed);
  const perches = reachablePerches(world.surfaces, pet, config.climbReach);
  const pick = nextRandom(roll.seed);
  const target = perches[Math.floor(pick.value * perches.length)];

  const wantsMove = roll.value < config.changePerchChance * (1 - pet.tiredness);

  if (wantsMove && target !== undefined) {
    const moving = { ...pet, seed: pick.seed };
    return target.y < pet.y
      ? { ...startWander(moving, config), vy: 0, state: 'escalade', climbTo: target.y }
      : {
          ...startWander(moving, config),
          y: pet.y + CONTACT + 1,
          vy: 0,
          state: 'chute',
          climbTo: null,
        };
  }

  return startRest({ ...pet, seed: pick.seed }, world, config);
}

/** Petit saut sur place, pour rompre la monotonie d'une marche linéaire. */
export function maybeHop(pet: Pet, config: MotionConfig): Pet {
  const roll = nextRandom(pet.seed);
  if (roll.value > 0.25) return { ...pet, seed: roll.seed };

  return { ...pet, seed: roll.seed, vy: -config.hopSpeed, y: pet.y - 1, state: 'chute' };
}
