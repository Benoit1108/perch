import type { Point } from '../ports/geometry.js';
import type { Surface } from '../world/surfaces.js';

export type PetState =
  'repos' | 'marche' | 'court' | 'escalade' | 'chute' | 'suit' | 'attrape' | 'sommeil';

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
  /** Vitesse de marche, px/s. Allure de croisière, près du curseur. */
  readonly walkSpeed: number;
  /** Vitesse de course, px/s. Employée au-delà de `runBeyond`. */
  readonly runSpeed: number;
  /** Distance horizontale au-delà de laquelle le compagnon se met à courir. */
  readonly runBeyond: number;
  /** Accélération de la pesanteur, px/s². */
  readonly gravity: number;
  /** Vitesse de chute maximale, px/s. Évite de traverser une surface en un pas. */
  readonly maxFallSpeed: number;
  /** Au-delà de cette distance horizontale, le compagnon se met à suivre le curseur. */
  readonly followDistance: number;
  /** Hauteur maximale d'une marche franchissable. Au-delà, la surface est hors d'atteinte. */
  readonly climbReach: number;
  /** Inactivité au-delà de laquelle il s'endort. */
  readonly sleepAfterMs: number;
}

export const defaultMotionConfig: MotionConfig = {
  walkSpeed: 140,
  runSpeed: 420,
  runBeyond: 320,
  gravity: 1400,
  maxFallSpeed: 1600,
  followDistance: 140,
  climbReach: 260,
  sleepAfterMs: 120_000,
};
