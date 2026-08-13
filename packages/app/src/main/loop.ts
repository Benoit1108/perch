import type { MotionConfig, Pet, Rect, SensorPort, Surface } from '@perch/core';
import { buildSurfaces, defaultMotionConfig, step } from '@perch/core';

const FRAME_MS = 16;
/** La géométrie bouge bien plus lentement que le curseur : 4 relevés par seconde suffisent. */
const GEOMETRY_EVERY = 15;

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

  const refreshGeometry = async (): Promise<void> => {
    const [monitors, windows] = await Promise.all([sensors.monitors(), sensors.windows()]);
    surfaces = buildSurfaces(monitors, windows);

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

    overlay.send('perch:frame', {
      pet,
      pointer,
      surfaces,
      origin: overlay.origin,
      backend: sensors.name,
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
