import type { CreatureStage } from '@perch/core';
import { evolutionBetween, findLine, stageForLevel } from '@perch/core';

import type { DiscoveredPack } from '../packs/discover.js';
import { playbackTable } from '../packs/playback.js';
import { resolveCreature } from '../packs/resolve.js';
import type { StageClips } from '../packs/sprites.js';
import { loadClips, loadPortrait } from '../packs/sprites.js';

/** Ce qu'on propose au choix : un nom et un portrait, rien de plus. */
export interface Choice {
  readonly packId: string;
  readonly lineId: string;
  readonly name: string;
  readonly portrait: string | null;
}

/**
 * L'apparence est un message REJOUABLE, pas un événement ordinaire.
 *
 * Elle n'est émise qu'à trois moments — démarrage, choix, évolution — et le rendu peut
 * très bien ne pas être prêt au premier : la page se charge en quelques centaines de
 * millisecondes, l'état est lu en quelques dizaines. Un message perdu là laisserait le
 * compagnon sur son marqueur de repli jusqu'à la prochaine évolution, c'est-à-dire des
 * jours. Les frames, elles, se rattrapent seules soixante fois par seconde.
 */
interface CreatureSink {
  retain(channel: string, payload: unknown, keep?: unknown): void;
}

export interface CompanionDeps {
  readonly packs: readonly DiscoveredPack[];
  readonly sink: CreatureSink;
  readonly packId: string;
  readonly lineId: string;
}

export interface Companion {
  /**
   * Envoie l'apparence courante au rendu.
   *
   * `evolved` déclenche la mise en scène. Elle voyage AVEC les images plutôt que dans un
   * message séparé : deux messages obligeraient les deux processus à s'accorder sur un
   * minutage, et une évolution jouerait à moitié dès que la lecture du disque traîne.
   */
  show(level: number, evolved?: boolean): Promise<void>;
  /** Adopte une autre créature, sans toucher à l'expérience acquise. */
  choose(packId: string, lineId: string, level: number): Promise<void>;
  /** Toutes les créatures proposables, avec leur portrait de départ. */
  choices(): Promise<readonly Choice[]>;
  /** La créature existe-t-elle vraiment ? Le rendu peut demander n'importe quoi. */
  offers(packId: string, lineId: string): boolean;
  /** Stade nouvellement atteint, s'il y en a un. */
  evolutionAt(fromLevel: number, toLevel: number): CreatureStage | null;
}

/** Les images seules : le rendu n'a que faire de la cadence d'origine des clips. */
function framesOf(clips: StageClips): Record<string, readonly string[]> {
  const frames: Record<string, readonly string[]> = {};

  for (const [name, clip] of Object.entries(clips)) {
    frames[name] = clip.frames;
  }
  return frames;
}

/**
 * L'apparence du compagnon, et ce qui la fait changer.
 *
 * Les images ne passent JAMAIS par la boucle d'animation : elles pèsent quelques dizaines
 * de kilo-octets, et les envoyer soixante fois par seconde saturerait le canal pour
 * retransmettre la même chose.
 */
export function createCompanion(deps: CompanionDeps): Companion {
  let packId = deps.packId;
  let lineId = deps.lineId;

  const show = async (level: number, evolved = false): Promise<void> => {
    const resolved = resolveCreature(deps.packs, packId, lineId, level);
    // Aucun pack exploitable : le rendu garde son marqueur de repli plutôt que d'effacer
    // le compagnon. Le dépôt ne contient aucun sprite (invariant I5), et un utilisateur
    // qui n'a pas encore téléchargé le pack doit voir quelque chose bouger.
    if (resolved === null) return;

    const clips = await loadClips(resolved.directory, resolved.stage);
    const apparence = {
      stageId: resolved.stage.id,
      name: resolved.stage.name,
      frames: framesOf(clips),
      byState: playbackTable(clips),
    };

    deps.sink.retain('perch:creature', { ...apparence, evolved }, { ...apparence, evolved: false });
  };

  return {
    show,

    choose: async (nextPack: string, nextLine: string, level: number): Promise<void> => {
      packId = nextPack;
      lineId = nextLine;
      await show(level);
    },

    /**
     * TOUS les packs installés, pas seulement celui en cours.
     *
     * Ne proposer que les lignées du pack courant enfermerait l'utilisateur dedans : un
     * pack dont les images n'ont pas été téléchargées n'offrirait que des portraits vides,
     * sans aucun moyen d'en sortir.
     */
    choices: async (): Promise<readonly Choice[]> => {
      const parPack = await Promise.all(
        deps.packs.map(async (entry) =>
          Promise.all(
            entry.pack.lines.map(async (line) => {
              const first = stageForLevel(line, 1);
              return {
                packId: entry.pack.id,
                lineId: line.id,
                name: first.name,
                portrait: await loadPortrait(entry.directory, first),
              };
            })
          )
        )
      );

      return parPack.flat();
    },

    offers: (wantedPack: string, wantedLine: string): boolean => {
      const found = deps.packs.find((entry) => entry.pack.id === wantedPack);
      return found !== undefined && findLine(found.pack, wantedLine) !== undefined;
    },

    evolutionAt: (fromLevel: number, toLevel: number): CreatureStage | null => {
      const resolved = resolveCreature(deps.packs, packId, lineId, fromLevel);
      return resolved === null ? null : evolutionBetween(resolved.line, fromLevel, toLevel);
    },
  };
}
