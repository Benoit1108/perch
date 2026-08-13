import { app, screen } from 'electron';
import { fileURLToPath } from 'node:url';

import { systemClock } from '../adapters/clock.js';
import { createFileStorage } from '../adapters/storage.js';
import { Overlay } from '../overlay/window.js';
import { defaultsFrom, discoverPacks } from '../packs/discover.js';
import { detectSensors } from '../sensors/detect.js';
import { nullSensors } from '../sensors/null.js';
import { bootstrap } from './bootstrap.js';
import { installEscapeHatches } from './escape-hatches.js';
import { startLoop } from './loop.js';

/**
 * Point d'entrée du process principal.
 *
 * ⚠️ `--ozone-platform=x11` doit être passé en LIGNE DE COMMANDE sur Linux (voir le script
 * `start`). `app.commandLine.appendSwitch` est sans effet : Electron choisit sa plateforme
 * d'affichage avant d'exécuter ce fichier, et l'application tourne alors en client Wayland
 * natif où `setBounds` et `setAlwaysOnTop` sont ignorés en silence.
 */
async function main(): Promise<void> {
  await app.whenReady();
  installEscapeHatches();

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

  const overlay = new Overlay();
  const sensors = await detectSensors({
    monitors: () => screen.getAllDisplays().map((display) => display.bounds),
  });

  const stop = startLoop({
    overlay,
    sensors,
    debug: process.env['PERCH_DEBUG'] === '1',
  });

  app.on('will-quit', () => {
    stop();
    overlay.destroy();
  });

  console.log(
    `[perch] ${state.creature.lineId} niveau ${String(state.creature.level)}, ` +
      `capteurs « ${sensors.name} »`
  );
}

void main();

app.on('window-all-closed', () => {
  app.quit();
});
