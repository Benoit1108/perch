/**
 * Surface publique de `core`.
 *
 * Elle est volontairement limitée à ce qui est RÉELLEMENT consommé aujourd'hui. Un baril
 * qui réexporte par anticipation est du code mort en attente : knip le signale, et c'est
 * voulu. Chaque sprint ajoute ici ce dont il a besoin, au moment où il en a besoin.
 */

export type {
  ClockPort,
  Point,
  Rect,
  SensorPort,
  StoragePort,
  StorageRead,
} from './ports/index.js';

export type {
  Clip,
  ClipName,
  CreatureLine,
  CreaturePack,
  CreatureStage,
} from './creatures/manifest.js';
export { evolutionBetween, findLine, parseCreaturePack, stageForLevel } from './creatures/pack.js';
export { PLAYBACK } from './creatures/clips.js';

export type { PerchState } from './state/schema.js';
export { createInitialState, readState } from './state/schema.js';

export type { Surface } from './world/surfaces.js';
export { boundingBox, buildSurfaces } from './world/surfaces.js';

export type { ActivityPort } from './ports/activity.js';

export type { EarnConfig } from './xp/earn.js';
export { defaultEarnConfig } from './xp/earn.js';
export { progressFor } from './xp/curve.js';
export { advanceState } from './xp/progression.js';
export type { Evidence } from './quests/evidence.js';
export { noEvidence } from './quests/evidence.js';

export type { Envelope } from './exchange/envelope.js';
export { open, seal } from './exchange/envelope.js';

export type { Locale } from './i18n/catalog.js';
export { MESSAGE_KEYS, resolveLocale, translate } from './i18n/catalog.js';

export type { SpeechConfig, SpeechRequest, SpeechState } from './speech/scheduler.js';
export { defaultSpeechConfig, emptySpeech, pull, say } from './speech/scheduler.js';
export type { Mood } from './speech/moods.js';
export { moodFor } from './speech/moods.js';

export { isFullscreen } from './world/surfaces.js';

export type { MotionConfig, Pet, PetState } from './motion/pet.js';
export { defaultMotionConfig, newPet, PET_STATES } from './motion/pet.js';
export { step } from './motion/machine.js';
