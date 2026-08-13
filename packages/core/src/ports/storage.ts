/**
 * Persistance de l'état.
 *
 * `read()` renvoie délibérément `unknown` : ce qui vient du disque n'a AUCUNE garantie
 * de forme, et le typer optimistement reviendrait à mentir. L'appelant est donc obligé
 * de passer par un schéma zod avant d'en faire quoi que ce soit.
 */
export interface StoragePort {
  /** Contenu brut persisté, ou `null` si rien n'a encore été écrit. */
  read(): Promise<unknown>;

  /** Écrit l'état. L'implémentation doit être atomique (écriture puis renommage). */
  write(value: unknown): Promise<void>;
}
