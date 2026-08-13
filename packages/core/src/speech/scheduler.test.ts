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
const interaction: SpeechRequest = { key: 'speech.grabbed', register: 'interaction' };

describe('canSpeak — les règles de silence', () => {
  it('autorise la première bulle', () => {
    expect(canSpeak(emptySpeech, contexte(), config)).toBe(true);
  });

  it('se tait pendant la concentration', () => {
    expect(canSpeak(emptySpeech, contexte({ focused: true }), config)).toBe(false);
  });

  it('se tait en plein écran', () => {
    expect(canSpeak(emptySpeech, contexte({ fullscreen: true }), config)).toBe(false);
  });

  it('respecte l’intervalle minimal', () => {
    const vientDeParler = { ...emptySpeech, lastSpokeAt: T0 };
    expect(canSpeak(vientDeParler, contexte({ nowMs: T0 + 60_000 }), config)).toBe(false);
    expect(canSpeak(vientDeParler, contexte({ nowMs: T0 + config.minIntervalMs }), config)).toBe(
      true
    );
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

  it('ne dépasse jamais une bulle par intervalle', () => {
    let state = emptySpeech;
    for (let i = 0; i < 5; i++) state = say(state, evenement, T0, config);

    let dites = 0;
    for (let minute = 0; minute < 14; minute++) {
      const result = pull(state, contexte({ nowMs: T0 + minute * 60_000 }), config);
      state = result.state;
      if (result.speak !== null) dites += 1;
    }

    expect(dites).toBe(1);
  });
});
