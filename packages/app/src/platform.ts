/** Ce qu'on a besoin de savoir de la machine, réduit au strict nécessaire. */
export interface Environment {
  /** Valeur de `process.platform`. */
  readonly os: string;
  /** Valeur de `XDG_SESSION_TYPE` sur Linux, absente ailleurs. */
  readonly sessionType: string | undefined;
}

/**
 * Electron voit-il ce qui se passe HORS de sa propre fenêtre ?
 *
 * Deux de ses interfaces répondraient à elles seules aux besoins de S7 —
 * `screen.getCursorScreenPoint()` pour le curseur, `powerMonitor.getSystemIdleTime()`
 * pour l'inactivité — sans une ligne de code natif. Elles fonctionnent sur Windows, sur
 * macOS et sur une vraie session X11.
 *
 * Elles MENTENT sous Wayland, où l'application tourne en client XWayland (voir le script
 * de démarrage). Mesuré le 2026-08-14 sur la machine cible :
 *
 * - `getCursorScreenPoint()` renvoie une position plausible mais FIGÉE : le serveur X ne
 *   connaît le curseur que lorsqu'il survole une fenêtre du client, et notre overlay
 *   laisse justement passer tous les clics.
 * - `getSystemIdleTime()` renvoie toujours 0, là où la même mesure en Wayland natif
 *   rapportait correctement 67 secondes d'inactivité.
 *
 * Un mensonge est pire qu'un aveu d'ignorance : un compagnon qui suit une position figée
 * paraît cassé, et une inactivité toujours nulle accorde de l'expérience à une machine
 * abandonnée. D'où l'extension GNOME sur Wayland, et cette porte ici.
 */
export function electronSeesDesktop(env: Environment): boolean {
  return !(env.os === 'linux' && env.sessionType === 'wayland');
}

/** L'environnement réel du processus. */
export function currentEnvironment(): Environment {
  return { os: process.platform, sessionType: process.env['XDG_SESSION_TYPE'] };
}
