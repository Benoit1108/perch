import { app } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectActivity, withPrivacy } from '../activity/detect.js';
import { configureChooser, openChooser } from '../chooser/window.js';
import { readConfig } from '../config/repos.js';
import { openSettings, registerSettingsIpc } from '../settings/window.js';
import { snapshotSources } from '../sources/snapshot.js';
import { systemClock } from '../adapters/clock.js';
import { createFileStorage } from '../adapters/storage.js';
import { Overlay } from '../overlay/window.js';
import type { DiscoveredPack } from '../packs/discover.js';
import { defaultsFrom, discoverPacksIn } from '../packs/discover.js';
import { resolveCreature } from '../packs/resolve.js';
import { detectSensors } from '../sensors/detect.js';
import { nullSensors } from '../sensors/null.js';
import { currentEnvironment } from '../platform.js';
import type { ActivityPort, Locale, PerchState, StoragePort } from '@perch/core';
import { defaultEarnConfig, progressFor, resolveLocale } from '@perch/core';

import type { Defaults } from './bootstrap.js';
import { bootstrap } from './bootstrap.js';
import { createCompanion } from './creature.js';
import { installEscapeHatches } from './escape-hatches.js';
import { startLoop } from './loop.js';
import type { Progression } from './progression.js';
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

/**
 * Packs installés, avec le pack et la lignée de départ qu'on en déduit (invariant I9).
 *
 * Aucun pack n'est un cas NORMAL, pas une panne : le dépôt n'en contient aucun
 * (invariant I5) et `npm run pack:fetch` les fabrique. On démarre alors avec un compagnon
 * sans nom plutôt que de refuser de se lancer — un non-technicien ne doit pas se heurter
 * à un code de sortie parce qu'il manque des images.
 */
async function loadPacks(): Promise<{
  packs: readonly DiscoveredPack[];
  defaults: Defaults;
}> {
  // Trois emplacements, dans cet ordre de priorité :
  //
  //   1. le dossier de l'utilisateur, seul inscriptible après installation — c'est là
  //      qu'atterrissent les packs téléchargés ou déposés à la main (invariant I5) ;
  //   2. les ressources livrées avec l'application, que la construction y a placées ;
  //   3. le dépôt, en développement seulement.
  //
  // Le troisième chemin ne veut plus rien dire une fois empaqueté : il pointait dans le
  // point de montage de l'AppImage, et le compagnon démarrait sans visage alors que ses
  // images étaient bien livrées, deux dossiers plus loin.
  const roots = [
    join(app.getPath('userData'), 'packs'),
    join(process.resourcesPath, 'packs'),
    fileURLToPath(new URL('../../../../packs', import.meta.url)),
  ];

  const packs = await discoverPacksIn(roots);
  const defaults = defaultsFrom(packs);

  if (defaults === null) {
    console.warn(
      `[perch] aucun pack de creatures dans ${roots.join(' ni ')} — lancer « npm run pack:fetch ».`
    );
    return { packs, defaults: { packId: '', lineId: '' } };
  }
  return { packs, defaults };
}

interface CreatureDeps {
  readonly state: PerchState;
  readonly packs: readonly DiscoveredPack[];
  readonly overlay: Overlay;
  readonly storage: StoragePort;
  readonly activity: ActivityPort;
  readonly voice: Voice;
  readonly locale: () => Locale;
  /** Premier lancement : on propose alors de choisir son compagnon. */
  readonly fresh: boolean;
}

/**
 * L'expérience et l'apparence, qui avancent ensemble.
 *
 * Les deux sont montées ici parce qu'elles se répondent : c'est une montée de niveau qui
 * déclenche une évolution, donc un changement d'apparence.
 */
function startCreature(deps: CreatureDeps): Progression {
  const companion = createCompanion({
    packs: deps.packs,
    sink: deps.overlay,
    packId: deps.state.creature.packId,
    lineId: deps.state.creature.lineId,
  });

  // Le niveau précédent est suivi ICI : `onLevelUp` ne rapporte que le niveau atteint, et
  // une évolution se reconnaît au franchissement d'un palier, pas à un niveau isolé.
  let level = deps.state.creature.level;

  const progression = startProgression(deps.state, {
    clock: systemClock,
    activity: deps.activity,
    storage: deps.storage,
    sources: snapshotSources,
    onLevelUp: (reached) => {
      const evolution = companion.evolutionAt(level, reached);
      level = reached;

      if (evolution === null) {
        deps.voice.say({
          key: 'speech.levelUp',
          register: 'evenement',
          params: { level: reached },
        });
        return;
      }
      // Une évolution ÉCLIPSE la montée de niveau : deux bulles coup sur coup pour le
      // même événement, c'est une de trop (invariant I6).
      deps.voice.say({
        key: 'speech.evolved',
        register: 'evenement',
        params: { name: evolution.name },
      });
      void companion.show(reached, true);
    },
    onQuestDone: () => {
      deps.voice.say({ key: 'speech.questDone', register: 'evenement' });
    },
  });

  void companion.show(level);

  configureChooser({
    locale: deps.locale,
    choices: () => companion.choices(),
    offers: (packId: string, lineId: string) => companion.offers(packId, lineId),
    onPick: async (packId: string, lineId: string) => {
      await progression.chooseCreature(packId, lineId);
      await companion.choose(packId, lineId, progression.current().creature.level);
    },
  });

  // Ouvert d'office au premier lancement SEULEMENT : on ne redemande jamais à quelqu'un
  // qui a déjà un compagnon — les réglages sont là pour ça. Le choix arrive APRÈS le
  // démarrage : l'état porte déjà une lignée par défaut, donc fermer la fenêtre sans rien
  // choisir laisse un compagnon vivant plutôt qu'une application bloquée.
  if (deps.fresh) openChooser();

  return progression;
}

/**
 * Annonce ce qui est RÉELLEMENT affiché.
 *
 * L'état peut nommer un pack retiré depuis : `resolveCreature` se replie alors sur ce qui
 * existe, et afficher le nom stocké laisserait croire à une créature qu'on ne voit nulle
 * part.
 */
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
  registerSettingsIpc(
    () => {
      void readConfig().then((fresh) => {
        config = fresh;
      });
    },
    () => {
      openChooser();
    }
  );

  // Fonction et non valeur : `config` est remplacé à chaque enregistrement des réglages.
  const locale = (): Locale => resolveLocale(config.locale ?? app.getLocale());
  const voice = new Voice(locale, systemClock);

  if (process.argv.includes('--settings')) openSettings();

  const activity = withPrivacy(await detectActivity(env), () => config.privateMode);

  const progression = startCreature({
    state,
    packs: installed.packs,
    overlay,
    storage,
    activity,
    voice,
    locale,
    fresh: recovery.kind === 'fresh',
  });

  const stop = startLoop({
    overlay,
    sensors,
    debug: process.env['PERCH_DEBUG'] === '1',
    voice,
    // La MÊME source que l'expérience : le mode privé endort le compagnon pour de bon,
    // au lieu de le laisser gambader pendant qu'on ne mesure plus rien.
    activity,
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
