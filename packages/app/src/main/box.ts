import type { Companion } from './creature.js';
import type { Creature, Exchange } from './exchange.js';
import type { Progression } from './progression.js';

/**
 * La boîte d'échange, telle que la fenêtre de réglages la manipule.
 *
 * Les deux gestes sont NON DESTRUCTIFS, et c'est délibéré : un clic ne doit jamais faire
 * disparaître des semaines de progression.
 *
 * - déposer envoie une COPIE dans la boîte, le compagnon reste ici ;
 * - adopter échange : le compagnon d'ici part dans la boîte avant que l'autre n'arrive,
 *   donc il reste toujours récupérable.
 */
export function createBox(exchange: Exchange, progression: Progression, companion: Companion) {
  const courant = (): Creature => {
    const { creature } = progression.current();
    return creature;
  };

  return {
    list: async (): Promise<unknown> => exchange.waiting(),

    deposit: async (): Promise<unknown> => {
      const enveloppe = await exchange.send(courant());
      return enveloppe === null
        ? { kind: 'refuse' }
        : { kind: 'depose', name: enveloppe.creature.name };
    },

    withdraw: async (id: string): Promise<unknown> => {
      const partant = courant();
      const adoption = await exchange.take(id);
      if (adoption.kind !== 'adoptee') return adoption;

      // Le compagnon d'ici part APRÈS que l'autre est acquis : si le retrait échoue,
      // personne n'a bougé.
      await exchange.send(partant);

      await progression.adopt(adoption.packId, adoption.lineId, adoption.level);
      await companion.choose(adoption.packId, adoption.lineId, adoption.level);

      return { kind: 'adoptee', level: adoption.level };
    },
  };
}

/**
 * Annonce ce qui est RÉELLEMENT affiché.
 *
 * L'état peut nommer un pack retiré depuis : `resolveCreature` se replie alors sur ce qui
 * existe, et afficher le nom stocké laisserait croire à une créature qu'on ne voit nulle
 * part.
 */
