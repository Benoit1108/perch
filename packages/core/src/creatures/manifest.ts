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

/**
 * Chemin d'un fichier du pack, relatif à son dossier.
 *
 * Un manifeste est une donnée EXTERNE, pas du code de confiance : sans cette contrainte,
 * `../../../.ssh/id_rsa` serait un chemin valide, et le lecteur d'assets le servirait
 * docilement au rendu. La vérification est refaite à l'ouverture du fichier — se défendre
 * au bord ne dispense pas de se défendre au moment d'agir.
 */
const assetPath = z
  .string()
  .min(1)
  .regex(/^[\w-]+(\/[\w-]+)*\.(png|gif|webp)$/u, 'chemin relatif simple vers une image');

const ClipSchema = z.object({
  /** Images de l'animation, dans l'ordre. Une seule image = un sprite fixe. */
  frames: z.array(assetPath).min(1),
  fps: z.number().positive().max(60),
});

/**
 * Animations d'un stade.
 *
 * Toutes facultatives : le pack par défaut n'en fournit qu'une, les sprites d'origine
 * n'ayant qu'une boucle d'attente. La table `PLAYBACK` décrit un ordre de repli, ce qui
 * permet à un pack plus riche d'en fournir davantage sans que le moteur change.
 */
const ClipsSchema = z.object({
  repos: ClipSchema.optional(),
  marche: ClipSchema.optional(),
  chute: ClipSchema.optional(),
  sommeil: ClipSchema.optional(),
});

const CreatureStageSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  /**
   * Identifiant d'espèce dans le vocabulaire partagé avec les autres applications
   * compagnon — celui des sprites Showdown. Facultatif : un pack entièrement original n'a
   * personne avec qui échanger, et n'a donc rien à déclarer ici.
   */
  species: identifier.optional(),
  /** Image fixe, pour le choix du compagnon. Jamais committée (invariant I5). */
  sprite: assetPath,
  /** Niveau à partir duquel ce stade est atteint. Le premier stade vaut toujours 1. */
  fromLevel: z.number().int().min(1).max(100),
  clips: ClipsSchema.default({}),
});

const CreatureLineSchema = z.object({
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

export type Clip = z.infer<typeof ClipSchema>;
export type CreatureStage = z.infer<typeof CreatureStageSchema>;
export type CreatureLine = z.infer<typeof CreatureLineSchema>;
export type CreaturePack = z.infer<typeof CreaturePackSchema>;

/** Noms d'animation connus du moteur. Dérivés du schéma : impossible qu'ils divergent. */
export type ClipName = keyof z.infer<typeof ClipsSchema>;
