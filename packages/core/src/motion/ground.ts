import type { Surface } from '../world/surfaces.js';
import { bestPerch, groundBelow, isSupported } from '../world/surfaces.js';
import type { MotionConfig, Pet, WorldView } from './pet.js';
import { CONTACT, afterLaps, maybeHop, newLeg, startWander } from './wander.js';

export { CONTACT };

export function support(surfaces: readonly Surface[], x: number, y: number): Surface | null {
  const found = groundBelow(surfaces, x, y);
  return found !== null && found.y - y <= CONTACT ? found : null;
}

/**
 * Point marchable le plus proche.
 *
 * Filet de sécurité pour un compagnon hors de toute surface — ce qui arrive quand un
 * écran est débranché sous ses pieds. Sans lui, il tomberait indéfiniment, définitivement
 * perdu.
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

export function fall(pet: Pet, world: WorldView, dt: number, config: MotionConfig): Pet {
  const vy = Math.min(pet.vy + config.gravity * dt, config.maxFallSpeed);
  const nextY = pet.y + vy * dt;
  const landing = groundBelow(world.surfaces, pet.x, pet.y);

  if (landing === null) {
    const rescue = nearestFoothold(world.surfaces, pet.x, pet.y);
    if (rescue === null) return { ...pet, vy: 0, state: 'repos' };
    return { ...pet, x: rescue.x, y: rescue.y, vy: 0, state: 'repos' };
  }

  // `vy > 0` seulement : en montée — un petit saut — on ne se recolle pas au sol qu'on
  // vient de quitter.
  if (vy > 0 && nextY >= landing.y) {
    return { ...pet, y: landing.y, vy: 0, state: 'marche' };
  }

  return { ...pet, y: nextY, vy, state: 'chute' };
}

/**
 * Un pas d'ascension.
 *
 * La montée est PROGRESSIVE : un saut instantané vers le bord d'une fenêtre maximisée
 * franchirait mille pixels en une frame. On vérifie qu'une surface existe toujours À
 * CETTE HAUTEUR — se fier à un sol en dessous ferait grimper vers une fenêtre fermée.
 */
export function climb(pet: Pet, world: WorldView, dt: number, config: MotionConfig): Pet {
  const target = pet.climbTo;
  const stillThere =
    target !== null &&
    world.surfaces.some(
      (surface) =>
        Math.abs(surface.y - target) <= CONTACT && pet.x >= surface.start && pet.x < surface.end
    );

  if (target === null || !stillThere) {
    return { ...pet, state: 'chute', climbTo: null };
  }

  const nextY = pet.y - config.climbSpeed * dt;
  if (nextY <= target) {
    return { ...pet, y: target, vy: 0, state: 'marche', climbTo: null };
  }

  return { ...pet, y: nextY, vy: 0, state: 'escalade' };
}

/**
 * Avance le long de la surface. Un demi-tour consomme un tour de flânerie.
 *
 * C'est ce comptage qui donne son rythme au compagnon : il fait quelques allers-retours
 * AVANT de reconsidérer, au lieu de retirer au sort à chaque instant.
 */
function stride(pet: Pet, world: WorldView, distance: number, config: MotionConfig): Pet {
  const nextX = pet.x + distance * pet.facing;
  const bloque = !isSupported(world.surfaces, nextX, pet.y);
  const trajetFini = pet.legRemaining - distance <= 0;

  // Un trajet s'achève au bord de la surface OU après sa distance : c'est ce qui donne un
  // va-et-vient visible même sur un écran très large.
  if (bloque || trajetFini) {
    const turned: Pet = {
      ...newLeg(pet, config),
      facing: pet.facing === 1 ? -1 : 1,
      lapsLeft: pet.lapsLeft - 1,
      state: 'marche',
    };
    return maybeHop(turned, config);
  }

  return { ...pet, x: nextX, legRemaining: pet.legRemaining - distance, state: 'marche' };
}

/**
 * Le compagnon posé : il vit sa vie, à son rythme.
 *
 * Le schéma est délibéré — flâner quelques allers-retours, changer de perchoir, flâner
 * encore, puis souffler pour de bon. Chaque intention DURE ; il ne rejoue pas sa décision
 * à chaque frame, ce qui produisait un yo-yo permanent entre le sol et les fenêtres.
 */
export function settled(pet: Pet, world: WorldView, dt: number, config: MotionConfig): Pet {
  if (pet.state === 'escalade') return climb(pet, world, dt, config);

  if (support(world.surfaces, pet.x, pet.y) === null) {
    return fall(pet, world, dt, config);
  }

  if (world.idleMs >= config.sleepAfterMs) {
    return { ...pet, vy: 0, state: 'sommeil' };
  }

  // Il vient d'atterrir après un vol : il rejoint d'abord le perchoir le plus proche de
  // là où on regardait, puis il reprend sa vie propre.
  const perch =
    pet.lastPointer === null ? null : bestPerch(world.surfaces, pet.x, pet.lastPointer.y);
  if (perch !== null && Math.abs(pet.y - perch.y) > config.perchGain) {
    return perch.y < pet.y
      ? { ...pet, vy: 0, state: 'escalade', climbTo: perch.y }
      : { ...pet, y: pet.y + CONTACT + 1, vy: 0, state: 'chute', climbTo: null };
  }

  if (pet.plan === 'repose') {
    return world.nowMs >= pet.planUntil
      ? startWander(pet, config)
      : { ...pet, vy: 0, state: 'repos' };
  }

  // La fatigue monte tant qu'il bouge : c'est elle qui allongera sa prochaine pause.
  const tired: Pet = {
    ...pet,
    tiredness: Math.min(1, pet.tiredness + (dt * 1000) / config.staminaMs),
  };

  if (tired.lapsLeft <= 0) return afterLaps(tired, world, config);

  return stride({ ...tired, vy: 0 }, world, config.walkSpeed * dt, config);
}
