import type { Point } from '../ports/geometry.js';
import type { Surface } from '../world/surfaces.js';

export type PetState = 'repos' | 'marche' | 'chute' | 'suit' | 'attrape' | 'sommeil';

/** `x` et `y` désignent les PIEDS du compagnon, pas son coin haut-gauche. */
export interface Pet {
  readonly x: number;
  readonly y: number;
  /** Vitesse verticale en px/s. Nulle dès qu'il touche une surface. */
  readonly vy: number;
  readonly facing: 1 | -1;
  readonly state: PetState;
}

/** Ce que le moteur sait du monde à un instant donné. */
export interface WorldView {
  readonly surfaces: readonly Surface[];
  /** `null` quand la position du curseur est inconnue — cas courant sur Wayland. */
  readonly pointer: Point | null;
  /** Millisecondes depuis la dernière interaction de l'utilisateur. */
  readonly idleMs: number;
}

export interface MotionConfig {
  /** Vitesse de marche, px/s. */
  readonly walkSpeed: number;
  /** Accélération de la pesanteur, px/s². */
  readonly gravity: number;
  /** Vitesse de chute maximale, px/s. Évite de traverser une surface en un pas. */
  readonly maxFallSpeed: number;
  /** Au-delà de cette distance horizontale, le compagnon se met à suivre le curseur. */
  readonly followDistance: number;
  /** Inactivité au-delà de laquelle il s'endort. */
  readonly sleepAfterMs: number;
}

export const defaultMotionConfig: MotionConfig = {
  walkSpeed: 90,
  gravity: 1400,
  maxFallSpeed: 1600,
  followDistance: 140,
  sleepAfterMs: 120_000,
};
