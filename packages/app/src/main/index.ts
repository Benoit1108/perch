import { app, screen } from 'electron';
import { fileURLToPath } from 'node:url';

import { detectActivity } from '../activity/detect.js';
import { systemClock } from '../adapters/clock.js';
import { createFileStorage } from '../adapters/storage.js';
import { Overlay } from '../overlay/window.js';
import { defaultsFrom, discoverPacks } from '../packs/discover.js';
import { detectSensors } from '../sensors/detect.js';
import { nullSensors } from '../sensors/null.js';
import { progressFor } from '@perch/core';

import { bootstrap } from './bootstrap.js';
import { installEscapeHatches } from './escape-hatches.js';
import { startLoop } from './loop.js';
import { startProgression } from './progression.js';

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
  const storage = createFileStorage(statePath);
  const { state, recovery } = await bootstrap(
    { clock: systemClock, storage, sensors: nullSensors },
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

  const progression = startProgression(state, {
    clock: systemClock,
    activity: await detectActivity(),
    storage,
    onLevelUp: (level) => {
      console.log(`[perch] niveau ${String(level)} !`);
    },
  });

  const stop = startLoop({
    overlay,
    sensors,
    debug: process.env['PERCH_DEBUG'] === '1',
  });

  app.on('will-quit', () => {
    stop();
    progression.stop();
    overlay.destroy();
    // Dernière écriture : sans elle, jusqu'à une minute d'expérience se perd à la fermeture.
    void storage.write(progression.current());
  });

  const progress = progressFor(state.creature.xp);
  console.log(
    `[perch] ${state.creature.lineId} niveau ${String(progress.level)} — ` +
      `${String(Math.round(progress.inLevel))}/${progress.toNext === null ? '∞' : String(progress.toNext)} XP, ` +
      `capteurs « ${sensors.name} »`
  );
}

void main();

app.on('window-all-closed', () => {
  app.quit();
});
