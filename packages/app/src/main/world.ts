import type { Rect, SensorPort, Surface } from '@perch/core';
import { boundingBox, buildSurfaces, isFullscreen } from '@perch/core';

/** Ce que la boucle sait du bureau, rafraîchi bien plus lentement que les frames. */
export interface WorldFeed {
  refresh(): Promise<void>;
  readonly surfaces: readonly Surface[];
  /** Zone où le compagnon a le droit de se tenir. `null` tant qu'on ne sait rien. */
  readonly bounds: Rect | null;
  readonly windows: readonly Rect[];
  readonly fullscreen: boolean;
  /** Où le lâcher au tout premier relevé, une seule fois. */
  takeStart(): { readonly x: number; readonly y: number } | null;
}

/**
 * Où lâcher le compagnon au tout premier relevé.
 *
 * Surtout PAS `surfaces[0]` : elles sont triées du haut vers le bas, et la première est
 * donc le bord de la fenêtre la plus haute. Le compagnon s'y posait et n'avait aucune
 * raison d'en bouger — il restait figé en haut de l'écran. On le lâche au-dessus d'un sol
 * d'écran et la pesanteur fait le reste : elle sait déjà éviter les zones vides.
 */
function premierPlacement(surfaces: readonly Surface[]): { x: number; y: number } | null {
  const sol = surfaces.filter((surface) => surface.kind === 'ecran').at(-1) ?? surfaces[0];
  return sol === undefined ? null : { x: (sol.start + sol.end) / 2, y: sol.y - 1 };
}

/**
 * Relève écrans et fenêtres, et en déduit de quoi vivre.
 *
 * `workArea` prime sur la géométrie brute : les panneaux de l'environnement se dessinent
 * AU-DESSUS de toute fenêtre, et un compagnon borné à l'écran entier passe dessous.
 */
export function createWorldFeed(sensors: SensorPort, workArea?: () => Rect | null): WorldFeed {
  let surfaces: readonly Surface[] = [];
  let windows: readonly Rect[] = [];
  let bounds: Rect | null = null;
  let fullscreen = false;
  let place = false;

  return {
    async refresh(): Promise<void> {
      const [monitors, vues] = await Promise.all([sensors.monitors(), sensors.windows()]);

      surfaces = buildSurfaces(monitors, vues);
      windows = vues;
      bounds = workArea?.() ?? boundingBox(monitors);
      fullscreen = isFullscreen(monitors, vues);
    },

    takeStart(): { readonly x: number; readonly y: number } | null {
      if (place) return null;

      const depart = premierPlacement(surfaces);
      if (depart !== null) place = true;
      return depart;
    },

    get surfaces(): readonly Surface[] {
      return surfaces;
    },
    get windows(): readonly Rect[] {
      return windows;
    },
    get bounds(): Rect | null {
      return bounds;
    },
    get fullscreen(): boolean {
      return fullscreen;
    },
  };
}
