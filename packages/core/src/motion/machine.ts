import type { Point, Rect } from '../ports/geometry.js';
import { bestPerch } from '../world/surfaces.js';
import { settled } from './ground.js';
import type { MotionConfig, Pet, WorldView } from './pet.js';

/**
 * Ramène le compagnon dans le bureau.
 *
 * En vol il suit le curseur sans rien pour le retenir : près d'un bord il sortait de
 * l'écran, en haut comme en bas, et disparaissait purement et simplement. Le rendu l'ancre
 * par les PIEDS, donc son corps occupe la hauteur au-dessus de sa position — d'où les
 * bornes asymétriques.
 */
function inside(pet: Pet, bounds: Rect | null, config: MotionConfig): Pet {
  if (bounds === null) return pet;

  const marge = config.bodyWidth / 2;
  const x = Math.min(Math.max(pet.x, bounds.x + marge), bounds.x + bounds.width - marge);
  const y = Math.min(Math.max(pet.y, bounds.y + config.bodyHeight), bounds.y + bounds.height);

  return x === pet.x && y === pet.y ? pet : { ...pet, x, y };
}

/**
 * Le moment où il cesse de suivre : il SE POSE, il ne tombe pas.
 *
 * Sans cette étape il se laissait choir jusqu'au premier sol SOUS lui — le bas de l'écran,
 * le plus souvent — avant de remonter vers le perchoir proche du curseur. Un plongeon de
 * quatre cents pixels suivi d'une escalade de neuf cents, à chaque fois que la souris
 * s'arrêtait. Il vise donc d'emblée la surface la plus proche de LUI, au-dessus comme en
 * dessous.
 */
function land(pet: Pet, world: WorldView): Pet {
  const perch = bestPerch(world.surfaces, pet.x, pet.y);

  if (perch !== null && perch.y < pet.y) {
    return { ...pet, vy: 0, state: 'escalade', climbTo: perch.y };
  }
  return { ...pet, vy: 0, state: 'chute', climbTo: null };
}

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
  const dt = dtMs / 1000;
  const tracked = updateMode(pet, world, config);

  if (tracked.mode === 'suit' && world.pointer !== null) {
    return inside(fly(tracked, world.pointer, dt, config), world.bounds, config);
  }

  // Il vient de voler : avant de reprendre sa vie au sol, il doit rejoindre une surface.
  const landing = pet.mode === 'suit' ? land(tracked, world) : tracked;

  return settled(landing, world, dt, config);
}
