import { z } from 'zod';

import type { ActivityPort } from '@perch/core';

const IDLE_BUS = 'org.gnome.Mutter.IdleMonitor';
const IDLE_PATH = '/org/gnome/Mutter/IdleMonitor/Core';

const PERCH_BUS = 'org.perch.Sensors';
const PERCH_PATH = '/org/perch/Sensors';

/** `GetIdletime` renvoie un `uint64`, que dbus-next livre en BigInt. */
const Idletime = z.union([z.bigint(), z.number()]).transform(Number);
const FocusedApp = z.string();

interface IdleInterface {
  GetIdletime(): Promise<unknown>;
}
interface FocusInterface {
  GetFocusedApp(): Promise<unknown>;
}

function hasMethod<K extends string>(
  value: object,
  name: K
): value is Record<K, () => Promise<unknown>> {
  return typeof Reflect.get(value, name) === 'function';
}

/**
 * Mesure d'activité sous GNOME.
 *
 * INVARIANT I1 — aucune frappe n'est lue. `org.gnome.Mutter.IdleMonitor` répond à une
 * seule question : depuis combien de temps l'utilisateur n'a rien fait. C'est le
 * compositeur qui la détient déjà, et il ne divulgue rien d'autre.
 *
 * Cette interface appartient à GNOME, PAS à notre extension : la progression fonctionne
 * donc même en mode dégradé. Seule l'application au premier plan — utilisée pour le bonus
 * de concentration — dépend de notre extension, et son absence n'est pas bloquante.
 */
export async function createGnomeActivity(): Promise<ActivityPort> {
  const dbus = await import('dbus-next');
  const bus = dbus.sessionBus();

  const idleProxy = await bus.getProxyObject(IDLE_BUS, IDLE_PATH);
  const idleRaw = idleProxy.getInterface(IDLE_BUS);
  if (!hasMethod(idleRaw, 'GetIdletime')) {
    throw new Error(`${IDLE_BUS} n’expose pas GetIdletime`);
  }
  const idle: IdleInterface = idleRaw;

  // Vérification de vie : mieux vaut échouer ici qu'au premier tick.
  Idletime.parse(await idle.GetIdletime());

  const focus = await connectFocus(bus);

  return {
    async idleMs(): Promise<number> {
      return Idletime.parse(await idle.GetIdletime());
    },

    async focusedApp(): Promise<string | null> {
      if (focus === null) return null;
      try {
        const name = FocusedApp.parse(await focus.GetFocusedApp());
        return name.length > 0 ? name : null;
      } catch {
        return null;
      }
    },
  };
}

/** L'application au premier plan vient de notre extension. Son absence est tolérée. */
async function connectFocus(bus: {
  getProxyObject(name: string, path: string): Promise<{ getInterface(name: string): object }>;
}): Promise<FocusInterface | null> {
  try {
    const proxy = await bus.getProxyObject(PERCH_BUS, PERCH_PATH);
    const raw = proxy.getInterface(PERCH_BUS);
    return hasMethod(raw, 'GetFocusedApp') ? raw : null;
  } catch {
    return null;
  }
}
