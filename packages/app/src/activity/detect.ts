import type { ActivityPort } from '@perch/core';

import { createGnomeActivity } from './gnome.js';

/**
 * Absence de source d'activité.
 *
 * Renvoie une inactivité franche plutôt que zéro : sans mesure, prétendre que
 * l'utilisateur est actif ferait progresser la créature sur une machine abandonnée. Mieux
 * vaut ne rien accorder que d'accorder à tort.
 */
const noActivity: ActivityPort = {
  idleMs: () => Promise.resolve(Number.MAX_SAFE_INTEGER),
  focusedApp: () => Promise.resolve(null),
};

/**
 * Choisit la meilleure source d'activité disponible.
 *
 * Le moniteur d'inactivité appartient à GNOME, pas à notre extension : la progression
 * fonctionne donc même sans elle. Seul le bonus de concentration en dépend.
 */
export async function detectActivity(): Promise<ActivityPort> {
  try {
    const gnome = await createGnomeActivity();
    console.log('[perch] activite : org.gnome.Mutter.IdleMonitor');
    return gnome;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[perch] aucune source d'activite (${reason}) — la creature ne progressera pas.`);
    return noActivity;
  }
}
