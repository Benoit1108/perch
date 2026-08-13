/**
 * Accès au temps.
 *
 * Ce port n'est pas de la coquetterie : l'XP se calcule sur du temps écoulé, et un
 * moteur qui appelle `Date.now()` directement n'est pas testable. Une journée simulée
 * de quatre heures actives doit pouvoir s'exécuter en quelques millisecondes.
 */
export interface ClockPort {
  /** Millisecondes depuis l'epoch Unix. */
  now(): number;
}
