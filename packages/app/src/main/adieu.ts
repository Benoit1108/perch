import type { PerchState, StoragePort } from '@perch/core';

/**
 * Au-delà, on part sans avoir sauvegardé.
 *
 * Une écriture d'état fait quelques centaines d'octets et deux `fsync` : elle prend
 * quelques millisecondes. Si elle n'a pas abouti au bout de deux secondes, c'est que le
 * disque ne répond pas — et faire attendre quelqu'un qui a demandé la fermeture est pire
 * que de perdre une minute d'expérience.
 */
const PATIENCE_MS = 2_000;

export interface AdieuDeps {
  readonly storage: StoragePort;
  readonly state: () => PerchState;
  /** Arrête la boucle et les minuteries. Appelé une seule fois. */
  readonly arreter: () => void;
  /** Reprend la fermeture, une fois l'état écrit. */
  readonly quitter: () => void;
  readonly differer: (action: () => void, delai: number) => void;
}

/**
 * La dernière écriture, ACHEVÉE avant que le processus ne s'en aille.
 *
 * Elle partait sans qu'on l'attende. Le processus s'arrêtait alors au milieu du renommage
 * atomique : vingt fichiers temporaires traînaient dans le dossier de configuration d'une
 * machine de test, et la progression de la dernière minute pouvait ne jamais atterrir.
 *
 * Rendue asynchrone, la fermeture doit être différée puis reprise. D'où le drapeau : la
 * reprise déclenche un second `will-quit`, qui ne doit ni réécrire ni se différer encore.
 *
 * @returns le gestionnaire à brancher sur `will-quit`
 */
export function adieu(deps: AdieuDeps): (event: { preventDefault: () => void }) => void {
  let ecrit = false;

  return (event) => {
    if (ecrit) return;
    ecrit = true;
    event.preventDefault();

    deps.arreter();

    let parti = false;
    const partir = (): void => {
      if (parti) return;
      parti = true;
      deps.quitter();
    };

    // Une écriture qui échoue ne doit pas empêcher la fermeture : on quitte quand même,
    // avec l'état précédent, plutôt que de laisser une application qu'on ne peut plus fermer.
    void deps.storage
      .write(deps.state())
      .catch(() => undefined)
      .finally(partir);
    deps.differer(partir, PATIENCE_MS);
  };
}
