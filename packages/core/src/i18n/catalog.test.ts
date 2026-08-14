import { describe, expect, it } from 'vitest';

import { LOCALES, MESSAGE_KEYS, resolveLocale, translate } from './catalog.js';

describe('parité des catalogues', () => {
  /**
   * Le test qui compte : une clé traduite d'un seul côté produit une interface bilingue
   * à moitié. Le typage l'attrape déjà à la compilation, ce test le vérifie à l'exécution
   * et documente l'intention pour qui ajouterait une langue.
   */
  it('traduit chaque clé dans chaque langue', () => {
    for (const locale of LOCALES) {
      for (const key of MESSAGE_KEYS) {
        const text = translate(locale, key);
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toBe(key);
      }
    }
  });

  /**
   * Paramètres déclarés par une chaîne, sous la forme `{nom}`.
   *
   * Les deux tests suivants remplacent une version qui excluait `speech.levelUp` par son
   * nom : la première clé à paramètre ajoutée ensuite l'a fait échouer. Une liste
   * d'exceptions tenue à la main finit toujours par être la vraie règle.
   */
  const parametres = (texte: string): string[] =>
    [...texte.matchAll(/\{(\w+)\}/gu)].map((trouve) => trouve[1] ?? '').sort();

  // Le défaut réel : `{level}` présent en français, oublié en anglais. L'anglophone lit
  // une phrase sans son chiffre, et rien ne le signale.
  it('déclare les mêmes paramètres dans toutes les langues', () => {
    for (const key of MESSAGE_KEYS) {
      const reference = parametres(translate('fr', key));
      for (const locale of LOCALES) {
        expect(parametres(translate(locale, key))).toEqual(reference);
      }
    }
  });

  it('substitue tous les paramètres déclarés', () => {
    for (const locale of LOCALES) {
      for (const key of MESSAGE_KEYS) {
        const fournis = Object.fromEntries(
          parametres(translate(locale, key)).map((nom) => [nom, 'x'])
        );
        expect(translate(locale, key, fournis)).not.toMatch(/\{\w+\}/u);
      }
    }
  });
});

describe('translate', () => {
  it('substitue les paramètres', () => {
    expect(translate('fr', 'speech.levelUp', { level: 7 })).toBe('Niveau 7 !');
    expect(translate('en', 'speech.levelUp', { level: 7 })).toBe('Level 7!');
  });

  it('substitue toutes les occurrences d’un paramètre', () => {
    expect(translate('fr', 'speech.levelUp', { level: 3 })).toContain('3');
  });

  it('laisse le gabarit intact sans paramètre', () => {
    expect(translate('fr', 'speech.levelUp')).toBe('Niveau {level} !');
  });
});

describe('resolveLocale', () => {
  it('reconnaît une langue disponible', () => {
    expect(resolveLocale('fr')).toBe('fr');
    expect(resolveLocale('fr-FR')).toBe('fr');
    expect(resolveLocale('FR')).toBe('fr');
  });

  it('se rabat sur l’anglais pour une langue inconnue', () => {
    expect(resolveLocale('de-DE')).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});
