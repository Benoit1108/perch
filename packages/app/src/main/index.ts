import { app, screen } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { detectActivity, withPrivacy } from '../activity/detect.js';
import { openChooser } from '../chooser/window.js';
import { readConfig } from '../config/repos.js';
import { openSettings, registerSettingsIpc } from '../settings/window.js';
import { systemClock } from '../adapters/clock.js';
import { createFileStorage } from '../adapters/storage.js';
import { Overlay } from '../overlay/window.js';
import type { DiscoveredPack } from '../packs/discover.js';
import { loadPacks } from '../packs/roots.js';
import { resolveCreature } from '../packs/resolve.js';
import { detectSensors } from '../sensors/detect.js';
import { nullSensors } from '../sensors/null.js';
import type { Environment } from '../platform.js';
import { currentEnvironment } from '../platform.js';
import { boxDirectory } from '../exchange/box.js';
import type { Locale, PerchState, Rect } from '@perch/core';
import { boundingBox, defaultEarnConfig, progressFor, resolveLocale } from '@perch/core';

import { bootstrap } from './bootstrap.js';
import type { Companion } from './creature.js';
import type { Exchange } from './exchange.js';
import { createExchange } from './exchange.js';
import { createBox } from './box.js';
import { installEscapeHatches } from './escape-hatches.js';
import { ensureX11 } from './ozone.js';
import { survivePipeClosure } from './output.js';
import { startLoop } from './loop.js';
import type { Progression } from './progression.js';
import { startCreature } from './runtime.js';
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

/**
 * La boîte d'échange, à l'emplacement conventionnel.
 *
 * Elle ne vit dans le dossier d'aucune des deux applications : rangée chez l'une, elle
 * disparaîtrait avec elle.
 */
function openExchange(env: Environment, packs: readonly DiscoveredPack[]): Exchange {
  return createExchange({
    packs,
    directory: boxDirectory({
      os: env.os,
      home: app.getPath('home'),
      xdgDataHome: process.env['XDG_DATA_HOME'],
      appData: process.env['APPDATA'],
    }),
    appVersion: app.getVersion(),
    newId: () => randomUUID().slice(0, 12),
    now: () => new Date().toISOString(),
  });
}

/**
 * Zone du bureau réellement disponible, barres système exclues.
 *
 * `workArea` retranche ce que l'environnement se réserve — la barre du haut occupe les
 * trente-deux premiers pixels sur cette machine. Ces panneaux se dessinent au-dessus de
 * TOUTE fenêtre : s'y aventurer ne rend pas le compagnon invisible, il le coupe en deux.
 */
function workArea(): Rect | null {
  return boundingBox(screen.getAllDisplays().map((display) => display.workArea));
}

/** Branche la fenêtre de réglages sur ce qu'elle pilote. */
function wireSettings(
  exchange: Exchange,
  progression: Progression,
  companion: Companion,
  onChange: () => void
): void {
  registerSettingsIpc({
    onChange,
    onCompanion: () => {
      openChooser();
    },
    box: createBox(exchange, progression, companion),
  });

  if (process.argv.includes('--settings')) openSettings();
}

function announce(state: PerchState, packs: readonly DiscoveredPack[], sensorName: string): void {
  const progress = progressFor(state.creature.xp);
  const { packId, lineId } = state.creature;
  const affiche = resolveCreature(packs, packId, lineId, progress.level);

  console.log(
    `[perch] ${affiche?.stage.name ?? 'aucune creature'} niveau ${String(progress.level)} — ` +
      `${String(Math.round(progress.inLevel))}/${progress.toNext === null ? '∞' : String(progress.toNext)} XP, ` +
      `capteurs « ${sensorName} »`
  );
}

async function main(): Promise<void> {
  // AVANT tout le reste, y compris le verrou d'instance unique : la relance doit partir
  // d'un processus qui n'a encore rien réservé.
  if (ensureX11(process.env, process.argv)) {
    app.exit(0);
    return;
  }

  // UN seul dossier pour la configuration et pour l'état. Sans cela, Electron déduit le
  // chemin du nom de paquet npm et range l'état dans `@perch/app`, à côté d'un `perch`
  // qui contient déjà la configuration — deux dossiers pour une seule application, et un
  // nom que personne ne comprend en ouvrant `~/.config`.
  //
  // À faire AVANT toute lecture de chemin : `getPath('userData')` fige la réponse.
  app.setName('perch');

  // AVANT le premier `console.log` : lancée depuis un lanceur de bureau, l'application
  // n'a personne au bout de sa sortie standard, et le premier message la ferait tomber.
  survivePipeClosure([process.stdout, process.stderr]);

  if (!claimSingleInstance()) return;

  await app.whenReady();
  installEscapeHatches();

  const installed = await loadPacks();

  const statePath = join(app.getPath('userData'), 'state.json');
  const storage = createFileStorage(statePath);
  const { state, recovery } = await bootstrap(
    { clock: systemClock, storage, sensors: nullSensors },
    installed.defaults
  );

  reportRecovery(recovery);

  const overlay = new Overlay();
  const env = currentEnvironment();
  const sensors = await detectSensors(env);

  let config = await readConfig();
  const reloadConfig = (): void => {
    void readConfig().then((fresh) => {
      config = fresh;
    });
  };

  // Fonction et non valeur : `config` est remplacé à chaque enregistrement des réglages.
  const locale = (): Locale => resolveLocale(config.locale ?? app.getLocale());
  const voice = new Voice(locale, systemClock);

  const activity = withPrivacy(await detectActivity(env), () => config.privateMode);

  const { progression, companion } = startCreature({
    state,
    packs: installed.packs,
    overlay,
    storage,
    activity,
    voice,
    locale,
    fresh: recovery.kind === 'fresh',
  });

  wireSettings(openExchange(env, installed.packs), progression, companion, reloadConfig);

  const stop = startLoop({
    overlay,
    sensors,
    debug: process.env['PERCH_DEBUG'] === '1',
    voice,
    // La MÊME source que l'expérience : le mode privé endort le compagnon pour de bon,
    // au lieu de le laisser gambader pendant qu'on ne mesure plus rien.
    activity,
    workArea,
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

  announce(state, installed.packs, sensors.name);
}

void main();

app.on('window-all-closed', () => {
  app.quit();
});
