import type { ClockPort, PerchState, SensorPort, StoragePort } from '@perch/core';
import { createInitialState, readState } from '@perch/core';

export interface Composition {
  readonly clock: ClockPort;
  readonly storage: StoragePort;
  readonly sensors: SensorPort;
}

/** Ce qui est arrivé à l'état précédent. */
export type Recovery =
  | { readonly kind: 'fresh' }
  | { readonly kind: 'restored' }
  | { readonly kind: 'recovered'; readonly reason: string; readonly archivedAt: string | null };

export interface BootstrapResult {
  readonly state: PerchState;
  readonly recovery: Recovery;
}

export interface Defaults {
  readonly packId: string;
  readonly lineId: string;
}

/**
 * Racine de composition : le seul endroit qui connaît à la fois les ports et leurs
 * implémentations. Tout le reste ne voit que les interfaces.
 *
 * Un état illisible n'est JAMAIS écrasé en silence. Il est mis de côté, et l'appelant
 * reçoit de quoi le dire à l'utilisateur — perdre une créature sans explication est le
 * pire défaut possible pour ce genre d'application.
 */
export async function bootstrap(
  composition: Composition,
  defaults: Defaults
): Promise<BootstrapResult> {
  const read = await composition.storage.read();

  if (read.kind === 'value') {
    const existing = readState(read.value);
    if (existing !== null) {
      return { state: existing, recovery: { kind: 'restored' } };
    }
  }

  const startFresh = async (): Promise<PerchState> => {
    const fresh = createInitialState(composition.clock, defaults.packId, defaults.lineId);
    await composition.storage.write(fresh);
    return fresh;
  };

  if (read.kind === 'absent') {
    return { state: await startFresh(), recovery: { kind: 'fresh' } };
  }

  const reason = read.kind === 'unreadable' ? read.reason : 'contenu hors schéma';
  const archivedAt = await composition.storage.archive();

  return { state: await startFresh(), recovery: { kind: 'recovered', reason, archivedAt } };
}
