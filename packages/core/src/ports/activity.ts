/**
 * Détection d'activité de l'utilisateur.
 *
 * INVARIANT I1 — aucune capture d'entrée. Ce port n'expose QUE la durée d'inactivité
 * fournie par le système : `org.gnome.Mutter.IdleMonitor` sur Linux, `GetLastInputInfo`
 * sur Windows. Ni contenu, ni touches, ni comptage de frappes.
 *
 * Si une implémentation a besoin de lire des entrées pour répondre, c'est qu'elle est
 * fausse : le système sait déjà répondre sans les exposer.
 */
export interface ActivityPort {
  /**
   * Millisecondes écoulées depuis la dernière interaction de l'utilisateur.
   *
   * `null` quand la plateforme ne sait PAS répondre — ce qui n'est pas la même chose
   * qu'une longue inactivité. Confondre les deux endort le compagnon pour toujours sur
   * toute machine dépourvue de moniteur d'inactivité, contre l'invariant I7.
   */
  idleMs(): Promise<number | null>;

  /**
   * Identifiant de l'application au premier plan, pour le bonus de concentration.
   * `null` quand la plateforme ne le fournit pas. Ne quitte jamais la machine.
   */
  focusedApp(): Promise<string | null>;
}
