import type { SensorPort } from '@perch/core';

import type { Environment } from '../platform.js';
import { electronSeesDesktop } from '../platform.js';

import { createElectronSensors } from './electron.js';
import { createGnomeSensors } from './gnome.js';
import { nullSensors } from './null.js';

/**
 * Enveloppe un backend aveugle aux écrans pour qu'il utilise ceux d'Electron.
 *
 * Sans écrans, aucune surface n'existe et le compagnon n'a nulle part où se tenir : le
 * mode dégradé serait un écran vide plutôt qu'un compagnon sans fenêtres.
 */
function withScreens(sensors: SensorPort): SensorPort {
  const electron = createElectronSensors();
  return { ...sensors, monitors: () => electron.monitors() };
}

/**
 * Choisit le meilleur backend disponible, et le dit.
 *
 * Trois niveaux, du plus complet au plus pauvre :
 *
 * 1. l'extension GNOME — seule à fournir la géométrie des fenêtres, donc les perchoirs ;
 * 2. Electron — le curseur et les écrans, mais pas les fenêtres. C'est le cas de Windows,
 *    de macOS et d'une vraie session X11 ;
 * 3. rien — sous Wayland sans extension, où toute réponse serait FAUSSE plutôt
 *    qu'approximative (voir `electronSeesDesktop`).
 *
 * L'extension est essayée d'abord même là où Electron suffirait : elle apporte les
 * fenêtres, et c'est ce qui distingue un compagnon qui se perche d'un compagnon qui
 * arpente le bas de l'écran.
 */
export async function detectSensors(env: Environment): Promise<SensorPort> {
  if (env.os === 'linux') {
    try {
      const gnome = await createGnomeSensors();
      console.log('[perch] capteurs : extension GNOME (complet)');
      return gnome;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`[perch] extension GNOME indisponible — ${reason}`);
    }
  }

  if (electronSeesDesktop(env)) {
    console.log(
      '[perch] capteurs : Electron. Le compagnon suit la souris, mais ne se perche pas\n' +
        '        sur les fenetres — leur geometrie demande un capteur dedie.'
    );
    return createElectronSensors();
  }

  console.log(
    '[perch] capteurs : mode degrade. Le compagnon vit, mais ne suit ni la souris\n' +
      '        ni les fenetres. Installer l’extension puis rouvrir la session.'
  );
  return withScreens(nullSensors);
}
