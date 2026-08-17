import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const StageSchema = z.object({
  /** Identifiant de sprite, commun à Showdown et à notre manifeste de pack. */
  id: z.string().min(1),
  fr: z.string().min(1),
  en: z.string().min(1),
});

const FamilySchema = z.object({
  id: z.string().min(1),
  num: z.number().int().positive(),
  stages: z.array(StageSchema).min(1),
});

export type SpeciesFamily = z.infer<typeof FamilySchema>;

/** Sans accents ni casse : « salameche » doit trouver « Salamèche ». */
function pliage(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase();
}

/**
 * Familles dont un stade porte ce nom.
 *
 * La recherche porte sur TOUS les stades, pas seulement le premier : quelqu'un qui tape
 * « Ectoplasma » cherche la lignée de Fantominus, et « Pikachu » celle de Pichu. C'est
 * ensuite son niveau qui décide du stade affiché.
 */
export function searchSpecies(
  catalogue: readonly SpeciesFamily[],
  query: string,
  limit = 12
): readonly SpeciesFamily[] {
  const cherche = pliage(query.trim());
  if (cherche === '') return [];

  const correspond = (famille: SpeciesFamily): boolean =>
    famille.stages.some(
      (stade) => pliage(stade.fr).includes(cherche) || pliage(stade.en).includes(cherche)
    );

  // Ce qui COMMENCE par la recherche passe devant : « ma » doit proposer Magicarpe avant
  // Roucarnage, qui ne contient le motif qu'au milieu.
  const debute = (famille: SpeciesFamily): boolean =>
    famille.stages.some(
      (stade) => pliage(stade.fr).startsWith(cherche) || pliage(stade.en).startsWith(cherche)
    );

  return catalogue
    .filter(correspond)
    .sort((a, b) => Number(debute(b)) - Number(debute(a)) || a.num - b.num)
    .slice(0, limit);
}

/**
 * Le catalogue livré avec l'application.
 *
 * Du TEXTE uniquement — identifiants, noms, chaînes d'évolution. Aucune image n'est
 * versionnée (invariant I5) : les sprites se téléchargent au moment du choix.
 */
export async function loadCatalogue(): Promise<readonly SpeciesFamily[]> {
  const chemin = fileURLToPath(new URL('../../assets/species.json', import.meta.url));

  try {
    const brut: unknown = JSON.parse(await readFile(chemin, 'utf8'));
    return z.array(FamilySchema).parse(brut);
  } catch {
    // Catalogue absent ou abîmé : on ne propose que les packs installés, sans plus.
    return [];
  }
}
