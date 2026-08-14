import type { MotionConfig, Pet, Point, Rect, SensorPort, Surface } from '@perch/core';
import { buildSurfaces, defaultMotionConfig, isFullscreen, step } from '@perch/core';

import type { Voice } from './voice.js';

const FRAME_MS = 16;
/** La géométrie bouge bien plus lentement que le curseur : 4 relevés par seconde suffisent. */
const GEOMETRY_EVERY = 15;
/** La voix n'a pas besoin d'être consultée à chaque frame : une fois par seconde suffit. */
const VOICE_EVERY = 60;
/** Durée d'affichage d'une bulle. */
const BUBBLE_MS = 5_000;

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
 * Boucle d'animation.
 *
 * Elle ne décide de rien : elle lit les capteurs, confie l'état à `core`, et transmet le
 * résultat au rendu. Toute la logique de déplacement est ailleurs, testée sans Electron.
 */
export function startLoop(options: LoopOptions): () => void {
  const config = options.config ?? defaultMotionConfig;
  const { overlay, sensors, debug } = options;

  let pet: Pet = { x: 0, y: 0, vy: 0, facing: 1, state: 'chute' };
  let surfaces: Surface[] = [];
  let tick = 0;
  let place = false;
  let fullscreen = false;
  let bubble: string | null = null;
  let bubbleUntil = 0;

  const refreshGeometry = async (): Promise<void> => {
    const [monitors, windows] = await Promise.all([sensors.monitors(), sensors.windows()]);
    surfaces = buildSurfaces(monitors, windows);
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
        pet = { ...pet, x: (sol.start + sol.end) / 2, y: sol.y - 1, state: 'chute' };
        place = true;
      }
    }
  };

  const readPointer = createPointerFeed(sensors);

  const frame = async (): Promise<void> => {
    tick += 1;
    if (tick % GEOMETRY_EVERY === 1) await refreshGeometry();

    const pointer = readPointer();
    pet = step(pet, { surfaces, pointer, idleMs: 0 }, FRAME_MS, config);

    const now = tick * FRAME_MS;
    if (tick % VOICE_EVERY === 0 && options.voice !== undefined) {
      const dit = options.voice.pull({
        focused: options.isFocused?.() ?? false,
        fullscreen,
      });
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
