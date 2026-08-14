import { powerMonitor } from 'electron';

import type { ActivityPort } from '@perch/core';

/**
 * Inactivité rapportée par Electron.
 *
 * INVARIANT I1 — aucune capture d'entrée. `getSystemIdleTime` interroge le système
 * (`GetLastInputInfo` sur Windows, XScreenSaver sur X11) : il répond « depuis combien de
 * temps » sans jamais exposer ce qui a été fait. C'est précisément l'appel que la roadmap
 * prévoyait d'écrire à la main pour Windows.
 *
 * `focusedApp` reste `null` : connaître l'application au premier plan demanderait un accès
 * système qu'Electron n'offre pas, et ce n'est qu'un bonus de concentration.
 */
export function createElectronActivity(): ActivityPort {
  return {
    // La seconde est l'unité d'Electron ; tout le reste du projet compte en millisecondes.
    idleMs: () => Promise.resolve(powerMonitor.getSystemIdleTime() * 1000),
    focusedApp: () => Promise.resolve(null),
  };
}
