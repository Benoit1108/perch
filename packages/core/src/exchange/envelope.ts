import { z } from 'zod';

/**
 * Enveloppe d'échange entre applications compagnon.
 *
 * Deux programmes qui ne se connaissent pas, écrits dans deux langages, déposent et
 * retirent des créatures dans un dossier commun. Rien ne tourne des deux côtés en même
 * temps : le fichier EST le protocole.
 *
 * Ce qui voyage, et ce qui ne voyage pas :
 *
 * - l'ESPÈCE voyage, sous l'identifiant que les deux projets emploient déjà — celui des
 *   sprites Showdown. C'est le seul vocabulaire réellement partagé ;
 * - le NIVEAU voyage : c'est une échelle bornée, comparable d'une application à l'autre ;
 * - l'EXPÉRIENCE ne voyage PAS. Les courbes n'ont rien à voir — seize millions de points
 *   valent le niveau 20 d'un côté, une poignée de milliers de l'autre. La transporter
 *   telle quelle donnerait un compagnon niveau 100 ou niveau 1 selon le sens du voyage.
 *   Elle est jointe pour information, et l'application qui reçoit recalcule la sienne.
 */
export const ENVELOPE_VERSION = 1;

/** Identifiant d'espèce dans le vocabulaire partagé (`gastly`, `rowlet`, `pikachu`…). */
const species = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/u, 'identifiant d’espèce en minuscules, chiffres et tirets');

const OriginSchema = z.object({
  /** Nom de l'application qui a déposé. Informatif : personne ne décide sur cette base. */
  app: z.string().min(1).max(64),
  version: z.string().max(32).optional(),
});

const TravellerSchema = z.object({
  species,
  /** Nom tel que l'expéditeur l'affiche. L'autre application peut avoir le sien. */
  name: z.string().min(1).max(64),
  level: z.number().int().min(1).max(100),
  /** Jointe pour information seulement : les courbes ne sont pas comparables. */
  xp: z.number().nonnegative().optional(),
  shiny: z.boolean().default(false),
});

export const EnvelopeSchema = z.object({
  envelopeVersion: z.literal(ENVELOPE_VERSION),
  /** Identifiant du dépôt. Sert de nom de fichier, d'où le format restreint. */
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/u, 'identifiant de dépôt en minuscules, chiffres et tirets'),
  depositedAt: z.string().min(1).max(40),
  origin: OriginSchema,
  creature: TravellerSchema,
  /** Un mot laissé à qui retirera la créature. */
  note: z.string().max(280).optional(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;
export type Traveller = z.infer<typeof TravellerSchema>;

export interface DepositRequest {
  readonly id: string;
  readonly at: string;
  readonly app: string;
  readonly version?: string;
  readonly creature: Traveller;
  readonly note?: string;
}

/** Compose une enveloppe. Les champs facultatifs ne sont posés que s'ils existent. */
export function seal(request: DepositRequest): Envelope {
  return {
    envelopeVersion: ENVELOPE_VERSION,
    id: request.id,
    depositedAt: request.at,
    origin: {
      app: request.app,
      ...(request.version !== undefined && { version: request.version }),
    },
    creature: request.creature,
    ...(request.note !== undefined && { note: request.note }),
  };
}

/**
 * Relit une enveloppe déposée par quelqu'un d'autre.
 *
 * Renvoie `null` plutôt que de lever : la boîte est un dossier partagé, où n'importe quel
 * fichier peut atterrir. Un intrus ne doit pas empêcher de retirer les enveloppes valides
 * qui l'entourent.
 */
export function open(raw: unknown): Envelope | null {
  const result = EnvelopeSchema.safeParse(raw);
  return result.success ? result.data : null;
}
