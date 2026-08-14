import type { PetState } from '../motion/pet.js';
import type { ClipName } from './manifest.js';

/**
 * Comment jouer l'animation dans un état donné.
 *
 * `clips` est un ORDRE DE PRÉFÉRENCE, pas un choix : le pack par défaut ne fournit qu'une
 * boucle d'attente, un pack ambitieux en fournira quatre, et le moteur doit fonctionner
 * dans les deux cas sans avoir à le savoir.
 *
 * `speed` multiplie la cadence de l'animation retenue. C'est ce qui permet d'exprimer
 * « il dort » avec les mêmes images qu'« il attend » — un souffle lent plutôt qu'une image
 * figée, qui donnerait un compagnon en panne plutôt qu'un compagnon endormi.
 */
export interface Playback {
  readonly clips: readonly ClipName[];
  readonly speed: number;
}

/**
 * Table complète, exportée telle quelle.
 *
 * Elle part vers le rendu en un seul envoi, au chargement de la créature. Le rendu vit
 * dans une page sans imports (règle A4) : lui laisser choisir son animation reviendrait à
 * réécrire ce vocabulaire en JavaScript non testé, où il divergerait à la première
 * évolution du moteur.
 *
 * Le type est exhaustif : ajouter un état au compagnon sans lui donner d'animation ne
 * compile pas.
 */
export const PLAYBACK: Readonly<Record<PetState, Playback>> = {
  repos: { clips: ['repos'], speed: 1 },
  marche: { clips: ['marche', 'repos'], speed: 1.25 },
  escalade: { clips: ['marche', 'repos'], speed: 1.4 },
  chute: { clips: ['chute', 'marche', 'repos'], speed: 1.6 },
  suit: { clips: ['chute', 'marche', 'repos'], speed: 1.6 },
  sommeil: { clips: ['sommeil', 'repos'], speed: 0.35 },
};
