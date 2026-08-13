import { z } from 'zod';
import type { ClockPort } from '../ports/clock.js';

/**
 * Version du schéma d'état persisté.
 *
 * Règle de compatibilité : on AJOUTE des champs avec une valeur par défaut, on n'en
 * retire jamais. Un état écrit par une version antérieure doit toujours pouvoir être
 * relu — un utilisateur ne doit jamais perdre sa créature à cause d'une mise à jour.
 * C'est pourquoi `day` est optionnel : les états écrits avant S3 n'en ont pas.
 */
export const STATE_SCHEMA_VERSION = 1;

const DailyActivitySchema = z.object({
  dayKey: z.string().min(1),
  activeMs: z.number().nonnegative(),
  focusApp: z.string().nullable(),
  focusMs: z.number().nonnegative(),
});

const CreatureStateSchema = z.object({
  packId: z.string().min(1),
  lineId: z.string().min(1),
  level: z.number().int().min(1).max(100),
  // Fractionnaire : l'expérience s'accumule par pas d'une minute, et l'arrondi n'a lieu
  // qu'à l'affichage. Arrondir à chaque pas perdrait une fraction à chaque tick.
  xp: z.number().nonnegative(),
});

const PerchStateSchema = z.object({
  schemaVersion: z.literal(STATE_SCHEMA_VERSION),
  createdAt: z.number().int().nonnegative(),
  creature: CreatureStateSchema,
  day: DailyActivitySchema.optional(),
});

export type PerchState = z.infer<typeof PerchStateSchema>;

/** État d'une créature qui vient d'éclore. */
export function createInitialState(clock: ClockPort, packId: string, lineId: string): PerchState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    createdAt: clock.now(),
    creature: { packId, lineId, level: 1, xp: 0 },
  };
}

/**
 * Relit un état persisté.
 *
 * Renvoie `null` plutôt que de lever : un fichier corrompu ne doit pas empêcher
 * l'application de démarrer. L'appelant repart d'un état neuf et le signale.
 */
export function readState(raw: unknown): PerchState | null {
  const result = PerchStateSchema.safeParse(raw);
  return result.success ? result.data : null;
}
