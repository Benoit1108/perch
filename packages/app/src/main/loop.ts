import type { MotionConfig, Pet, Rect, SensorPort, Surface } from '@perch/core';
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

    // Premier placement : au milieu de la première surface venue, plutôt qu'en 0,0 qui
    // peut se trouver dans une zone vide.
    if (!place) {
      const first = surfaces[0];
      if (first !== undefined) {
        pet = { ...pet, x: (first.start + first.end) / 2, y: first.y };
        place = true;
      }
    }
  };

  const frame = async (): Promise<void> => {
    tick += 1;
    if (tick % GEOMETRY_EVERY === 1) await refreshGeometry();

    const pointer = await sensors.pointer();
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

  const timer = setInterval(() => {
    void frame().catch((error: unknown) => {
      console.error('[perch] frame', error);
    });
  }, FRAME_MS);

  return () => {
    clearInterval(timer);
  };
}
