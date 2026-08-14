import { screen } from 'electron';

import type { Point, Rect, SensorPort } from '@perch/core';

/**
 * Capteurs fournis par Electron lui-même.
 *
 * C'est ce qui rend Windows viable sans une ligne de code natif : la roadmap prévoyait
 * `GetCursorPos` par appel système, `screen.getCursorScreenPoint()` fait exactement cela
 * et fonctionne aussi sur macOS et sur une vraie session X11.
 *
 * `windows` reste vide : aucune interface d'Electron n'énumère la géométrie des fenêtres.
 * Le compagnon se perche alors sur les bords d'écran seulement — il vit, suit la souris et
 * progresse, mais ne monte pas sur les fenêtres. C'est la limite connue de Windows tant
 * qu'un équivalent d'`EnumWindows` n'est pas branché.
 */
export function createElectronSensors(): SensorPort {
  return {
    name: 'electron',
    capabilities: { pointer: true, windows: false },

    pointer: (): Promise<Point | null> => Promise.resolve(screen.getCursorScreenPoint()),
    windows: (): Promise<readonly Rect[]> => Promise.resolve([]),
    monitors: (): Promise<readonly Rect[]> =>
      Promise.resolve(screen.getAllDisplays().map((display) => display.bounds)),
  };
}
