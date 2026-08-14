import { describe, expect, it } from 'vitest';

import type { ClockPort } from '@perch/core';
import { defaultSpeechConfig } from '@perch/core';

import { Voice } from './voice.js';

const T0 = 1_000_000;

function horloge(): ClockPort & { avance(ms: number): void } {
  let now = T0;
  return {
    now: () => now,
    avance: (ms) => {
      now += ms;
    },
  };
}

const libre = { focused: false, fullscreen: false };

describe('Voice', () => {
  it('ne dit rien sans demande', () => {
    expect(new Voice(() => 'fr', horloge()).pull(libre)).toBeNull();
  });

  it('traduit dans la langue choisie', () => {
    const fr = new Voice(() => 'fr', horloge());
    fr.say({ key: 'speech.questDone', register: 'evenement' });
    expect(fr.pull(libre)).toBe('Quête accomplie !');

    const en = new Voice(() => 'en', horloge());
    en.say({ key: 'speech.questDone', register: 'evenement' });
    expect(en.pull(libre)).toBe('Quest complete!');
  });

  it('substitue les paramètres', () => {
    const voice = new Voice(() => 'fr', horloge());
    voice.say({ key: 'speech.levelUp', register: 'evenement', params: { level: 9 } });
    expect(voice.pull(libre)).toBe('Niveau 9 !');
  });

  it('se tait pendant la concentration', () => {
    const voice = new Voice(() => 'fr', horloge());
    voice.say({ key: 'speech.chatter', register: 'bavardage' });
    expect(voice.pull({ focused: true, fullscreen: false })).toBeNull();
  });

  it('se tait en plein écran', () => {
    const voice = new Voice(() => 'fr', horloge());
    voice.say({ key: 'speech.chatter', register: 'bavardage' });
    expect(voice.pull({ focused: false, fullscreen: true })).toBeNull();
  });

  it('n’enchaîne pas deux bulles dans le même quart d’heure', () => {
    const clock = horloge();
    const voice = new Voice(() => 'fr', clock);

    voice.say({ key: 'speech.questDone', register: 'evenement' });
    voice.say({ key: 'speech.chatter', register: 'bavardage' });

    expect(voice.pull(libre)).not.toBeNull();
    clock.avance(60_000);
    expect(voice.pull(libre)).toBeNull();

    // Le bavardage en attente est entre-temps devenu obsolète : une remarque d'il y a un
    // quart d'heure n'a plus lieu d'être. Il faut une demande fraîche pour reparler.
    clock.avance(defaultSpeechConfig.minIntervalMs);
    expect(voice.pull(libre)).toBeNull();

    voice.say({ key: 'speech.chatter', register: 'bavardage' });
    expect(voice.pull(libre)).toBe('Belle journée pour travailler.');
  });

  it('fait passer un événement devant un bavardage', () => {
    const voice = new Voice(() => 'fr', horloge());
    voice.say({ key: 'speech.chatter', register: 'bavardage' });
    voice.say({ key: 'speech.questDone', register: 'evenement' });

    expect(voice.pull(libre)).toBe('Quête accomplie !');
  });

  it('abandonne une demande devenue obsolète', () => {
    const clock = horloge();
    const voice = new Voice(() => 'fr', clock);

    voice.say({ key: 'speech.questDone', register: 'interaction' });
    clock.avance(defaultSpeechConfig.staleAfterMs + 1);

    expect(voice.pull(libre)).toBeNull();
  });
});
