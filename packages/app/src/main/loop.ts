import type { ActivityPort, Mood, MotionConfig, Pet, Rect, SensorPort } from '@perch/core';
import { defaultMotionConfig, WONDERING_MS, moodFor, newPet, step } from '@perch/core';

import { createFocusFeed, createIdleFeed, createPointerFeed } from './feeds.js';
import { createWorldFeed } from './world.js';
import type { Voice } from './voice.js';

const FRAME_MS = 16;
/** La géométrie bouge bien plus lentement que le curseur : 4 relevés par seconde suffisent. */
const GEOMETRY_EVERY = 15;
/** La voix n'a pas besoin d'être consultée à chaque frame : une fois par seconde suffit. */
const VOICE_EVERY = 60;
/** Durée d'affichage d'une bulle. */
const BUBBLE_MS = 5_000;
/**
 * Cadence des remarques ordinaires, en passages de voix (donc en secondes).
 *
 * Sans elles, le compagnon ne parlait qu'aux événements — montée de niveau, sommeil,
 * changement de bureau — c'est-à-dire presque jamais. Une demande régulière suffit : c'est
 * le cadenceur de parole qui décide s'il est convenable de la dire, et il écarte les
 * demandes périmées.
 */
const CHATTER_EVERY = 4 * 60;

/**
 * Tout ce dont la boucle a besoin de l'overlay.
 *
 * Dépendre de la classe entière la rendrait intestable : ses champs privés empêchent
 * toute doublure structurelle, et la tester exigerait un vrai Electron.
 */
export interface FrameSink {
  readonly origin: Rect;
  send(channel: string, payload: unknown): void;
}

export interface LoopOptions {
  readonly overlay: FrameSink;
  readonly sensors: SensorPort;
  readonly debug: boolean;
  readonly config?: MotionConfig;
  readonly voice?: Voice;
  /** Source d'inactivité. Absente, le compagnon ne dort jamais. */
  readonly activity?: ActivityPort;
  /**
   * Zone réellement libre du bureau, barres système exclues.
   *
   * Les panneaux de l'environnement — barre du haut, dock — se dessinent AU-DESSUS de
   * toute fenêtre, y compris celles marquées « toujours au premier plan ». Un compagnon
   * borné à l'écran entier passe donc dessous et paraît coupé en deux le long des bords.
   * Absente, on se rabat sur la géométrie des écrans.
   */
  readonly workArea?: () => Rect | null;
  /** L'utilisateur est-il en période de concentration ? Le compagnon se tait alors (I6). */
  readonly isFocused?: () => boolean;
}

/**
 * Boucle auto-planifiée.
 *
 * `setInterval` avec un corps asynchrone empile les exécutions dès qu'une frame dépasse
 * son budget, et la cadence s'effondre par à-coups. On replanifie donc après chaque
 * passage plutôt qu'à intervalle fixe.
 */
function createTicker(intervalMs: number, body: () => Promise<void>): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = true;

  const schedule = (): void => {
    timer = setTimeout(() => {
      void body()
        .catch((error: unknown) => {
          console.error('[perch] frame', error);
        })
        .finally(() => {
          if (running) schedule();
        });
    }, intervalMs);
  };
  schedule();

  return () => {
    running = false;
    if (timer !== null) clearTimeout(timer);
  };
}

/** Journée courante, au format du reste de l'application. */
const today = (): string => new Date().toISOString().slice(0, 10);

/** Remarques de fond, à tour de rôle : la même phrase répétée lasse tout de suite. */
const REMARQUES = ['speech.chatter', 'speech.chatterB', 'speech.chatterC'] as const;

/** La remarque du moment, ou `null` si ce n'est pas encore l'heure d'en faire une. */
function tourDeRemarque(tick: number): (typeof REMARQUES)[number] | null {
  const periode = CHATTER_EVERY * 60;
  if (tick % periode !== 0) return null;

  return REMARQUES[Math.floor(tick / periode) % REMARQUES.length] ?? null;
}

/**
 * Ce que le compagnon a à dire maintenant, ou `null` s'il se tait.
 *
 * Deux étapes distinctes : la situation lui INSPIRE peut-être quelque chose (`moodFor`),
 * et le cadenceur décide ensuite si c'est le moment de le dire. Un compagnon qui pense
 * n'est pas un compagnon qui parle.
 */
function parle(
  options: LoopOptions,
  avant: Mood | null,
  maintenant: Mood,
  fullscreen: boolean,
  bavarde: (typeof REMARQUES)[number] | null
): string | null {
  if (options.voice === undefined) return null;

  const humeur = moodFor(avant, maintenant);
  if (humeur !== null) options.voice.say(humeur);

  // Une remarque de fond, réservée aux moments où quelqu'un est là pour la lire.
  if (humeur === null && bavarde !== null && maintenant.idleMs < WONDERING_MS) {
    options.voice.say({ key: bavarde, register: 'bavardage' });
  }

  return options.voice.pull({ focused: options.isFocused?.() ?? false, fullscreen });
}

/**
 * Boucle d'animation.
 *
 * Elle ne décide de rien : elle lit les capteurs, confie l'état à `core`, et transmet le
 * résultat au rendu. Toute la logique de déplacement est ailleurs, testée sans Electron.
 */
export function startLoop(options: LoopOptions): () => void {
  const config = options.config ?? defaultMotionConfig;
  const { overlay, sensors, debug } = options;

  let pet: Pet = newPet(0, 0);
  let tick = 0;
  let bubble: string | null = null;
  let bubbleUntil = 0;
  let mood: Mood | null = null;

  const monde = createWorldFeed(sensors, options.workArea);
  const readPointer = createPointerFeed(sensors);
  const readIdle = createIdleFeed(options.activity);
  const readFocus = createFocusFeed(options.activity);

  const frame = async (): Promise<void> => {
    tick += 1;
    if (tick % GEOMETRY_EVERY === 1) {
      await monde.refresh();
      pet = { ...pet, ...(monde.takeStart() ?? {}) };
    }

    const pointer = readPointer();
    const idleMs = readIdle();
    const vu = {
      surfaces: monde.surfaces,
      bounds: monde.bounds,
      pointer,
      idleMs,
      nowMs: Date.now(),
    };
    pet = step(pet, vu, FRAME_MS, config);

    const now = tick * FRAME_MS;
    if (tick % VOICE_EVERY === 0) {
      const humeur: Mood = {
        state: pet.state,
        idleMs,
        dayKey: today(),
        windows: monde.windows,
        app: readFocus(),
        tired: pet.plan === 'repose',
      };

      const dit = parle(options, mood, humeur, monde.fullscreen, tourDeRemarque(tick));
      mood = humeur;

      if (dit !== null) {
        bubble = dit;
        bubbleUntil = now + BUBBLE_MS;
      }
    }
    if (now >= bubbleUntil) bubble = null;

    overlay.send('perch:frame', {
      pet,
      pointer,
      surfaces: monde.surfaces,
      origin: overlay.origin,
      backend: sensors.name,
      // Le compagnon se cache entièrement en plein écran, il ne se contente pas de se taire.
      hidden: monde.fullscreen,
      bubble,
      debug,
    });
  };

  return createTicker(FRAME_MS, frame);
}
