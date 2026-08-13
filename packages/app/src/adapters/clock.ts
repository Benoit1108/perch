import type { ClockPort } from '@perch/core';

/**
 * Horloge système.
 *
 * Le moteur ne lit jamais l'heure directement : il passe par ce port, ce qui permet de
 * simuler une journée entière en quelques millisecondes dans les tests.
 */
export const systemClock: ClockPort = {
  now: () => Date.now(),
};
