import { app } from 'electron';
import { fileURLToPath } from 'node:url';

import { systemClock } from '../adapters/clock.js';
import { createFileStorage } from '../adapters/storage.js';
import { defaultsFrom, discoverPacks } from '../packs/discover.js';
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

  const packsRoot = fileURLToPath(new URL('../../../../packs', import.meta.url));
  const defaults = defaultsFrom(await discoverPacks(packsRoot));

  if (defaults === null) {
    console.error(`[perch] aucun pack de creatures utilisable dans ${packsRoot}`);
    app.exit(1);
    return;
  }

  const statePath = `${app.getPath('userData')}/state.json`;
  const { state, recovery } = await bootstrap(
    { clock: systemClock, storage: createFileStorage(statePath), sensors: nullSensors },
    defaults
  );

  if (recovery.kind === 'recovered') {
    console.warn(
      `[perch] etat precedent illisible (${recovery.reason}) — redemarrage a neuf.` +
        (recovery.archivedAt === null ? '' : ` Ancien fichier conserve : ${recovery.archivedAt}`)
    );
  }

  console.log(
    `[perch] ${state.creature.lineId} niveau ${String(state.creature.level)}, ` +
      `capteurs « ${nullSensors.name} »`
  );
}

void main();
