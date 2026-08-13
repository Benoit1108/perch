import { app, globalShortcut } from 'electron';

/**
 * Sorties de secours d'un overlay plein écran.
 *
 * Une fenêtre sans bordure, absente de la barre des tâches et couvrant tout le bureau ne
 * peut pas être fermée à la souris. Si elle capte les clics par-dessus le marché, la
 * machine devient inutilisable — c'est arrivé pendant S0, il a fallu tuer le processus
 * depuis une autre session.
 *
 * Les trois voies sont indépendantes, et une seule protège vraiment : l'arrêt automatique
 * est le seul recours quand la souris ne répond plus.
 */
export function installEscapeHatches(): void {
  const shortcut = 'Control+Alt+P';

  if (
    globalShortcut.register(shortcut, () => {
      app.quit();
    })
  ) {
    console.log(`[perch] sortie de secours : ${shortcut}`);
  } else {
    console.warn(`[perch] ATTENTION : ${shortcut} n a pas pu etre enregistre`);
  }

  const seconds = Number(process.env['PERCH_TIMEOUT'] ?? '0');
  if (Number.isFinite(seconds) && seconds > 0) {
    console.log(`[perch] arret automatique dans ${String(seconds)}s`);
    setTimeout(() => {
      console.log('[perch] arret automatique');
      app.quit();
    }, seconds * 1000);
  }

  console.log(
    `[perch] pid=${String(process.pid)} — en cas de blocage : kill ${String(process.pid)}`
  );
}
