import { app, screen } from 'electron';
import { fileURLToPath } from 'node:url';

import { detectActivity, withPrivacy } from '../activity/detect.js';
import { readConfig } from '../config/repos.js';
import { openSettings, registerSettingsIpc } from '../settings/window.js';
import { snapshotSources } from '../sources/snapshot.js';
import { systemClock } from '../adapters/clock.js';
import { createFileStorage } from '../adapters/storage.js';
import { Overlay } from '../overlay/window.js';
import { defaultsFrom, discoverPacks } from '../packs/discover.js';
import { detectSensors } from '../sensors/detect.js';
import { nullSensors } from '../sensors/null.js';
import { defaultEarnConfig, progressFor, resolveLocale } from '@perch/core';

import { bootstrap } from './bootstrap.js';
import { installEscapeHatches } from './escape-hatches.js';
import { startLoop } from './loop.js';
import { startProgression } from './progression.js';
import { Voice } from './voice.js';

/**
 * Point d'entrée du process principal.
 *
 * ⚠️ `--ozone-platform=x11` doit être passé en LIGNE DE COMMANDE sur Linux (voir le script
 * `start`). `app.commandLine.appendSwitch` est sans effet : Electron choisit sa plateforme
 * d'affichage avant d'exécuter ce fichier, et l'application tourne alors en client Wayland
 * natif où `setBounds` et `setAlwaysOnTop` sont ignorés en silence.
 */
/**
 * Une seule instance à la fois.
 *
 * Un second lancement ne démarre pas un deuxième compagnon : il demande au premier
 * d'ouvrir ses réglages. C'est ce qui rend `npm run settings` possible alors que
 * l'overlay laisse passer tous les clics — il n'y a rien sur quoi cliquer.
 */
function claimSingleInstance(): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.exit(0);
    return false;
  }
  app.on('second-instance', () => {
    openSettings();
  });
  return true;
}

function reportRecovery(recovery: {
  kind: string;
  reason?: string;
  archivedAt?: string | null;
}): void {
  if (recovery.kind !== 'recovered') return;
  console.warn(
    `[perch] etat precedent illisible (${recovery.reason ?? '?'}) — redemarrage a neuf.` +
      (recovery.archivedAt === null || recovery.archivedAt === undefined
        ? ''
        : ` Ancien fichier conserve : ${recovery.archivedAt}`)
  );
}

/** Pack et lignée de départ, déduits de ce qui est installé (invariant I9). */
async function resolveDefaults(): Promise<{ packId: string; lineId: string } | null> {
  const packsRoot = fileURLToPath(new URL('../../../../packs', import.meta.url));
  const found = defaultsFrom(await discoverPacks(packsRoot));

  if (found === null) {
    console.error(`[perch] aucun pack de creatures utilisable dans ${packsRoot}`);
    app.exit(1);
  }
  return found;
}

async function main(): Promise<void> {
  if (!claimSingleInstance()) return;

  await app.whenReady();
  installEscapeHatches();

  const defaults = await resolveDefaults();
  if (defaults === null) return;

  const statePath = `${app.getPath('userData')}/state.json`;
  const storage = createFileStorage(statePath);
  const { state, recovery } = await bootstrap(
    { clock: systemClock, storage, sensors: nullSensors },
    defaults
  );

  reportRecovery(recovery);

  const overlay = new Overlay();
  const sensors = await detectSensors({
    monitors: () => screen.getAllDisplays().map((display) => display.bounds),
  });

  let config = await readConfig();
  registerSettingsIpc(() => {
    void readConfig().then((fresh) => {
      config = fresh;
    });
  });

  const voice = new Voice(resolveLocale(config.locale ?? app.getLocale()), systemClock);

  if (process.argv.includes('--settings')) openSettings();

  const progression = startProgression(state, {
    clock: systemClock,
    activity: withPrivacy(await detectActivity(), () => config.privateMode),
    storage,
    sources: snapshotSources,
    onLevelUp: (level) => {
      voice.say({ key: 'speech.levelUp', register: 'evenement', params: { level } });
    },
    onQuestDone: () => {
      voice.say({ key: 'speech.questDone', register: 'evenement' });
    },
  });

  const stop = startLoop({
    overlay,
    sensors,
    debug: process.env['PERCH_DEBUG'] === '1',
    voice,
    // La concentration est une donnée du moteur d'expérience, pas de l'animation.
    isFocused: () => (progression.current().day?.focusMs ?? 0) >= defaultEarnConfig.focusAfterMs,
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
