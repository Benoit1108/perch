import type { ClockPort, PerchState, SensorPort, StoragePort } from '@perch/core';
import { createInitialState, readState } from '@perch/core';

export interface Composition {
  readonly clock: ClockPort;
  readonly storage: StoragePort;
  readonly sensors: SensorPort;
}

export interface BootstrapResult {
  readonly state: PerchState;
  /** Vrai quand l'état précédent était absent ou illisible et qu'on est reparti de zéro. */
  readonly recovered: boolean;
}

/**
 * Racine de composition : le seul endroit qui connaît à la fois les ports et leurs
 * implémentations. Tout le reste ne voit que les interfaces.
 *
 * Prend la composition en paramètre plutôt que d'importer les adaptateurs : c'est ce qui
 * la rend testable sans Electron, sans disque et sans horloge réelle.
 */
export async function bootstrap(
  composition: Composition,
  defaults: { readonly packId: string; readonly lineId: string }
): Promise<BootstrapResult> {
  const raw = await composition.storage.read();
  const existing = readState(raw);

  if (existing !== null) {
    return { state: existing, recovered: false };
  }

  const fresh = createInitialState(composition.clock, defaults.packId, defaults.lineId);
  await composition.storage.write(fresh);
  return { state: fresh, recovered: raw !== null };
}
