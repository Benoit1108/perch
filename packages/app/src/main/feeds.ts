import type { ActivityPort, Point, SensorPort } from '@perch/core';

/**
 * Suit le curseur SANS bloquer la frame.
 *
 * Le relevé passe par D-Bus : l'attendre à chaque passage ferait dépendre la cadence
 * d'un aller-retour inter-processus, et la gigue deviendrait visible à l'écran.
 */
export function createPointerFeed(sensors: SensorPort): () => Point | null {
  let latest: Point | null = null;
  let pending = false;

  return () => {
    if (!pending) {
      pending = true;
      void sensors
        .pointer()
        .then((value) => {
          latest = value;
        })
        .finally(() => {
          pending = false;
        });
    }
    return latest;
  };
}

/**
 * Suit l'inactivité de l'utilisateur SANS bloquer la frame.
 *
 * Sa valeur était câblée à zéro : le compagnon ne pouvait donc jamais s'endormir, et tout
 * ce qui en dépend — l'état `sommeil`, son animation ralentie, son bâillement — restait
 * inatteignable. Sans capteur d'activité branché, on garde l'ancien comportement : un
 * compagnon toujours éveillé vaut mieux qu'un compagnon endormi à tort.
 */
export function createIdleFeed(activity: ActivityPort | undefined): () => number {
  if (activity === undefined) return () => 0;

  let latest = 0;
  let pending = false;

  return () => {
    if (!pending) {
      pending = true;
      void activity
        .idleMs()
        .then((value) => {
          // `null` — plateforme sans moniteur d'inactivité — vaut ÉVEILLÉ, pas absent.
          latest = value ?? 0;
        })
        .finally(() => {
          pending = false;
        });
    }
    return latest;
  };
}

/**
 * Suit l'application au premier plan SANS bloquer la frame.
 *
 * C'est ce qui permet au compagnon de remarquer un alt-tab. L'appel passe par notre
 * extension GNOME ; `null` quand la plateforme ne sait pas répondre, et il se tait alors
 * plutôt que d'inventer un changement.
 */
export function createFocusFeed(activity: ActivityPort | undefined): () => string | null {
  if (activity === undefined) return () => null;

  let latest: string | null = null;
  let pending = false;

  return () => {
    if (!pending) {
      pending = true;
      void activity
        .focusedApp()
        .then((value) => {
          latest = value;
        })
        .finally(() => {
          pending = false;
        });
    }
    return latest;
  };
}
