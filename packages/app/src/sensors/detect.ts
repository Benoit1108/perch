import type { Rect, SensorPort } from '@perch/core';

import { createGnomeSensors } from './gnome.js';
import { nullSensors } from './null.js';

/** Géométrie des écrans vue par Electron, utilisée quand les capteurs n'en fournissent pas. */
export interface ScreenFallback {
  monitors(): readonly Rect[];
}

/**
 * Enveloppe un backend aveugle aux écrans pour qu'il utilise ceux d'Electron.
 *
 * Sans écrans, aucune surface n'existe et le compagnon n'a nulle part où se tenir : le
 * mode dégradé serait un écran vide plutôt qu'un compagnon sans fenêtres.
 */
function withScreens(sensors: SensorPort, fallback: ScreenFallback): SensorPort {
  return {
    ...sensors,
    monitors: () => Promise.resolve(fallback.monitors()),
  };
}

/**
 * Choisit le meilleur backend disponible, et le dit.
 *
 * L'extension GNOME est essayée en premier. Son absence n'est pas une erreur : c'est le
 * mode dégradé documenté, où le compagnon vit sans suivre la souris ni les fenêtres.
 */
export async function detectSensors(fallback: ScreenFallback): Promise<SensorPort> {
  try {
    const gnome = await createGnomeSensors();
    console.log('[perch] capteurs : extension GNOME (complet)');
    return gnome;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`[perch] extension GNOME indisponible — ${reason}`);
    console.log(
      '[perch] capteurs : mode degrade. Le compagnon vit, mais ne suit ni la souris\n' +
        '        ni les fenetres. Installer l’extension puis rouvrir la session.'
    );
    return withScreens(nullSensors, fallback);
  }
}
