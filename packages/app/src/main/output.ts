/** Le minimum d'un flux de sortie, pour pouvoir en fournir un faux dans un test. */
export interface Fragile {
  on(event: 'error', listener: (error: unknown) => void): unknown;
}

/**
 * Empêche une sortie rompue de faire tomber l'application.
 *
 * Lancée depuis un lanceur de bureau, l'application n'a personne au bout de sa sortie
 * standard : le terminal qui l'a démarrée se referme, le tube meurt, et le premier
 * `console.log` lève `EPIPE`. Rien ne l'attrape, Electron affiche alors sa boîte
 * « A JavaScript error occurred in the main process », et le compagnon meurt d'avoir voulu
 * parler à personne.
 *
 * Ce n'est pas une erreur à traiter, c'est l'absence de lecteur. On l'ignore — et les
 * autres erreurs d'écriture avec, faute de pouvoir s'en plaindre autrement qu'en écrivant
 * sur le flux qui vient justement d'échouer.
 */
export function survivePipeClosure(streams: readonly Fragile[]): void {
  for (const stream of streams) {
    stream.on('error', () => undefined);
  }
}
