import type { Point, Rect } from './geometry.js';

/**
 * Ce qu'un backend de capteurs sait faire. Les capacités varient énormément selon la
 * plateforme, et le moteur doit pouvoir s'adapter plutôt que supposer.
 *
 * Mesuré en S0 : sur GNOME Wayland sans extension, `pointer` et `windows` sont tous
 * deux à false — laisser passer les clics coupe la seule source de position dont
 * dispose XWayland. Voir spike/README.md, constat 7 ter.
 */
export interface SensorCapabilities {
  /** Le backend peut-il donner la position globale du curseur ? */
  readonly pointer: boolean;
  /** Le backend peut-il énumérer la géométrie des fenêtres ? */
  readonly windows: boolean;
}

/**
 * Lecture de l'état de l'écran. Implémenté par la couche plateforme, jamais par `core`.
 */
export interface SensorPort {
  readonly name: string;
  readonly capabilities: SensorCapabilities;

  /**
   * Position globale du curseur, ou `null` si elle est inconnue.
   *
   * Le `null` n'est pas défensif : c'est un état courant et légitime sur Wayland.
   * Le type force à le traiter au lieu de le découvrir en production.
   */
  pointer(): Promise<Point | null>;

  /** Rectangles des fenêtres visibles. Vide si le backend ne les voit pas. */
  windows(): Promise<readonly Rect[]>;

  /** Géométrie de chaque écran. C'est elle qui définit les zones vides du bureau. */
  monitors(): Promise<readonly Rect[]>;
}
