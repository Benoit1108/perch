import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityPort, Point, Rect, SensorPort } from '@perch/core';

import type { FrameSink } from './loop.js';
import { startLoop } from './loop.js';

const dp3: Rect = { x: 0, y: 0, width: 1920, height: 1080 };

function fakeSensors(pointer: Point | null, monitors: readonly Rect[] = [dp3]): SensorPort {
  return {
    name: 'faux',
    capabilities: { pointer: pointer !== null, windows: true },
    pointer: () => Promise.resolve(pointer),
    windows: () => Promise.resolve([]),
    monitors: () => Promise.resolve(monitors),
  };
}

interface Frame {
  readonly pet: { readonly x: number; readonly y: number; readonly state: string };
  readonly surfaces: readonly unknown[];
}

function isFrame(value: unknown): value is Frame {
  if (typeof value !== 'object' || value === null) return false;
  if (!('pet' in value) || !('surfaces' in value)) return false;
  const { pet } = value;
  return typeof pet === 'object' && pet !== null && 'state' in pet;
}

function collector(): { sink: FrameSink; frames: Frame[] } {
  const frames: Frame[] = [];
  return {
    frames,
    sink: {
      origin: { x: 0, y: 0, width: 1920, height: 1080 },
      send: (_channel, payload) => {
        if (isFrame(payload)) frames.push(payload);
      },
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Source d'activité de doublure. `null` imite une plateforme qui ne sait pas mesurer. */
function fakeActivity(idleMs: number | null): ActivityPort {
  return {
    idleMs: () => Promise.resolve(idleMs),
    focusedApp: () => Promise.resolve(null),
  };
}

/**
 * Le câblage de l'inactivité, et pas seulement la règle qui en dépend.
 *
 * La boucle passait `idleMs: 0` en dur : le compagnon ne pouvait donc jamais s'endormir,
 * et le défaut a vécu des semaines sans que rien ne le signale. Les états de sommeil sont
 * testés ailleurs — ce qui manquait, c'est la preuve que la valeur arrive jusqu'au moteur.
 */
describe('startLoop — inactivité', () => {
  it('endort le compagnon quand la source rapporte une longue inactivité', async () => {
    const { sink, frames } = collector();
    const stop = startLoop({
      overlay: sink,
      sensors: fakeSensors(null),
      debug: false,
      activity: fakeActivity(10 * 60_000),
    });

    await vi.advanceTimersByTimeAsync(400);
    stop();

    expect(frames.at(-1)?.pet.state).toBe('sommeil');
  });

  // Invariant I7 : sans moniteur d'inactivité — KDE, X11 hors GNOME, Windows avant S7 —
  // le compagnon doit vivre quand même. Confondre « non mesurable » et « inactif depuis
  // toujours » l'endormirait définitivement sur ces machines.
  it('reste éveillé quand la plateforme ne sait pas mesurer', async () => {
    const { sink, frames } = collector();
    const stop = startLoop({
      overlay: sink,
      sensors: fakeSensors(null),
      debug: false,
      activity: fakeActivity(null),
    });

    await vi.advanceTimersByTimeAsync(400);
    stop();

    expect(frames.at(-1)?.pet.state).not.toBe('sommeil');
  });
});

describe('startLoop', () => {
  it('pose le compagnon sur une surface plutôt qu’en 0,0', async () => {
    const { sink, frames } = collector();
    const stop = startLoop({ overlay: sink, sensors: fakeSensors(null), debug: false });

    await vi.advanceTimersByTimeAsync(200);
    stop();

    const last = frames.at(-1);
    expect(frames.length).toBeGreaterThan(0);
    expect(last?.surfaces).toHaveLength(1);
    // Posé sur le sol, et non en 0,0 qui pourrait se trouver dans une zone vide. Son
    // abscisse dérive : une fois posé, il se promène.
    expect(last?.pet.y).toBe(1080);
    expect(last?.pet.x).toBeGreaterThan(0);
    expect(last?.pet.x).toBeLessThan(1920);
  });

  it('suit le curseur quand les capteurs le fournissent', async () => {
    const { sink, frames } = collector();
    const stop = startLoop({
      overlay: sink,
      sensors: fakeSensors({ x: 1800, y: 1080 }),
      debug: false,
    });

    await vi.advanceTimersByTimeAsync(500);
    stop();

    const last = frames.at(-1);
    expect(last?.pet.x).toBeGreaterThan(960);
    expect(last?.pet.state).toBe('suit');
  });

  it('se pose et vit sa vie quand la position du curseur est inconnue', async () => {
    const { sink, frames } = collector();
    const stop = startLoop({ overlay: sink, sensors: fakeSensors(null), debug: false });

    await vi.advanceTimersByTimeAsync(500);
    stop();

    // Sans curseur à suivre — Wayland sans extension — il ne vole pas : il se promène.
    expect(['repos', 'marche', 'chute']).toContain(frames.at(-1)?.pet.state);
  });

  it('cesse d’émettre après l’arrêt', async () => {
    const { sink, frames } = collector();
    const stop = startLoop({ overlay: sink, sensors: fakeSensors(null), debug: false });

    await vi.advanceTimersByTimeAsync(100);
    stop();
    const compte = frames.length;

    await vi.advanceTimersByTimeAsync(500);
    expect(frames.length).toBe(compte);
  });

  it('survit à un bureau sans aucun écran', async () => {
    const { sink, frames } = collector();
    const stop = startLoop({ overlay: sink, sensors: fakeSensors(null, []), debug: false });

    await vi.advanceTimersByTimeAsync(200);
    stop();

    expect(frames.at(-1)?.surfaces).toEqual([]);
  });
});
