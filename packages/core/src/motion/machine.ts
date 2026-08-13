import type { Surface } from '../world/surfaces.js';
import { groundBelow, isSupported } from '../world/surfaces.js';
import type { MotionConfig, Pet, WorldView } from './pet.js';

/** Tolérance verticale : en deçà, le compagnon est considéré posé sur la surface. */
const CONTACT = 0.5;

function support(surfaces: readonly Surface[], x: number, y: number): Surface | null {
  const found = groundBelow(surfaces, x, y);
  return found !== null && found.y - y <= CONTACT ? found : null;
}

/**
 * Point marchable le plus proche.
 *
 * Filet de sécurité pour un compagnon qui se retrouverait hors de toute surface — ce qui
 * arrive quand un écran est débranché sous ses pieds. Sans lui, il tomberait indéfiniment
 * hors du bureau, définitivement perdu.
 */
export function nearestFoothold(
  surfaces: readonly Surface[],
  x: number,
  y: number
): { readonly x: number; readonly y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const surface of surfaces) {
    const clampedX = Math.min(Math.max(x, surface.start), surface.end - 1);
    const distance = (clampedX - x) ** 2 + (surface.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: clampedX, y: surface.y };
    }
  }

  return best;
}

function fall(pet: Pet, world: WorldView, dt: number, config: MotionConfig): Pet {
  const vy = Math.min(pet.vy + config.gravity * dt, config.maxFallSpeed);
  const nextY = pet.y + vy * dt;

  const landing = groundBelow(world.surfaces, pet.x, pet.y);

  if (landing === null) {
    // Plus rien sous les pieds : un écran a probablement disparu. On rattrape.
    const rescue = nearestFoothold(world.surfaces, pet.x, pet.y);
    if (rescue === null) return { ...pet, vy: 0, state: 'repos' };
    return { ...pet, x: rescue.x, y: rescue.y, vy: 0, state: 'repos' };
  }

  if (nextY >= landing.y) {
    return { ...pet, y: landing.y, vy: 0, state: 'repos' };
  }

  return { ...pet, y: nextY, vy, state: 'chute' };
}

/** Avance horizontalement, en refusant tout pas qui mènerait au-dessus du vide. */
function stride(pet: Pet, world: WorldView, distance: number, state: Pet['state']): Pet {
  const nextX = pet.x + distance * pet.facing;

  if (!isSupported(world.surfaces, nextX, pet.y)) {
    // Demi-tour : mieux vaut faire les cent pas que tomber hors du bureau.
    const facing: 1 | -1 = pet.facing === 1 ? -1 : 1;
    return { ...pet, facing, state: 'repos' };
  }

  return { ...pet, x: nextX, state };
}

function chase(pet: Pet, world: WorldView, dt: number, config: MotionConfig): Pet | null {
  const { pointer } = world;
  if (pointer === null) return null;

  const delta = pointer.x - pet.x;
  if (Math.abs(delta) <= config.followDistance) return null;

  const facing: 1 | -1 = delta > 0 ? 1 : -1;
  return stride({ ...pet, facing }, world, config.walkSpeed * dt, 'suit');
}

/**
 * Une itération du moteur. Fonction pure : mêmes entrées, même sortie.
 *
 * L'ordre des règles est délibéré. La saisie à la souris prime sur tout, la pesanteur
 * prime sur les intentions, et le sommeil ne coupe que ce qui reste.
 */
export function step(pet: Pet, world: WorldView, dtMs: number, config: MotionConfig): Pet {
  if (pet.state === 'attrape') return pet;

  const dt = dtMs / 1000;

  if (support(world.surfaces, pet.x, pet.y) === null) {
    return fall(pet, world, dt, config);
  }

  if (world.idleMs >= config.sleepAfterMs) {
    return { ...pet, vy: 0, state: 'sommeil' };
  }

  const chasing = chase(pet, world, dt, config);
  if (chasing !== null) return chasing;

  return { ...pet, vy: 0, state: 'repos' };
}

/** Repose le compagnon après un lâcher : il reprend sa chute là où on l'a laissé. */
export function release(pet: Pet): Pet {
  return { ...pet, state: 'chute', vy: 0 };
}
