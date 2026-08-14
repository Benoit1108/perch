import { describe, expect, it } from 'vitest';

import type { DepositRequest } from './envelope.js';
import { ENVELOPE_VERSION, open, seal } from './envelope.js';

const demande: DepositRequest = {
  id: 'a1b2c3',
  at: '2026-08-14T14:00:00Z',
  app: 'perch',
  creature: { species: 'rowlet', name: 'Brindibou', level: 12, shiny: false },
};

describe('seal', () => {
  it('compose une enveloppe relisible', () => {
    expect(open(seal(demande))).toEqual({
      envelopeVersion: ENVELOPE_VERSION,
      id: 'a1b2c3',
      depositedAt: '2026-08-14T14:00:00Z',
      origin: { app: 'perch' },
      creature: { species: 'rowlet', name: 'Brindibou', level: 12, shiny: false },
    });
  });

  // `exactOptionalPropertyTypes` interdit une clé présente valant `undefined`, et un
  // `"note": null` dans le fichier ferait échouer la relecture chez l'autre application.
  it('omet les champs facultatifs absents plutôt que de les poser à vide', () => {
    const enveloppe = seal(demande);

    expect('note' in enveloppe).toBe(false);
    expect('version' in enveloppe.origin).toBe(false);
  });

  it('porte le mot laissé à qui retirera', () => {
    expect(seal({ ...demande, note: 'Prends soin de lui.' }).note).toBe('Prends soin de lui.');
  });
});

describe('open', () => {
  it('refuse une enveloppe d’une autre version', () => {
    expect(open({ ...seal(demande), envelopeVersion: 99 })).toBeNull();
  });

  // La boîte est un dossier partagé : n'importe quel fichier peut y atterrir, y compris
  // celui d'un programme qu'on ne connaît pas.
  it.each([null, 42, 'texte', {}, { envelopeVersion: 1 }])('refuse %o', (intrus) => {
    expect(open(intrus)).toBeNull();
  });

  it('refuse un identifiant qui ne peut pas être un nom de fichier', () => {
    expect(open({ ...seal(demande), id: '../ailleurs' })).toBeNull();
    expect(
      open({ ...seal(demande), creature: { ...demande.creature, species: '../x' } })
    ).toBeNull();
  });

  it('refuse un niveau hors de l’échelle', () => {
    expect(open({ ...seal(demande), creature: { ...demande.creature, level: 0 } })).toBeNull();
    expect(open({ ...seal(demande), creature: { ...demande.creature, level: 101 } })).toBeNull();
  });

  // L'expérience est jointe pour information : les courbes des deux applications n'ont
  // rien à voir, et c'est le NIVEAU qui fait foi.
  it('accepte une expérience absente comme présente', () => {
    expect(open(seal(demande))?.creature.xp).toBeUndefined();

    const avec = seal({ ...demande, creature: { ...demande.creature, xp: 16_079_810 } });
    expect(open(avec)?.creature.xp).toBe(16_079_810);
  });

  // L'autre application n'a pas forcément la notion de chromatique : son silence doit
  // valoir « non », pas rendre l'enveloppe illisible.
  it('donne une valeur au chromatique quand l’expéditeur n’en dit rien', () => {
    const brut = {
      ...seal(demande),
      creature: { species: 'gastly', name: 'Fantominus', level: 20 },
    };

    expect(open(brut)?.creature.shiny).toBe(false);
  });
});
