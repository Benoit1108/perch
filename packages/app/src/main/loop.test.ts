import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Point, Rect, SensorPort } from '@perch/core';

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

describe('startLoop', () => {
  it('pose le compagnon sur une surface plutôt qu’en 0,0', async () => {
    const { sink, frames } = collector();
    const stop = startLoop({ overlay: sink, sensors: fakeSensors(null), debug: false });

    await vi.advanceTimersByTimeAsync(200);
    stop();

    const last = frames.at(-1);
    expect(frames.length).toBeGreaterThan(0);
    expect(last?.surfaces).toHaveLength(1);
    // Au milieu du sol : 0,0 pourrait se trouver dans une zone vide.
    expect(last?.pet.x).toBeCloseTo(960, 0);
    expect(last?.pet.y).toBe(1080);
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
    expect(last?.pet.state).toBe('court');
  });

  it('reste au repos quand la position du curseur est inconnue', async () => {
    const { sink, frames } = collector();
    const stop = startLoop({ overlay: sink, sensors: fakeSensors(null), debug: false });

    await vi.advanceTimersByTimeAsync(500);
    stop();

    expect(frames.at(-1)?.pet.state).toBe('repos');
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
