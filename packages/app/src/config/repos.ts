import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
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

export const ConfigSchema = z.object({
  /** Dépôts git explicitement surveillés. Rien n'est jamais ajouté sans geste explicite. */
  repos: z.array(z.string()).readonly().default([]),
  /** Langue forcée. `null` = celle du système. */
  locale: z.enum(['fr', 'en']).nullable().default(null),
  /**
   * Mode privé : suspend TOUTE mesure. Le compagnon s'endort et ne progresse plus.
   * C'est une promesse du cadrage, pas une option cosmétique.
   */
  privateMode: z.boolean().default(false),
  /** Liste de tâches interne. Cochée aujourd'hui = compte pour la quête du jour. */
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        doneOn: z.string().nullable().default(null),
      })
    )
    .readonly()
    .default([]),
});

export type PerchConfig = z.infer<typeof ConfigSchema>;

export const emptyConfig: PerchConfig = {
  repos: [],
  locale: null,
  privateMode: false,
  tasks: [],
};

const defaultPath = (): string => configPath(process.env, homedir());

/**
 * Lit la configuration.
 *
 * Un fichier absent ou abîmé ne doit pas empêcher le compagnon de vivre : on repart d'une
 * configuration vide, ce qui signifie simplement « aucune source spécialisée ».
 */
export async function readConfig(path = defaultPath()): Promise<PerchConfig> {
  try {
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
    const parsed = ConfigSchema.safeParse(raw);
    return parsed.success ? parsed.data : emptyConfig;
  } catch {
    return emptyConfig;
  }
}

/** Écriture atomique, même discipline que l'état : rien ne doit laisser un fichier tronqué. */
export async function writeConfig(config: PerchConfig, path = defaultPath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

/** Tâches cochées le jour donné. Alimente la quête « cinq tâches ». */
export function tasksDoneOn(config: PerchConfig, dayKey: string): number {
  return config.tasks.filter((task) => task.doneOn === dayKey).length;
}
