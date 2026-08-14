import type { ClipName, PetState } from '@perch/core';
import { PET_STATES, PLAYBACK } from '@perch/core';

import type { LoadedClip } from './sprites.js';

/** L'animation à jouer dans un état, et sa cadence réelle. */
export interface Playhead {
  readonly clip: ClipName;
  readonly fps: number;
}

/**
 * Résout, pour chaque état, l'animation que le pack fournit vraiment.
 *
 * Ce calcul appartient au processus principal et non au rendu. `core` décrit une
 * PRÉFÉRENCE — « pour marcher, une animation de marche, sinon celle d'attente » — et un
 * facteur de vitesse ; seul le code qui a lu le disque sait ce qui existe. Laisser le
 * rendu trancher reviendrait à réécrire ce vocabulaire dans une page sans imports, hors
 * de portée d'ESLint comme des tests.
 *
 * Un état absent de la table signifie qu'aucune animation ne convient : le rendu affiche
 * alors son marqueur de repli, ce qui est le cas normal tant que le pack n'a pas été
 * téléchargé (invariant I5).
 */
export function playbackTable(
  clips: Partial<Record<ClipName, LoadedClip>>
): Partial<Record<PetState, Playhead>> {
  const table: Partial<Record<PetState, Playhead>> = {};

  for (const state of PET_STATES) {
    const preference = PLAYBACK[state];
    const name = preference.clips.find((candidate) => clips[candidate] !== undefined);
    const clip = name === undefined ? undefined : clips[name];

    if (name !== undefined && clip !== undefined) {
      table[state] = { clip: name, fps: clip.fps * preference.speed };
    }
  }

  return table;
}
