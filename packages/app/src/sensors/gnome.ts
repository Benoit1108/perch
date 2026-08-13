import { z } from 'zod';

import type { Point, Rect, SensorPort } from '@perch/core';

const BUS_NAME = 'org.perch.Sensors';
const OBJECT_PATH = '/org/perch/Sensors';

/**
 * Ce que l'extension renvoie sur D-Bus, validé à l'exécution.
 *
 * Le typage statique s'arrête à la frontière du processus : l'extension tourne dans le
 * compositeur, peut être d'une version différente de la nôtre, et rien ne garantit la
 * forme de sa réponse. Une assertion de type mentirait ; un schéma vérifie.
 */
const PointTuple = z.tuple([z.number(), z.number()]);
const RectTuple = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const RectTuples = z.array(RectTuple);

const METHODS = ['GetPointer', 'GetWindows', 'GetMonitors'] as const;

interface RawSensors {
  GetPointer(): Promise<unknown>;
  GetWindows(): Promise<unknown>;
  GetMonitors(): Promise<unknown>;
}

/** Vérifie la présence des méthodes plutôt que de l'affirmer. */
function isRawSensors(candidate: object): candidate is RawSensors {
  return METHODS.every((name) => typeof Reflect.get(candidate, name) === 'function');
}

const toRect = (tuple: readonly [number, number, number, number]): Rect => ({
  x: tuple[0],
  y: tuple[1],
  width: tuple[2],
  height: tuple[3],
});

/**
 * Capteurs fournis par l'extension GNOME, via D-Bus.
 *
 * C'est le SEUL chemin viable sur Wayland. Mesuré en S0 : réduire la région d'entrée de
 * l'overlay pour laisser passer les clics coupe la seule source de position du curseur
 * dont dispose XWayland — les deux s'excluent. `global.get_pointer()` interroge le
 * compositeur lui-même, qui connaît toujours la vraie position.
 *
 * Voir spike/README.md, constat 7 ter.
 */
export async function createGnomeSensors(): Promise<SensorPort> {
  const dbus = await import('dbus-next');
  const bus = dbus.sessionBus();
  const proxy = await bus.getProxyObject(BUS_NAME, OBJECT_PATH);
  const iface = proxy.getInterface(BUS_NAME);

  if (!isRawSensors(iface)) {
    throw new Error(`l’interface ${BUS_NAME} n’expose pas les methodes attendues`);
  }

  // Appel de vie : si l'extension n'est pas chargée, l'échec survient ici, à la
  // construction, et non à la première frame.
  PointTuple.parse(await iface.GetPointer());

  return {
    name: 'gnome',
    capabilities: { pointer: true, windows: true },

    async pointer(): Promise<Point | null> {
      const [x, y] = PointTuple.parse(await iface.GetPointer());
      return { x, y };
    },

    async windows(): Promise<readonly Rect[]> {
      return RectTuples.parse(await iface.GetWindows()).map(toRect);
    },

    async monitors(): Promise<readonly Rect[]> {
      return RectTuples.parse(await iface.GetMonitors()).map(toRect);
    },
  };
}
