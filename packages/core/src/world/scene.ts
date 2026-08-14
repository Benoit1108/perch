import type { Rect } from '../ports/geometry.js';

/** Deux rectangles décrivent-ils la même fenêtre, au pixel près ? */
const meme = (a: Rect, b: Rect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** En dessous de cette proportion de fenêtres conservées, le décor a vraiment changé. */
const SEUIL = 0.5;

/**
 * Le décor a-t-il changé, ou une seule fenêtre a-t-elle bougé ?
 *
 * Changer d'espace de travail remplace TOUTES les fenêtres visibles d'un coup. Déplacer
 * une fenêtre, ou en ouvrir une, n'en change qu'une : compter les fenêtres suffirait à
 * confondre les deux, et le compagnon commenterait chaque déplacement de souris sur une
 * barre de titre.
 *
 * On mesure donc ce qui SUBSISTE d'une observation à l'autre. Passer de rien à quelque
 * chose — le tout premier relevé — n'est pas un changement de décor : c'est le début.
 */
export function sceneChanged(before: readonly Rect[], after: readonly Rect[]): boolean {
  if (before.length === 0) return false;
  if (after.length === 0) return true;

  const survivantes = after.filter((fenetre) => before.some((avant) => meme(avant, fenetre)));
  const proportion = survivantes.length / Math.max(before.length, after.length);

  return proportion < SEUIL;
}
