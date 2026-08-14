import { describe, expect, it } from 'vitest';

import type { Mood } from './moods.js';
import { WONDERING_MS, moodFor } from './moods.js';

const fenetre = { x: 0, y: 100, width: 800, height: 600 };

const mood = (overrides: Partial<Mood> = {}): Mood => ({
  state: 'marche',
  idleMs: 0,
  dayKey: '2026-08-14',
  windows: [fenetre],
  app: 'terminal',
  tired: false,
  ...overrides,
});

describe('moodFor', () => {
  // Premier passage après le démarrage : il n'y a pas de transition à observer, et saluer
  // à chaque lancement rendrait le compagnon bavard à chaque redémarrage.
  it('ne dit rien sans situation précédente', () => {
    expect(moodFor(null, mood())).toBeNull();
  });

  it('salue au changement de journée', () => {
    const veille = mood({ dayKey: '2026-08-13' });
    expect(moodFor(veille, mood())?.key).toBe('speech.greetMorning');
  });

  // Une machine laissée allumée toute la nuit change de journée sans que personne ne soit
  // là : la salutation s'adresserait à une pièce vide. Il peut en revanche s'étonner de
  // l'absence — cette bulle-là attendra tranquillement le retour de son lecteur.
  it('ne salue pas une machine restée seule', () => {
    const veille = mood({ dayKey: '2026-08-13' });
    expect(moodFor(veille, mood({ idleMs: 3 * WONDERING_MS }))?.key).not.toBe(
      'speech.greetMorning'
    );
  });

  it('bâille en s’endormant', () => {
    const eveille = mood({ state: 'repos' });
    expect(moodFor(eveille, mood({ state: 'sommeil' }))?.key).toBe('speech.sleepy');
  });

  it('ne bâille pas à chaque instant de sommeil', () => {
    const endormi = mood({ state: 'sommeil' });
    expect(moodFor(endormi, mood({ state: 'sommeil' }))).toBeNull();
  });

  it('s’inquiète au franchissement du seuil d’inactivité', () => {
    const actif = mood({ idleMs: WONDERING_MS - 1 });
    expect(moodFor(actif, mood({ idleMs: WONDERING_MS }))?.key).toBe('speech.idle');
  });

  it('ne s’inquiète qu’une fois', () => {
    const absent = mood({ idleMs: WONDERING_MS });
    expect(moodFor(absent, mood({ idleMs: WONDERING_MS * 4 }))).toBeNull();
  });

  // Multi-bureau : passer d'un espace de travail à l'autre remplace toutes les fenêtres
  // visibles d'un coup. C'est exactement ce qu'un compagnon devrait remarquer.
  it('remarque un décor entièrement remplacé', () => {
    const avant = mood({ windows: [fenetre, { ...fenetre, x: 900 }] });
    const apres = mood({
      windows: [
        { ...fenetre, x: 300 },
        { ...fenetre, x: 1200 },
      ],
    });

    expect(moodFor(avant, apres)?.key).toBe('speech.newScene');
  });

  it('ne remarque pas une simple fenêtre déplacée', () => {
    const avant = mood({ windows: [fenetre, { ...fenetre, x: 900 }, { ...fenetre, x: 1500 }] });
    const apres = mood({ windows: [fenetre, { ...fenetre, x: 950 }, { ...fenetre, x: 1500 }] });

    expect(moodFor(avant, apres)).toBeNull();
  });

  it('remarque une fenêtre réduite ou fermée', () => {
    const avant = mood({ windows: [fenetre, { ...fenetre, x: 900 }] });
    expect(moodFor(avant, mood({ windows: [fenetre] }))?.key).toBe('speech.windowGone');
  });

  it('remarque une fenêtre de plus', () => {
    const apres = mood({ windows: [fenetre, { ...fenetre, x: 900 }] });
    expect(moodFor(mood(), apres)?.key).toBe('speech.windowNew');
  });

  it('remarque un changement d’application', () => {
    expect(moodFor(mood(), mood({ app: 'navigateur' }))?.key).toBe('speech.switched');
  });

  // Sans extension pour le dire, l'application vaut `null` : inventer un changement
  // ferait parler le compagnon à chaque relevé.
  it('n’invente pas de changement quand l’application est inconnue', () => {
    expect(moodFor(mood({ app: null }), mood({ app: null }))).toBeNull();
    expect(moodFor(mood({ app: null }), mood({ app: 'terminal' }))).toBeNull();
  });

  it('souffle quand il vient de s’arrêter', () => {
    expect(moodFor(mood(), mood({ tired: true }))?.key).toBe('speech.tired');
  });

  it('savoure son perchoir en arrivant en haut', () => {
    const avant = mood({ state: 'escalade' });
    expect(moodFor(avant, mood({ state: 'marche' }))?.key).toBe('speech.perched');
  });

  // Registres : s'endormir est une humeur, s'étonner d'une absence n'est que du bavardage
  // — la file écarte le second en premier quand plusieurs choses veulent être dites.
  it('range chaque phrase dans son registre', () => {
    const eveille = mood({ state: 'repos' });
    expect(moodFor(eveille, mood({ state: 'sommeil' }))?.register).toBe('humeur');

    const actif = mood({ idleMs: 0 });
    expect(moodFor(actif, mood({ idleMs: WONDERING_MS }))?.register).toBe('bavardage');
  });
});
