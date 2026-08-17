import { spawn } from 'node:child_process';

/** Le drapeau qui décide de la plateforme d'affichage sous Linux. */
const DRAPEAU = '--ozone-platform=x11';

/**
 * S'assure que l'application tourne bien en client X11 sous Wayland, quitte à se relancer.
 *
 * Sous Wayland, un client NATIF ne peut ni se placer, ni se maintenir au-dessus des autres,
 * ni s'afficher sur tous les bureaux : `setBounds`, `setAlwaysOnTop` et
 * `setVisibleOnAllWorkspaces` sont ignorés EN SILENCE. Le compagnon reste alors collé à un
 * seul espace de travail, derrière les fenêtres, et ne réapparaît que si on lui donne le
 * focus. C'est le constat S0 n°1, et il vaut aussi pour l'application empaquetée.
 *
 * Le drapeau doit être posé AVANT le démarrage du processus : `app.commandLine` arrive trop
 * tard, Electron ayant déjà choisi sa plateforme. Le script de développement le passe en
 * ligne de commande, mais l'AppImage lance son binaire sans argument — `executableArgs`
 * d'electron-builder n'atteint pas son lanceur, vérifié dans `/proc/<pid>/cmdline`.
 *
 * Il ne reste donc qu'à se relancer soi-même avec le bon drapeau. La condition est étroite :
 * Linux, session Wayland, et drapeau absent — ce qui rend une seconde relance impossible.
 */
export function ensureX11(env: NodeJS.ProcessEnv, argv: readonly string[]): boolean {
  const besoin =
    process.platform === 'linux' &&
    env['XDG_SESSION_TYPE'] === 'wayland' &&
    !argv.some((arg) => arg.startsWith('--ozone-platform'));

  if (!besoin) return false;

  console.log('[perch] session Wayland : relancement en client X11 (voir ozone.ts)');
  spawn(process.execPath, [DRAPEAU, ...argv.slice(1)], {
    detached: true,
    stdio: 'inherit',
  }).unref();

  return true;
}
