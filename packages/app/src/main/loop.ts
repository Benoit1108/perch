import type {
  ActivityPort,
  Mood,
  MotionConfig,
  Pet,
  Point,
  Rect,
  SensorPort,
  Surface,
} from '@perch/core';
import {
  boundingBox,
  buildSurfaces,
  defaultMotionConfig,
  isFullscreen,
  WONDERING_MS,
  moodFor,
  newPet,
  step,
} from '@perch/core';

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

/**
 * Suit le curseur SANS bloquer la frame.
 *
 * Le relevé passe par D-Bus : l'attendre à chaque passage ferait dépendre la cadence
 * d'un aller-retour inter-processus, et la gigue deviendrait visible à l'écran.
 */
function createPointerFeed(sensors: SensorPort): () => Point | null {
  let latest: Point | null = null;
  let pending = false;

  return () => {
    if (!pending) {
      pending = true;
      void sensors
        .pointer()
        .then((value) => {
          latest = value;
        })
        .finally(() => {
          pending = false;
        });
    }
    return latest;
  };
}

/**
 * Suit l'inactivité de l'utilisateur SANS bloquer la frame.
 *
 * Sa valeur était câblée à zéro : le compagnon ne pouvait donc jamais s'endormir, et tout
 * ce qui en dépend — l'état `sommeil`, son animation ralentie, son bâillement — restait
 * inatteignable. Sans capteur d'activité branché, on garde l'ancien comportement : un
 * compagnon toujours éveillé vaut mieux qu'un compagnon endormi à tort.
 */
function createIdleFeed(activity: ActivityPort | undefined): () => number {
  if (activity === undefined) return () => 0;

  let latest = 0;
  let pending = false;

  return () => {
    if (!pending) {
      pending = true;
      void activity
        .idleMs()
        .then((value) => {
          // `null` — plateforme sans moniteur d'inactivité — vaut ÉVEILLÉ, pas absent.
          latest = value ?? 0;
        })
        .finally(() => {
          pending = false;
        });
    }
    return latest;
  };
}

/** Journée courante, au format du reste de l'application. */
const today = (): string => new Date().toISOString().slice(0, 10);

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
  bavarde: boolean
): string | null {
  if (options.voice === undefined) return null;

  const humeur = moodFor(avant, maintenant);
  if (humeur !== null) options.voice.say(humeur);

  // Une remarque de fond, réservée aux moments où quelqu'un est là pour la lire.
  if (humeur === null && bavarde && maintenant.idleMs < WONDERING_MS) {
    options.voice.say({ key: 'speech.chatter', register: 'bavardage' });
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
  let surfaces: Surface[] = [];
  let bounds: Rect | null = null;
  let fenetres: readonly Rect[] = [];
  let tick = 0;
  let place = false;
  let fullscreen = false;
  let bubble: string | null = null;
  let bubbleUntil = 0;
  let mood: Mood | null = null;

  const refreshGeometry = async (): Promise<void> => {
    const [monitors, windows] = await Promise.all([sensors.monitors(), sensors.windows()]);
    surfaces = buildSurfaces(monitors, windows);
    fenetres = windows;
    bounds = boundingBox(monitors);
    fullscreen = isFullscreen(monitors, windows);

    // Premier placement.
    //
    // Surtout PAS `surfaces[0]` : elles sont triées du haut vers le bas, et la première
    // est donc le bord de la fenêtre la plus haute. Le compagnon s'y posait et n'avait
    // aucune raison d'en bouger — il restait figé en haut de l'écran.
    //
    // On le lâche au-dessus d'un sol d'écran et on laisse la pesanteur faire le reste :
    // elle sait déjà éviter les zones vides.
    if (!place) {
      const sol = surfaces.filter((surface) => surface.kind === 'ecran').at(-1) ?? surfaces[0];
      if (sol !== undefined) {
        pet = { ...pet, x: (sol.start + sol.end) / 2, y: sol.y - 1 };
        place = true;
      }
    }
  };

  const readPointer = createPointerFeed(sensors);
  const readIdle = createIdleFeed(options.activity);

  const frame = async (): Promise<void> => {
    tick += 1;
    if (tick % GEOMETRY_EVERY === 1) await refreshGeometry();

    const pointer = readPointer();
    const idleMs = readIdle();
    pet = step(pet, { surfaces, bounds, pointer, idleMs, nowMs: Date.now() }, FRAME_MS, config);

    const now = tick * FRAME_MS;
    if (tick % VOICE_EVERY === 0) {
      const vu: Mood = { state: pet.state, idleMs, dayKey: today(), windows: fenetres };
      const dit = parle(options, mood, vu, fullscreen, tick % (CHATTER_EVERY * 60) === 0);
      mood = vu;

      if (dit !== null) {
        bubble = dit;
        bubbleUntil = now + BUBBLE_MS;
      }
    }
    if (now >= bubbleUntil) bubble = null;

    overlay.send('perch:frame', {
      pet,
      pointer,
      surfaces,
      origin: overlay.origin,
      backend: sensors.name,
      // Le compagnon se cache entièrement en plein écran, il ne se contente pas de se taire.
      hidden: fullscreen,
      bubble,
      debug,
    });
  };

  return createTicker(FRAME_MS, frame);
}
