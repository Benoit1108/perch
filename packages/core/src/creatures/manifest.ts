import { z } from 'zod';

/**
 * Schéma d'un pack de créatures.
 *
 * INVARIANT I9 — aucun identifiant de créature n'est écrit en dur dans le code. Tout
 * passe par ce manifeste, ce qui permet de remplacer entièrement le pack par défaut
 * sans toucher au moteur, et de tester avec un pack minimal plutôt qu'avec le vrai jeu.
 *
 * Les types sont INFÉRÉS depuis les schémas, jamais déclarés en double : c'est ce qui
 * rend l'interdiction des assertions de type tenable.
 */

const identifier = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/u, 'identifiant en minuscules, chiffres et tirets uniquement');

export const CreatureStageSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  /** Chemin du sprite, relatif au dossier du pack. Jamais committé (invariant I5). */
  sprite: z.string().min(1),
  /** Niveau à partir duquel ce stade est atteint. Le premier stade vaut toujours 1. */
  fromLevel: z.number().int().min(1).max(100),
});

export const CreatureLineSchema = z.object({
  id: identifier,
  stages: z.array(CreatureStageSchema).min(1),
});

export const CreaturePackSchema = z.object({
  schemaVersion: z.literal(1),
  id: identifier,
  name: z.string().min(1),
  /** Licence des assets. Obligatoire : un pack sans licence explicite est un risque. */
  license: z.string().min(1),
  lines: z.array(CreatureLineSchema).min(1),
});

export type CreatureStage = z.infer<typeof CreatureStageSchema>;
export type CreatureLine = z.infer<typeof CreatureLineSchema>;
export type CreaturePack = z.infer<typeof CreaturePackSchema>;
