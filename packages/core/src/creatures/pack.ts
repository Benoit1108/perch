import { CreaturePackSchema } from './manifest.js';
import type { CreatureLine, CreaturePack, CreatureStage } from './manifest.js';

/** Erreur levée quand un pack est structurellement valide mais incohérent. */
export class InvalidPackError extends Error {
  public override readonly name = 'InvalidPackError';
}

/**
 * Règles qu'un schéma ne peut pas exprimer seul.
 *
 * Une lignée sans stade au niveau 1 laisserait une créature sans apparence au démarrage,
 * et deux stades au même palier rendraient l'évolution non déterministe. Les deux cas
 * passent la validation de forme, d'où cette passe supplémentaire.
 */
function assertCoherent(pack: CreaturePack): void {
  for (const line of pack.lines) {
    if (!line.stages.some((stage) => stage.fromLevel === 1)) {
      throw new InvalidPackError(`lignée « ${line.id} » : aucun stade ne démarre au niveau 1`);
    }

    const levels = new Set(line.stages.map((stage) => stage.fromLevel));
    if (levels.size !== line.stages.length) {
      throw new InvalidPackError(
        `lignée « ${line.id} » : deux stades partagent le même niveau de départ`
      );
    }
  }

  const ids = new Set(pack.lines.map((line) => line.id));
  if (ids.size !== pack.lines.length) {
    throw new InvalidPackError(`pack « ${pack.id} » : deux lignées partagent le même identifiant`);
  }
}

/**
 * Valide une donnée arbitraire comme pack de créatures.
 *
 * Point d'entrée UNIQUE : la validation de forme et la validation sémantique sont
 * indissociables, pour qu'on ne puisse pas obtenir un pack typé sans l'avoir vérifié.
 *
 * @throws {z.ZodError} si la forme est invalide
 * @throws {InvalidPackError} si la forme est valide mais le contenu incohérent
 */
export function parseCreaturePack(raw: unknown): CreaturePack {
  const pack = CreaturePackSchema.parse(raw);
  assertCoherent(pack);
  return pack;
}

/** Retrouve une lignée par son identifiant. */
export function findLine(pack: CreaturePack, lineId: string): CreatureLine | undefined {
  return pack.lines.find((line) => line.id === lineId);
}

/**
 * Stade atteint à un niveau donné : le dernier stade dont `fromLevel` ne dépasse pas
 * le niveau. Les stades ne sont pas supposés triés dans le manifeste.
 */
export function stageForLevel(line: CreatureLine, level: number): CreatureStage {
  const ordered = [...line.stages].sort((a, b) => a.fromLevel - b.fromLevel);

  let current = ordered[0];
  if (current === undefined) {
    throw new InvalidPackError(`lignée « ${line.id} » : aucun stade`);
  }

  for (const stage of ordered) {
    if (stage.fromLevel > level) break;
    current = stage;
  }

  return current;
}

/**
 * Retrouve où loger une espèce venue d'ailleurs.
 *
 * C'est ce qui permet à une créature déposée par une autre application d'être adoptée ici :
 * l'enveloppe ne transporte qu'un identifiant d'espèce, et seul le manifeste sait à quelle
 * lignée il correspond. Rien n'est écrit en dur (invariant I9).
 */
export function findSpecies(
  pack: CreaturePack,
  species: string
): { readonly line: CreatureLine; readonly stage: CreatureStage } | undefined {
  for (const line of pack.lines) {
    const stage = line.stages.find((candidate) => candidate.species === species);
    if (stage !== undefined) return { line, stage };
  }
  return undefined;
}

/**
 * Stade nouvellement atteint entre deux niveaux, ou `null` si l'apparence ne change pas.
 *
 * C'est ce qui distingue une montée de niveau ordinaire d'une ÉVOLUTION, le seul moment
 * du jeu qui mérite d'être mis en scène. Le franchissement se calcule sur un INTERVALLE
 * plutôt qu'à l'égalité : une montée de plusieurs niveaux d'un coup — un retour de
 * congés, une quête qui achève sa journée — ne doit pas passer au travers.
 */
export function evolutionBetween(
  line: CreatureLine,
  fromLevel: number,
  toLevel: number
): CreatureStage | null {
  if (toLevel <= fromLevel) return null;

  const before = stageForLevel(line, fromLevel);
  const after = stageForLevel(line, toLevel);

  return after.id === before.id ? null : after;
}
