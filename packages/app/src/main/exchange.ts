import type { Envelope } from '@perch/core';
import { findSpecies, seal } from '@perch/core';

import type { DiscoveredPack } from '../packs/discover.js';
import { claim, deposit, listBox } from '../exchange/box.js';
import { resolveCreature } from '../packs/resolve.js';

/** Ce qu'une créature venue d'ailleurs devient ici, ou pourquoi elle ne le peut pas. */
export type Adoption =
  | {
      readonly kind: 'adoptee';
      readonly packId: string;
      readonly lineId: string;
      /** Niveau porté par l'enveloppe : elle a quitté la boîte, on ne l'y relira pas. */
      readonly level: number;
    }
  | { readonly kind: 'partie' }
  | { readonly kind: 'inconnue'; readonly species: string };

export interface ExchangeDeps {
  /** Relue à chaque usage : une créature installée après le démarrage compte aussi. */
  readonly packs: () => readonly DiscoveredPack[];
  readonly directory: string;
  readonly appVersion: string;
  /** Identifiant du dépôt et horodatage : injectés pour rester reproductibles en test. */
  readonly newId: () => string;
  readonly now: () => string;
}

export interface Creature {
  readonly packId: string;
  readonly lineId: string;
  readonly level: number;
  readonly xp: number;
}

export interface Exchange {
  /** Créatures en attente dans la boîte. */
  waiting(): Promise<readonly Envelope[]>;
  /** Confie une créature à la boîte. Renvoie `null` si elle n'a rien à y déclarer. */
  send(creature: Creature, note?: string): Promise<Envelope | null>;
  /** Retire une créature et dit ce qu'elle peut devenir ici. */
  take(id: string): Promise<Adoption>;
}

/**
 * La boîte d'échange, vue du compagnon.
 *
 * Aucune des deux applications n'a besoin que l'autre tourne : le fichier est le
 * protocole. Ce module ne fait que traduire entre l'état d'ici et l'enveloppe commune.
 */
export function createExchange(deps: ExchangeDeps): Exchange {
  return {
    waiting: async (): Promise<readonly Envelope[]> => listBox(deps.directory),

    send: async (creature: Creature, note?: string): Promise<Envelope | null> => {
      const resolved = resolveCreature(
        deps.packs(),
        creature.packId,
        creature.lineId,
        creature.level
      );

      // Sans espèce déclarée, la créature n'a pas de nom que l'autre application saurait
      // lire : le pack est purement original. Mieux vaut refuser le dépôt que d'écrire une
      // enveloppe que personne ne pourra jamais ouvrir.
      if (resolved?.stage.species === undefined) return null;

      const envelope = seal({
        id: deps.newId(),
        at: deps.now(),
        app: 'perch',
        version: deps.appVersion,
        creature: {
          species: resolved.stage.species,
          name: resolved.stage.name,
          level: creature.level,
          xp: creature.xp,
          shiny: false,
        },
        ...(note !== undefined && { note }),
      });

      await deposit(deps.directory, envelope);
      return envelope;
    },

    take: async (id: string): Promise<Adoption> => {
      const envelope = await claim(deps.directory, id);
      // Quelqu'un l'a prise avant nous — l'autre application, ou une autre fenêtre.
      if (envelope === null) return { kind: 'partie' };

      for (const entry of deps.packs()) {
        const trouve = findSpecies(entry.pack, envelope.creature.species);
        if (trouve !== undefined) {
          return {
            kind: 'adoptee',
            packId: entry.pack.id,
            lineId: trouve.line.id,
            level: envelope.creature.level,
          };
        }
      }

      return { kind: 'inconnue', species: envelope.creature.species };
    },
  };
}
