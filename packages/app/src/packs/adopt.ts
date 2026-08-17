import { installSpecies } from './install.js';
import type { PackRegistry } from './registry.js';
import type { SpeciesFamily } from './species.js';
import { searchSpecies } from './species.js';

/** Une créature proposée à l'adoption : son nom, et ce qu'elle deviendra. */
export interface Suggestion {
  readonly familyId: string;
  readonly name: string;
  /** Les noms de la lignée, du premier stade au dernier — c'est l'évolution promise. */
  readonly line: readonly string[];
}

export interface AdoptDeps {
  readonly registry: PackRegistry;
  /** Dossier inscriptible où atterrissent les images (invariant I5). */
  readonly root: () => string;
  /** Chargé à la première recherche : soixante-dix kilo-octets qu'on ne lit pas pour rien. */
  readonly catalogue: () => Promise<readonly SpeciesFamily[]>;
  /** Nom du pack personnel, traduit (invariant I8). */
  readonly packName: () => string;
}

export interface Adoption {
  search(query: string): Promise<readonly Suggestion[]>;
  /**
   * Télécharge la lignée et la rend disponible.
   *
   * Renvoie le couple à adopter, ou `null` si la famille est inconnue — le rendu peut
   * demander n'importe quoi, et un identifiant inventé ne doit pas faire tomber le
   * processus principal.
   */
  adopt(familyId: string): Promise<{ readonly packId: string; readonly lineId: string } | null>;
}

/**
 * Adopter n'importe quelle créature du catalogue.
 *
 * Le format de pack est le SEUL contrat : ce module le remplit par téléchargement, et une
 * créature fabriquée à la main remplit exactement le même dossier. Rien ici n'est
 * particulier au catalogue livré — c'est ce qui permet à quelqu'un d'apporter une créature
 * qui n'a jamais existé dans un jeu, avec ses propres stades d'évolution.
 */
export function createAdoption(deps: AdoptDeps): Adoption {
  let charge: Promise<readonly SpeciesFamily[]> | null = null;

  const catalogue = async (): Promise<readonly SpeciesFamily[]> => {
    charge ??= deps.catalogue();
    return charge;
  };

  return {
    search: async (query: string): Promise<readonly Suggestion[]> =>
      searchSpecies(await catalogue(), query).map((famille) => ({
        familyId: famille.id,
        // Le nom montré est celui du PREMIER stade : c'est la créature qu'on recevra, même
        // en ayant cherché sa forme finale.
        name: famille.stages[0]?.fr ?? famille.id,
        line: famille.stages.map((stade) => stade.fr),
      })),

    adopt: async (familyId: string) => {
      const famille = (await catalogue()).find((entry) => entry.id === familyId);
      if (famille === undefined) return null;

      const adoptee = await installSpecies(deps.root(), famille, deps.packName());
      // Le registre est relu AVANT de rendre la main : sans cela le compagnon chercherait
      // une lignée que sa liste ne contient pas encore, et resterait sur son marqueur de
      // repli jusqu'au redémarrage suivant.
      await deps.registry.reload();

      return adoptee;
    },
  };
}
