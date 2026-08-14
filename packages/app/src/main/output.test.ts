import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { survivePipeClosure } from './output.js';

/** Un flux qui n'a plus personne au bout, comme la sortie d'une application lancée
 * depuis un menu dont le terminal parent s'est refermé. */
function fluxRompu(): PassThrough {
  const flux = new PassThrough();
  flux.destroy();
  return flux;
}

describe('survivePipeClosure', () => {
  // Sans écouteur, une erreur sur un flux devient une exception non attrapée : Electron
  // affiche alors sa boîte « A JavaScript error occurred in the main process » et le
  // compagnon meurt d'avoir voulu parler à personne.
  it('encaisse une erreur d’écriture sans la propager', () => {
    const flux = new PassThrough();
    survivePipeClosure([flux]);

    expect(() => {
      flux.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
    }).not.toThrow();
  });

  it('protège chaque flux qu’on lui confie', () => {
    const sortie = new PassThrough();
    const erreurs = new PassThrough();
    survivePipeClosure([sortie, erreurs]);

    expect(sortie.listenerCount('error')).toBe(1);
    expect(erreurs.listenerCount('error')).toBe(1);
  });

  it('n’empêche pas d’écrire sur un flux en bon état', () => {
    const flux = new PassThrough();
    survivePipeClosure([flux]);

    expect(flux.write('bonjour')).toBe(true);
  });

  it('laisse un flux déjà détruit échouer en silence', () => {
    const flux = fluxRompu();
    survivePipeClosure([flux]);

    expect(() => flux.write('personne ne lit')).not.toThrow();
  });
});
