import type { ClockPort } from '@perch/core';

/** Horloge système. Le seul endroit du projet où `Date.now()` est autorisé. */
export const systemClock: ClockPort = {
  now: () => Date.now(),
};
