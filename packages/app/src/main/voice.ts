import type { ClockPort, Locale, SpeechConfig, SpeechRequest, SpeechState } from '@perch/core';
import { defaultSpeechConfig, emptySpeech, pull, say, translate } from '@perch/core';

export interface VoiceContext {
  readonly focused: boolean;
  readonly fullscreen: boolean;
}

/**
 * Ce que le compagnon a sur le cœur.
 *
 * Deux horloges y convergent : la progression parle à la minute (montées de niveau,
 * quêtes) et la boucle d'animation à la frame (humeurs, sommeil). Le
 * cadencement — une bulle par quart d'heure au plus, silence en concentration et en plein
 * écran — appartient à `core` ; cette classe n'est qu'un point de rendez-vous et la
 * traduction.
 */
export class Voice {
  private state: SpeechState = emptySpeech;

  constructor(
    /**
     * Relue à chaque phrase, jamais capturée : la langue se change dans les réglages, et
     * un compagnon qui continue de parler l'ancienne donne l'impression que le réglage
     * n'a pas pris.
     */
    private readonly locale: () => Locale,
    private readonly clock: ClockPort,
    private readonly config: SpeechConfig = defaultSpeechConfig
  ) {}

  say(request: SpeechRequest): void {
    this.state = say(this.state, request, this.clock.now(), this.config);
  }

  /** Texte à afficher maintenant, ou `null` s'il faut se taire. */
  pull(context: VoiceContext): string | null {
    const result = pull(this.state, { ...context, nowMs: this.clock.now() }, this.config);
    this.state = result.state;

    if (result.speak === null) return null;
    return translate(this.locale(), result.speak.key, result.speak.params ?? {});
  }
}
