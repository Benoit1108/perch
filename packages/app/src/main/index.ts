import { app } from 'electron';
import { join } from 'node:path';

import { systemClock } from '../adapters/clock.js';
import { createFileStorage } from '../adapters/storage.js';
import { nullSensors } from '../sensors/null.js';
import { bootstrap } from './bootstrap.js';

/**
 * Point d'entrée du process principal.
 *
 * S1 ne fait que composer les ports et relire l'état : la fenêtre, la physique et le
 * rendu arrivent en S2. Le squelette existe pour que l'architecture soit vérifiée par
 * `dependency-cruiser` sur du vrai code, pas sur une intention.
 *
 * ⚠️ `--ozone-platform=x11` doit être passé en LIGNE DE COMMANDE sur Linux.
 * `app.commandLine.appendSwitch` est sans effet : Electron choisit sa plateforme
 * d'affichage avant d'exécuter ce fichier. Voir spike/README.md, constat n°0.
 */
async function main(): Promise<void> {
  await app.whenReady();

  const statePath = join(app.getPath('userData'), 'state.json');
  const { state, recovered } = await bootstrap(
    { clock: systemClock, storage: createFileStorage(statePath), sensors: nullSensors },
    { packId: 'test-pack', lineId: 'brindille' }
  );

  if (recovered) {
    console.warn('[perch] etat precedent illisible, redemarrage a neuf');
  }

  console.log(
    `[perch] ${state.creature.lineId} niveau ${String(state.creature.level)}, ` +
      `capteurs « ${nullSensors.name} »`
  );
}

void main();
