/** Un intervalle fermé-ouvert sur un axe : `[start, end)`. */
export interface Interval {
  readonly start: number;
  readonly end: number;
}

const isEmpty = (interval: Interval): boolean => interval.end <= interval.start;

/**
 * Retire `holes` de `base` et renvoie ce qui reste, trié et sans chevauchement.
 *
 * C'est l'opération qui définit les zones vides du bureau : le bas d'un écran n'est un
 * sol que là où aucun autre écran ne se trouve dessous. Ailleurs, ce n'est pas un sol,
 * c'est un passage vers l'écran du dessous.
 */
export function subtract(base: Interval, holes: readonly Interval[]): Interval[] {
  if (isEmpty(base)) return [];

  const ordered = holes
    .filter((hole) => !isEmpty(hole) && hole.end > base.start && hole.start < base.end)
    .sort((a, b) => a.start - b.start);

  const result: Interval[] = [];
  let cursor = base.start;

  for (const hole of ordered) {
    if (hole.start > cursor) {
      result.push({ start: cursor, end: Math.min(hole.start, base.end) });
    }
    cursor = Math.max(cursor, hole.end);
    if (cursor >= base.end) break;
  }

  if (cursor < base.end) {
    result.push({ start: cursor, end: base.end });
  }

  return result.filter((interval) => !isEmpty(interval));
}

/** `true` si `value` tombe dans `[start, end)`. */
export function contains(interval: Interval, value: number): boolean {
  return value >= interval.start && value < interval.end;
}
