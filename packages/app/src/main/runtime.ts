import type { ActivityPort, Locale, PerchState, StoragePort } from '@perch/core';

import { configureChooser, openChooser } from '../chooser/window.js';
import type { DiscoveredPack } from '../packs/discover.js';
import { systemClock } from '../adapters/clock.js';
import { snapshotSources } from '../sources/snapshot.js';
import type { Overlay } from '../overlay/window.js';

import type { Companion } from './creature.js';
import { createCompanion } from './creature.js';
import type { Progression } from './progression.js';
import { startProgression } from './progression.js';
import type { Voice } from './voice.js';

export interface CreatureDeps {
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
export function startCreature(deps: CreatureDeps): {
  progression: Progression;
  companion: Companion;
} {
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

  return { progression, companion };
}
