import { app, globalShortcut } from 'electron';
import { homedir } from 'node:os';

import { pidFilePath, removePidFile, writePidFile } from './pidfile.js';

/**
 * Sorties de secours d'un overlay plein écran.
 *
 * Une fenêtre sans bordure, absente de la barre des tâches et couvrant tout le bureau ne
 * peut pas être fermée à la souris. Si la région d'entrée se remet à capter les clics, la
 * machine devient inutilisable — c'est arrivé deux fois pendant le développement.
 *
 * ⚠️ CONSTAT S2 : `globalShortcut.register()` RENVOIE `true` SUR WAYLAND ET NE FONCTIONNE
 * PAS. Le compositeur route le clavier lui-même, une application XWayland ne peut pas
 * capter de raccourci global. Même famille de mensonge qu'`isVisible()` : l'API confirme
 * un succès qui n'existe pas. Le raccourci est donc conservé pour Windows et X11, mais il
 * ne compte plus comme une garantie.
 *
 * La sortie fiable est le fichier PID, lisible par `npm run stop` sans dépendre ni du
 * clavier, ni de la souris, ni du compositeur.
 */
export function installEscapeHatches(): void {
  const pidPath = pidFilePath(process.env, homedir());

  void writePidFile(pidPath, process.pid);
  app.on('will-quit', () => {
    void removePidFile(pidPath);
  });

  console.log(`[perch] pour arreter : npm run stop   (ou kill ${String(process.pid)})`);

  const shortcut = 'Control+Alt+P';
  const registered = globalShortcut.register(shortcut, () => {
    app.quit();
  });
  console.log(
    registered
      ? `[perch] raccourci ${shortcut} enregistre — SANS EFFET sous Wayland, voir escape-hatches.ts`
      : `[perch] raccourci ${shortcut} refuse`
  );

  // En développement, on ne laisse jamais tourner indéfiniment : si les clics
  // traversants cassent, l'arrêt automatique est le seul recours qui ne dépende de rien.
  const fallback = process.env['PERCH_DEBUG'] === '1' ? '600' : '0';
  const seconds = Number(process.env['PERCH_TIMEOUT'] ?? fallback);

  if (Number.isFinite(seconds) && seconds > 0) {
    console.log(
      `[perch] arret automatique dans ${String(seconds)}s (PERCH_TIMEOUT=0 pour desactiver)`
    );
    setTimeout(() => {
      console.log('[perch] arret automatique');
      app.quit();
    }, seconds * 1000);
  }
}
