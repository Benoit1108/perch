import type { ActivityPort, Locale, PerchState, StoragePort } from '@perch/core';
import { translate } from '@perch/core';

import { configureChooser, openChooser } from '../chooser/window.js';
import { createAdoption } from '../packs/adopt.js';
import { userPacksRoot } from '../packs/roots.js';
import type { PackRegistry } from '../packs/registry.js';
import { loadCatalogue } from '../packs/species.js';
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
  readonly packs: PackRegistry;
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
    packs: deps.packs.all,
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

  wireChooser(deps, progression, companion);

  // Ouvert d'office au premier lancement SEULEMENT : on ne redemande jamais à quelqu'un
  // qui a déjà un compagnon — les réglages sont là pour ça. Le choix arrive APRÈS le
  // démarrage : l'état porte déjà une lignée par défaut, donc fermer la fenêtre sans rien
  // choisir laisse un compagnon vivant plutôt qu'une application bloquée.
  if (deps.fresh) openChooser();

  return { progression, companion };
}

/**
 * Branche la fenêtre de choix.
 *
 * Deux façons d'obtenir un compagnon, une seule façon de l'adopter : les créatures déjà
 * installées et celles du catalogue passent par le MÊME `adopte`. Ce qui change, c'est
 * seulement qu'il faut d'abord télécharger les secondes.
 */
function wireChooser(deps: CreatureDeps, progression: Progression, companion: Companion): void {
  const adoption = createAdoption({
    registry: deps.packs,
    root: userPacksRoot,
    catalogue: loadCatalogue,
    packName: () => translate(deps.locale(), 'chooser.myPack'),
  });

  const adopte = async (packId: string, lineId: string): Promise<void> => {
    await progression.chooseCreature(packId, lineId);
    await companion.choose(packId, lineId, progression.current().creature.level);
  };

  configureChooser({
    locale: deps.locale,
    choices: () => companion.choices(),
    offers: (packId: string, lineId: string) => companion.offers(packId, lineId),
    onPick: adopte,
    search: (query: string) => adoption.search(query),
    onAdopt: async (familyId: string): Promise<boolean> => {
      const adoptee = await adoption.adopt(familyId);
      if (adoptee === null) return false;

      await adopte(adoptee.packId, adoptee.lineId);
      return true;
    },
  });
}
