import type { ActivityPort } from '@perch/core';

import { createGnomeActivity } from './gnome.js';

/**
 * Absence de source d'activité.
 *
 * `null` et non une inactivité franche : les deux se ressemblent mais ne veulent pas dire
 * la même chose. L'expérience s'en tient à la prudence — sans mesure, rien n'est accordé,
 * plutôt que d'accorder à tort sur une machine abandonnée. L'ANIMATION, elle, ne doit pas
 * en conclure que personne n'est là : le compagnon dormirait à jamais sur toute machine
 * sans moniteur d'inactivité, alors que l'invariant I7 promet qu'il y vit quand même.
 */
const noActivity: ActivityPort = {
  idleMs: () => Promise.resolve(null),
  focusedApp: () => Promise.resolve(null),
};

/**
 * Enveloppe une source pour respecter le mode privé.
 *
 * Le mode privé n'atténue pas la mesure : il la SUSPEND. Ici l'inactivité franche est le
 * bon signal, et non `null` : on veut précisément que le compagnon s'endorme et cesse de
 * progresser, sans qu'aucun autre module ait besoin de connaître ce réglage.
 */
export function withPrivacy(sensors: ActivityPort, isPrivate: () => boolean): ActivityPort {
  return {
    idleMs: () => (isPrivate() ? Promise.resolve(Number.MAX_SAFE_INTEGER) : sensors.idleMs()),
    focusedApp: () => (isPrivate() ? Promise.resolve(null) : sensors.focusedApp()),
  };
}

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
