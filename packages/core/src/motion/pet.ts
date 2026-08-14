import type { Point, Rect } from '../ports/geometry.js';
import type { Surface } from '../world/surfaces.js';

/**
 * Le compagnon a DEUX modes, et la bascule entre eux fait sa personnalité.
 *
 * - `suit` : la souris bouge, il la rejoint librement, sans pesanteur ni surface. C'est
 *   le comportement principal, celui d'un compagnon.
 * - `pose` : la souris s'est arrêtée, il rejoint une surface et y vit sa vie — il marche,
 *   se perche, finit par dormir.
 *
 * Les avoir confondus était le défaut de conception de S2 : un marcheur ne peut être que
 * là où il y a une surface, donc jamais au milieu de l'écran, donc jamais vraiment avec
 * son utilisateur.
 */
type PetMode = 'suit' | 'pose';

/**
 * Les états sont une LISTE avant d'être un type : le rendu doit pouvoir les parcourir pour
 * recevoir une table d'animations complète, et un état ajouté sans son animation serait
 * une créature figée sans que rien ne le signale.
 */
export const PET_STATES = ['repos', 'marche', 'escalade', 'chute', 'suit', 'sommeil'] as const;

export type PetState = (typeof PET_STATES)[number];

/** `x` et `y` désignent les PIEDS du compagnon, pas son coin haut-gauche. */
export interface Pet {
  readonly x: number;
  readonly y: number;
  /** Vitesse verticale en px/s. Nulle dès qu'il touche une surface ou qu'il vole. */
  readonly vy: number;
  readonly facing: 1 | -1;
  readonly mode: PetMode;
  readonly state: PetState;
  /** Hauteur visée pendant une escalade. `null` hors escalade. */
  readonly climbTo: number | null;
  /** Dernière position connue du curseur, pour détecter qu'il a bougé. */
  readonly lastPointer: Point | null;
  /** Instant depuis lequel le curseur est immobile. `null` s'il vient de bouger. */
  readonly stillSince: number | null;
  /**
   * Graine du générateur pseudo-aléatoire.
   *
   * Le hasard vit DANS l'état plutôt que dans un `Math.random()` : le moteur reste une
   * fonction pure, et une vie autonome devient reproductible donc testable.
   */
  readonly seed: number;
  /**
   * Intention en cours.
   *
   * Le compagnon s'ENGAGE dans une activité qui dure plusieurs secondes, au lieu de
   * retirer au sort à chaque décision. Un tirage indépendant le faisait changer de
   * perchoir une fois sur trois en permanence : un yo-yo, pas une vie.
   */
  readonly plan: 'flane' | 'repose';
  /** Trajets restants avant de reconsidérer son intention. */
  readonly lapsLeft: number;
  /**
   * Distance restante sur le trajet en cours.
   *
   * Un trajet s'achève à cette distance OU au bord de la surface. Sans cette borne, un
   * aller-retour sur un écran de 1920 px prendrait dix-sept secondes, et le compagnon
   * paraîtrait ne rien décider.
   */
  readonly legRemaining: number;
  /** Fin de la pause en cours. */
  readonly planUntil: number;
  /** Fatigue accumulée, de 0 à 1. Plus il a bougé, plus sa pause sera longue. */
  readonly tiredness: number;
}

export const newPet = (x: number, y: number, seed = 0x2f6e2b1): Pet => ({
  x,
  y,
  seed,
  plan: 'flane',
  lapsLeft: 3,
  legRemaining: 260,
  planUntil: 0,
  tiredness: 0,
  vy: 0,
  facing: 1,
  mode: 'pose',
  state: 'chute',
  climbTo: null,
  lastPointer: null,
  stillSince: null,
});

/** Ce que le moteur sait du monde à un instant donné. */
export interface WorldView {
  readonly surfaces: readonly Surface[];
  /** `null` quand la position du curseur est inconnue — cas courant sur Wayland. */
  readonly pointer: Point | null;
  /** Millisecondes depuis la dernière interaction de l'utilisateur. */
  readonly idleMs: number;
  /**
   * Union des écrans. `null` tant qu'aucun n'est connu.
   *
   * En vol, rien ne retient le compagnon : sans ces bornes il suit le curseur jusque hors
   * du bureau et disparaît, en haut comme en bas.
   */
  readonly bounds: Rect | null;
  /** Horloge, pour dater l'immobilité du curseur. */
  readonly nowMs: number;
}

export interface MotionConfig {
  /** Vitesse de marche au sol, px/s. */
  readonly walkSpeed: number;
  /** Accélération de la pesanteur, px/s². */
  readonly gravity: number;
  /** Vitesse de chute maximale, px/s. Évite de traverser une surface en un pas. */
  readonly maxFallSpeed: number;
  /** Vitesse maximale en vol, px/s. */
  readonly flySpeed: number;
  /** Fraction de la distance rattrapée par seconde en vol : c'est elle qui donne l'inertie. */
  readonly flyEase: number;
  /** Distance à laquelle il se tient sous le curseur. Il ne se pose jamais dessus. */
  readonly flyOffset: number;
  /** Immobilité du curseur au-delà de laquelle il se pose. */
  readonly settleAfterMs: number;
  /** Déplacement minimal du curseur considéré comme un mouvement. */
  readonly pointerEpsilon: number;
  /** Vitesse d'ascension, px/s. */
  readonly climbSpeed: number;
  /** Écart de hauteur au-delà duquel changer de perchoir vaut la peine. */
  readonly perchGain: number;
  /** Écart de hauteur maximal pour rejoindre un perchoir de sa propre initiative. */
  readonly climbReach: number;
  /** Inactivité de l'utilisateur au-delà de laquelle il s'endort. */
  readonly sleepAfterMs: number;
  /** Longueur d'un trajet, en pixels. */
  readonly legMinPx: number;
  readonly legMaxPx: number;
  /** Trajets effectués avant de reconsidérer son intention. */
  readonly lapsMin: number;
  readonly lapsMax: number;
  /** Probabilité de changer de perchoir plutôt que de se reposer, une fois les tours faits. */
  readonly changePerchChance: number;
  /** Durée d'une pause : de `restMinMs` reposé à `restMaxMs` épuisé. */
  readonly restMinMs: number;
  readonly restMaxMs: number;
  /** Durée d'activité continue menant à la fatigue maximale. */
  readonly staminaMs: number;
  /** Impulsion verticale d'un petit saut. */
  readonly hopSpeed: number;
  /**
   * Encombrement du compagnon, en pixels.
   *
   * Sert UNIQUEMENT à le garder entièrement visible : le rendu l'ancre par les pieds, donc
   * son corps occupe la hauteur au-dessus de sa position.
   */
  readonly bodyWidth: number;
  readonly bodyHeight: number;
}

export const defaultMotionConfig: MotionConfig = {
  walkSpeed: 110,
  gravity: 1400,
  maxFallSpeed: 1600,
  flySpeed: 900,
  flyEase: 6,
  flyOffset: 46,
  settleAfterMs: 2500,
  pointerEpsilon: 2,
  climbSpeed: 320,
  perchGain: 140,
  climbReach: 1400,
  sleepAfterMs: 120_000,
  legMinPx: 160,
  legMaxPx: 480,
  lapsMin: 2,
  lapsMax: 4,
  changePerchChance: 0.55,
  restMinMs: 9_000,
  restMaxMs: 35_000,
  staminaMs: 60_000,
  hopSpeed: 260,
  bodyWidth: 96,
  bodyHeight: 96,
};
