export const MAX_LEVEL = 100;

/**
 * Forme de la courbe : un ratio géométrique appliqué aux ÉCARTS entre niveaux, en trois
 * segments.
 *
 * Le ratio porte sur les écarts, pas sur le cumul. C'est la nuance qui compte : appliqué
 * au cumul, il produit une chute de l'écart au changement de segment — le joueur voit sa
 * progression s'accélérer brutalement au moment où elle devrait ralentir.
 */
interface Segment {
  /** Dernier niveau atteint par ce segment. */
  readonly upTo: number;
  readonly ratio: number;
}

const FIRST_DELTA = 300;

const SEGMENTS: readonly Segment[] = [
  { upTo: 16, ratio: 1.15 },
  { upTo: 36, ratio: 1.06 },
  { upTo: MAX_LEVEL, ratio: 1.02 },
];

function ratioAt(level: number): number {
  for (const segment of SEGMENTS) {
    if (level < segment.upTo) return segment.ratio;
  }
  return 1;
}

/**
 * Expérience cumulée nécessaire pour ATTEINDRE chaque niveau.
 *
 * `thresholds[0]` vaut 0 : on démarre au niveau 1 sans rien. `thresholds[n]` est le total
 * requis pour être niveau `n + 1`.
 */
function buildThresholds(): readonly number[] {
  const thresholds: number[] = [0];
  let delta = FIRST_DELTA;

  for (let level = 1; level < MAX_LEVEL; level++) {
    const previous = thresholds[level - 1] ?? 0;
    thresholds.push(Math.round(previous + delta));
    delta *= ratioAt(level + 1);
  }

  return thresholds;
}

const THRESHOLDS = buildThresholds();

/** Expérience cumulée pour atteindre `level`. Hors bornes, on rabat sur les extrêmes. */
export function xpToReach(level: number): number {
  const index = Math.min(Math.max(Math.trunc(level), 1), MAX_LEVEL) - 1;
  return THRESHOLDS[index] ?? 0;
}

export interface Progress {
  readonly level: number;
  /** Expérience acquise DANS le niveau courant. */
  readonly inLevel: number;
  /** Expérience nécessaire pour passer au suivant, `null` au niveau maximum. */
  readonly toNext: number | null;
}

/**
 * Niveau et progression correspondant à une expérience cumulée.
 *
 * L'affichage montre la progression dans le niveau courant, jamais le cumul absolu :
 * « 1 240 / 2 800 » se lit, « 148 320 » ne dit rien.
 */
export function progressFor(totalXp: number): Progress {
  const total = Math.max(0, Math.trunc(totalXp));

  let level = 1;
  while (level < MAX_LEVEL && total >= xpToReach(level + 1)) {
    level += 1;
  }

  const floor = xpToReach(level);
  if (level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, inLevel: total - floor, toNext: null };
  }

  return { level, inLevel: total - floor, toNext: xpToReach(level + 1) - floor };
}
