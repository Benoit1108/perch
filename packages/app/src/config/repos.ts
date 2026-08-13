import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { z } from 'zod';

/**
 * Emplacement de la configuration utilisateur.
 *
 * Séparée de `state.json` à dessein : l'état appartient au jeu, la configuration
 * appartient à l'utilisateur. Elle vit donc à un emplacement XDG standard, lisible et
 * modifiable sans lancer l'application.
 *
 * ⚠️ Ce calcul doit rester IDENTIQUE à celui de `scripts/watch.mjs`, qui ne peut pas
 * l'importer : la commande doit fonctionner sans que `dist/` soit construit.
 */
export function configPath(env: Record<string, string | undefined>, home: string): string {
  const base = env['XDG_CONFIG_HOME'] ?? `${home}/.config`;
  return `${base}/perch/config.json`;
}

const ConfigSchema = z.object({
  /** Dépôts git explicitement surveillés. Rien n'est jamais ajouté sans geste explicite. */
  repos: z.array(z.string()).readonly().default([]),
});

export type PerchConfig = z.infer<typeof ConfigSchema>;

export const emptyConfig: PerchConfig = { repos: [] };

/**
 * Lit la configuration.
 *
 * Un fichier absent ou abîmé ne doit pas empêcher le compagnon de vivre : on repart d'une
 * configuration vide, ce qui signifie simplement « aucune source spécialisée ».
 */
export async function readConfig(path = configPath(process.env, homedir())): Promise<PerchConfig> {
  try {
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
    const parsed = ConfigSchema.safeParse(raw);
    return parsed.success ? parsed.data : emptyConfig;
  } catch {
    return emptyConfig;
  }
}
