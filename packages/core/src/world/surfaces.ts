import type { Rect } from '../ports/geometry.js';
import type { Interval } from './intervals.js';
import { subtract } from './intervals.js';

/** D'où vient une surface. Le rendu et le comportement peuvent en dépendre. */
export type SurfaceKind = 'ecran' | 'fenetre';

/** Un segment horizontal sur lequel le compagnon peut tenir. `[start, end)` en x. */
export interface Surface {
  readonly y: number;
  readonly start: number;
  readonly end: number;
  readonly kind: SurfaceKind;
}

/** Portions horizontales couvertes par un écran situé juste sous le bord bas de `screen`. */
function coveredBelow(monitors: readonly Rect[], screen: Rect): Interval[] {
  const justBelow = screen.y + screen.height;

  return monitors
    .filter(
      (other) => other !== screen && other.y <= justBelow && justBelow < other.y + other.height
    )
    .map((other) => ({ start: other.x, end: other.x + other.width }));
}

/**
 * Construit les surfaces marchables à partir de la géométrie observée.
 *
 * LE POINT CLÉ DU SPRINT : le bord bas d'un écran n'est un sol que là où aucun autre
 * écran ne se trouve dessous. Ailleurs, ce n'est pas un plancher mais un passage vers
 * l'écran inférieur. C'est cette distinction qui fait exister les « zones vides » d'une
 * disposition en L, et sans elle le compagnon tombe dans le néant ou marche sur du rien.
 */
export function buildSurfaces(monitors: readonly Rect[], windows: readonly Rect[]): Surface[] {
  const surfaces: Surface[] = [];

  for (const screen of monitors) {
    const y = screen.y + screen.height;
    const span: Interval = { start: screen.x, end: screen.x + screen.width };

    for (const run of subtract(span, coveredBelow(monitors, screen))) {
      surfaces.push({ y, start: run.start, end: run.end, kind: 'ecran' });
    }
  }

  for (const window of windows) {
    if (window.width <= 0) continue;
    surfaces.push({
      y: window.y,
      start: window.x,
      end: window.x + window.width,
      kind: 'fenetre',
    });
  }

  return surfaces.sort((a, b) => a.y - b.y || a.start - b.start);
}

/**
 * Première surface située à `y` ou en dessous, à l'abscisse `x`.
 *
 * `null` signifie le vide : il n'y a rien sous ce point. Le moteur doit alors refuser
 * d'y aller plutôt que d'y tomber.
 */
export function groundBelow(surfaces: readonly Surface[], x: number, y: number): Surface | null {
  let best: Surface | null = null;

  for (const surface of surfaces) {
    if (surface.y < y) continue;
    if (x < surface.start || x >= surface.end) continue;
    if (best === null || surface.y < best.y) best = surface;
  }

  return best;
}

/** `true` s'il existe un sol sous ce point : la condition pour avoir le droit d'y marcher. */
export function isSupported(surfaces: readonly Surface[], x: number, y: number): boolean {
  return groundBelow(surfaces, x, y) !== null;
}

/** Union englobante de rectangles. Ce n'est PAS la surface utilisable : elle inclut le vide. */
export function boundingBox(rects: readonly Rect[]): Rect | null {
  const first = rects[0];
  if (first === undefined) return null;

  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + first.width;
  let maxY = first.y + first.height;

  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
