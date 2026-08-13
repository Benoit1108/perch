/**
 * Résultat d'une lecture de l'état persisté.
 *
 * Les trois cas sont distingués À DESSEIN. Les confondre en un seul `null` conduit à
 * écraser silencieusement un fichier illisible : l'utilisateur perd sa créature et rien
 * ne le lui dit. « Absent » est un démarrage normal ; « illisible » est un incident qui
 * doit être signalé et dont le contenu doit être mis de côté avant toute écriture.
 */
export type StorageRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'unreadable'; readonly reason: string }
  | { readonly kind: 'value'; readonly value: unknown };

/**
 * Persistance de l'état.
 *
 * `value` est typé `unknown` : ce qui vient du disque n'a aucune garantie de forme, et le
 * typer optimistement reviendrait à mentir. L'appelant est donc obligé de passer par un
 * schéma zod avant d'en faire quoi que ce soit.
 */
export interface StoragePort {
  read(): Promise<StorageRead>;

  /** Écrit l'état. L'implémentation doit être atomique et durable. */
  write(value: unknown): Promise<void>;

  /**
   * Met de côté le contenu actuel avant qu'il soit écrasé.
   *
   * Renvoie l'emplacement de la copie, ou `null` s'il n'y avait rien à sauver. Aucune
   * donnée d'utilisateur ne doit disparaître parce qu'on n'a pas su la relire.
   */
  archive(): Promise<string | null>;
}
