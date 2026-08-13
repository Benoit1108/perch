import type { Point, Rect, SensorPort } from '@perch/core';

/**
 * Capteurs qui ne savent rien.
 *
 * C'est le niveau de dégradation le plus bas — GNOME Wayland sans extension installée.
 * Mesuré en S0 : dans cette configuration, laisser passer les clics coupe la seule
 * source de position du curseur dont dispose XWayland. Prétendre le contraire ferait
 * suivre au pet une position figée, ce qui est pire que de ne pas le faire suivre.
 *
 * Le pet vit quand même : il se déplace, s'anime, parle et gagne de l'expérience.
 */
export const nullSensors: SensorPort = {
  name: 'null',
  capabilities: { pointer: false, windows: false },

  pointer: (): Promise<Point | null> => Promise.resolve(null),
  windows: (): Promise<readonly Rect[]> => Promise.resolve([]),
  monitors: (): Promise<readonly Rect[]> => Promise.resolve([]),
};
