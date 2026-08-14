import { describe, expect, it } from 'vitest';

import type { CommitLog } from './evidence.js';
import { deriveProfiles, mergeCommits, noEvidence } from './evidence.js';

/** Journal vierge. Vit ICI : la production lit toujours un journal déjà persisté. */
const emptyCommitLog = (dayKey: string): CommitLog => ({ dayKey, hashes: [] });

describe('deriveProfiles', () => {
  it('n’active aucun profil spécialisé sans preuve', () => {
    expect(deriveProfiles(noEvidence)).toEqual([]);
  });

  it('active « dev » dès qu’un dépôt est surveillé', () => {
    expect(deriveProfiles({ watchedRepos: 1, tasks: 0 })).toEqual(['dev']);
  });

  it('active « taches » dès la première tâche', () => {
    expect(deriveProfiles({ watchedRepos: 0, tasks: 1 })).toEqual(['taches']);
  });

  it('cumule les profils', () => {
    expect(deriveProfiles({ watchedRepos: 2, tasks: 5 })).toEqual(['dev', 'taches']);
  });
});

describe('mergeCommits', () => {
  it('part de zéro sans historique', () => {
    expect(mergeCommits(undefined, 'j1', ['a', 'b'])).toEqual({ dayKey: 'j1', hashes: ['a', 'b'] });
  });

  it('ignore les doublons d’un même relevé', () => {
    expect(mergeCommits(undefined, 'j1', ['a', 'a', 'b']).hashes).toEqual(['a', 'b']);
  });

  it('ne recompte pas un commit déjà vu', () => {
    const premier = mergeCommits(undefined, 'j1', ['a', 'b']);
    expect(mergeCommits(premier, 'j1', ['a', 'b']).hashes).toEqual(['a', 'b']);
  });

  it('ajoute les nouveaux commits aux anciens', () => {
    const premier = mergeCommits(undefined, 'j1', ['a']);
    expect(mergeCommits(premier, 'j1', ['b']).hashes).toEqual(['a', 'b']);
  });

  /**
   * Le vrai piège : `rebase` et `--amend` réécrivent les hachages. Le travail du matin
   * réapparaît sous une nouvelle identité et serait recompté sans cette mémoire.
   */
  it('n’efface pas les hachages d’origine après une réécriture d’historique', () => {
    const matin = mergeCommits(undefined, 'j1', ['origine1', 'origine2']);
    const apresRebase = mergeCommits(matin, 'j1', ['reecrit1', 'reecrit2']);

    // Le total gonfle — c'est inévitable sans suivre les patch-id — mais les anciens
    // hachages restent connus, donc un simple re-relevé ne recompte rien.
    expect(mergeCommits(apresRebase, 'j1', ['reecrit1', 'reecrit2']).hashes).toHaveLength(4);
  });

  it('repart à zéro au changement de jour', () => {
    const hier = mergeCommits(undefined, 'j1', ['a', 'b', 'c']);
    expect(mergeCommits(hier, 'j2', ['d'])).toEqual({ dayKey: 'j2', hashes: ['d'] });
  });

  it('accepte un relevé vide sans rien perdre', () => {
    const avant = emptyCommitLog('j1');
    expect(mergeCommits(avant, 'j1', []).hashes).toEqual([]);
  });
});
