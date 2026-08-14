import type { CreatureLine, CreatureStage } from '@perch/core';
import { findLine, stageForLevel } from '@perch/core';

import type { DiscoveredPack } from './discover.js';

export interface ResolvedCreature {
  readonly directory: string;
  readonly line: CreatureLine;
  readonly stage: CreatureStage;
}

/**
 * Retrouve l'apparence courante à partir de l'état persisté.
 *
 * TOUT y est tolérant, et c'est délibéré : l'état nomme un pack et une lignée, mais un
 * pack est un dossier que l'utilisateur peut supprimer, renommer ou remplacer entre deux
 * lancements. Échouer reviendrait à refuser de démarrer parce qu'un fichier d'images a
 * bougé ; on se rabat donc sur ce qui existe, en conservant la progression.
 *
 * Le repli est ORDONNÉ — pack demandé, sinon premier installé ; lignée demandée, sinon
 * première du pack — de sorte que deux lancements consécutifs donnent le même compagnon.
 */
export function resolveCreature(
  packs: readonly DiscoveredPack[],
  packId: string,
  lineId: string,
  level: number
): ResolvedCreature | null {
  const found = packs.find((entry) => entry.pack.id === packId) ?? packs[0];
  if (found === undefined) return null;

  const line = findLine(found.pack, lineId) ?? found.pack.lines[0];
  if (line === undefined) return null;

  return { directory: found.directory, line, stage: stageForLevel(line, level) };
}
