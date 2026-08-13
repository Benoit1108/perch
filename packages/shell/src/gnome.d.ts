/// <reference types="@girs/gio-2.0/ambient" />
/// <reference types="@girs/meta-18/ambient" />
/// <reference types="@girs/gnome-shell/extensions/global" />

/**
 * GNOME Shell 45+ charge les extensions en ESM natif et résout lui-même les URI
 * `resource:///`. On garde donc le spécifiateur réel dans le code plutôt que d'ajouter
 * un bundler pour le réécrire — moins de machinerie, et le fichier émis est directement
 * chargeable par le compositeur.
 *
 * Ce mappage relie le spécifiateur d'exécution aux types fournis par `@girs`.
 */
declare module 'resource:///org/gnome/shell/extensions/extension.js' {
  export const Extension: typeof import('@girs/gnome-shell/extensions/extension').Extension;
}
