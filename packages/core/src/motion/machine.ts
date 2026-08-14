import type { Point } from '../ports/geometry.js';
import { settled } from './ground.js';
import type { MotionConfig, Pet, WorldView } from './pet.js';

export { nearestFoothold } from './ground.js';

/** Le curseur a-t-il bougé depuis la dernière observation ? */
function moved(previous: Point | null, current: Point, epsilon: number): boolean {
  if (previous === null) return true;
  return Math.abs(current.x - previous.x) > epsilon || Math.abs(current.y - previous.y) > epsilon;
}

/**
 * Vol libre vers le curseur.
 *
 * Ni pesanteur ni surface : c'est le comportement PRINCIPAL, celui d'un compagnon qui
 * vous rejoint où que vous soyez. Le rattrapage est proportionnel à la distance, ce qui
 * donne de l'inertie — il accélère quand vous partez loin, ralentit en arrivant — et la
 * vitesse reste plafonnée pour qu'il ne se téléporte jamais.
 */
function fly(pet: Pet, pointer: Point, dt: number, config: MotionConfig): Pet {
  const dx = pointer.x - pet.x;
  const dy = pointer.y + config.flyOffset - pet.y;

  // Rattrapage exponentiel borné : `1 - e^(-k·dt)` reste stable quelle que soit la cadence,
  // là où un simple `distance × facteur` dépendrait du nombre de frames par seconde.
  const ease = 1 - Math.exp(-config.flyEase * dt);
  const maxStep = config.flySpeed * dt;
  const clamp = (value: number): number => Math.max(-maxStep, Math.min(maxStep, value));

  const facing: 1 | -1 = Math.abs(dx) < 2 ? pet.facing : dx > 0 ? 1 : -1;

  return {
    ...pet,
    x: pet.x + clamp(dx * ease),
    y: pet.y + clamp(dy * ease),
    vy: 0,
    facing,
    mode: 'suit',
    state: 'suit',
    climbTo: null,
  };
}

/**
 * Suit l'immobilité du curseur et en déduit le mode.
 *
 * Le mode ne dépend PAS de l'inactivité système : bouger la souris sans rien cliquer doit
 * suffire à le faire décoller. C'est le mouvement du curseur qui compte, pas l'activité.
 */
function updateMode(pet: Pet, world: WorldView, config: MotionConfig): Pet {
  const { pointer } = world;

  // Sans position connue — Wayland sans extension — il n'y a rien à suivre : il se pose.
  if (pointer === null) {
    return { ...pet, mode: 'pose', stillSince: null };
  }

  if (moved(pet.lastPointer, pointer, config.pointerEpsilon)) {
    return { ...pet, mode: 'suit', lastPointer: pointer, stillSince: null };
  }

  const since = pet.stillSince ?? world.nowMs;
  const immobile = world.nowMs - since;

  return {
    ...pet,
    mode: immobile >= config.settleAfterMs ? 'pose' : pet.mode,
    lastPointer: pointer,
    stillSince: since,
  };
}

/**
 * Une itération du moteur. Fonction pure : mêmes entrées, même sortie.
 *
 * L'ordre est délibéré : la saisie à la souris prime sur tout, puis le mode arbitre entre
 * vol libre et vie au sol.
 */
export function step(pet: Pet, world: WorldView, dtMs: number, config: MotionConfig): Pet {
  if (pet.state === 'attrape') return pet;

  const dt = dtMs / 1000;
  const tracked = updateMode(pet, world, config);

  if (tracked.mode === 'suit' && world.pointer !== null) {
    return fly(tracked, world.pointer, dt, config);
  }

  // Il vient de voler : avant de reprendre sa vie au sol, il doit retrouver une surface.
  const landing = pet.mode === 'suit' ? { ...tracked, state: 'chute' as const, vy: 0 } : tracked;

  return settled(landing, world, dt, config);
}

/** Repose le compagnon après un lâcher : il reprend sa chute là où on l'a laissé. */
export function release(pet: Pet): Pet {
  return { ...pet, mode: 'pose', state: 'chute', vy: 0, climbTo: null };
}
