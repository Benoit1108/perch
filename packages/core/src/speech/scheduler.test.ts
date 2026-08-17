import { describe, expect, it } from 'vitest';

import type { SpeechContext, SpeechRequest } from './scheduler.js';
import { canSpeak, defaultSpeechConfig, emptySpeech, pull, say } from './scheduler.js';

const config = defaultSpeechConfig;
const T0 = 1_000_000;

const contexte = (overrides: Partial<SpeechContext> = {}): SpeechContext => ({
  nowMs: T0,
  focused: false,
  fullscreen: false,
  ...overrides,
});

const evenement: SpeechRequest = { key: 'speech.levelUp', register: 'evenement' };
const bavardage: SpeechRequest = { key: 'speech.chatter', register: 'bavardage' };
const humeur: SpeechRequest = { key: 'speech.sleepy', register: 'humeur' };
const interaction: SpeechRequest = { key: 'speech.questDone', register: 'interaction' };

describe('canSpeak — les règles de silence', () => {
  it('autorise la première bulle', () => {
    expect(canSpeak(emptySpeech, contexte(), config, 'bavardage')).toBe(true);
  });

  it('se tait pendant la concentration', () => {
    expect(canSpeak(emptySpeech, contexte({ focused: true }), config, 'evenement')).toBe(false);
  });

  it('se tait en plein écran', () => {
    expect(canSpeak(emptySpeech, contexte({ fullscreen: true }), config, 'evenement')).toBe(false);
  });

  it('respecte l’intervalle du registre', () => {
    const vientDeParler = { ...emptySpeech, lastSpokeAt: T0 };
    const apres = (ms: number) => contexte({ nowMs: T0 + ms });

    expect(canSpeak(vientDeParler, apres(1000), config, 'bavardage')).toBe(false);
    expect(
      canSpeak(vientDeParler, apres(config.minIntervalMs.bavardage), config, 'bavardage')
    ).toBe(true);
  });

  /**
   * Le défaut qui rendait le compagnon muet : un seuil unique, réglé pour que le bavardage
   * reste discret, retenait aussi les réactions. Une phrase au démarrage, puis plus rien —
   * tout le reste périmait en file avant d'avoir le droit d'être dit.
   */
  it('laisse un événement passer bien avant un bavardage', () => {
    const vientDeParler = { ...emptySpeech, lastSpokeAt: T0 };
    const juste = contexte({ nowMs: T0 + config.minIntervalMs.evenement });

    expect(canSpeak(vientDeParler, juste, config, 'evenement')).toBe(true);
    expect(canSpeak(vientDeParler, juste, config, 'bavardage')).toBe(false);
  });
});

describe('say — la file de priorité', () => {
  it('place un événement devant un bavardage déjà en file', () => {
    let state = say(emptySpeech, bavardage, T0, config);
    state = say(state, evenement, T0, config);

    expect(state.queue[0]?.register).toBe('evenement');
  });

  it('respecte l’ordre des quatre registres', () => {
    let state = emptySpeech;
    for (const demande of [bavardage, humeur, interaction, evenement]) {
      state = say(state, demande, T0, { ...config, maxQueue: 10 });
    }

    expect(state.queue.map((p) => p.register)).toEqual([
      'evenement',
      'interaction',
      'humeur',
      'bavardage',
    ]);
  });

  /**
   * Le point important : la file ÉCARTE, elle n'empile pas. Un compagnon qui rattrape
   * son retard de bavardage après une réunion est insupportable.
   */
  it('écarte la demande la moins prioritaire quand la file déborde', () => {
    let state = emptySpeech;
    for (let i = 0; i < 10; i++) state = say(state, bavardage, T0, config);
    state = say(state, evenement, T0, config);

    expect(state.queue).toHaveLength(config.maxQueue);
    expect(state.queue[0]?.register).toBe('evenement');
  });

  it('abandonne les demandes périmées', () => {
    const vieux = say(emptySpeech, bavardage, T0, config);
    const plusTard = say(vieux, evenement, T0 + config.staleAfterMs + 1, config);

    expect(plusTard.queue).toHaveLength(1);
    expect(plusTard.queue[0]?.register).toBe('evenement');
  });
});

describe('pull', () => {
  it('ne dit rien sur une file vide', () => {
    expect(pull(emptySpeech, contexte(), config).speak).toBeNull();
  });

  it('rend la demande la plus prioritaire et note l’heure', () => {
    let state = say(emptySpeech, bavardage, T0, config);
    state = say(state, evenement, T0, config);

    const result = pull(state, contexte(), config);

    expect(result.speak?.key).toBe('speech.levelUp');
    expect(result.state.lastSpokeAt).toBe(T0);
    expect(result.state.queue).toHaveLength(1);
  });

  it('ne dit rien pendant la concentration, sans perdre la file', () => {
    const state = say(emptySpeech, evenement, T0, config);
    const result = pull(state, contexte({ focused: true }), config);

    expect(result.speak).toBeNull();
    expect(result.state.queue).toHaveLength(1);
  });

  it('purge les demandes périmées même en se taisant', () => {
    const state = say(emptySpeech, bavardage, T0, config);
    const result = pull(
      state,
      contexte({ focused: true, nowMs: T0 + config.staleAfterMs + 1 }),
      config
    );

    expect(result.state.queue).toHaveLength(0);
  });

  it('conserve les paramètres du message', () => {
    const state = say(
      emptySpeech,
      { key: 'speech.levelUp', register: 'evenement', params: { level: 12 } },
      T0,
      config
    );

    expect(pull(state, contexte(), config).speak?.params).toEqual({ level: 12 });
  });

  // La garantie qui compte n'est pas « une seule bulle », c'est l'ESPACEMENT : deux
  // bulles ne se suivent jamais de plus près que l'intervalle de leur registre.
  it('espace les bulles d’au moins l’intervalle du registre', () => {
    let state = emptySpeech;
    for (let i = 0; i < 5; i++) state = say(state, bavardage, T0, config);

    const instants: number[] = [];
    for (let seconde = 0; seconde < 600; seconde += 5) {
      const result = pull(state, contexte({ nowMs: T0 + seconde * 1000 }), config);
      state = result.state;
      if (result.speak !== null) instants.push(seconde * 1000);
    }

    expect(instants.length).toBeGreaterThan(0);
    for (let i = 1; i < instants.length; i += 1) {
      const ecart = (instants[i] ?? 0) - (instants[i - 1] ?? 0);
      expect(ecart).toBeGreaterThanOrEqual(config.minIntervalMs.bavardage);
    }
  });
});
