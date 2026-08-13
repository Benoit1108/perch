/**
 * Surface publique de `core`.
 *
 * Elle est volontairement limitée à ce qui est RÉELLEMENT consommé aujourd'hui. Un baril
 * qui réexporte par anticipation est du code mort en attente : knip le signale, et c'est
 * voulu. Chaque sprint ajoute ici ce dont il a besoin, au moment où il en a besoin.
 *
 * Le reste (`stageForLevel`, `findLine`, `ActivityPort`…) existe et est testé dans son
 * module ; seule son exposition attend son premier consommateur.
 */

export type {
  ClockPort,
  Point,
  Rect,
  SensorPort,
  StoragePort,
  StorageRead,
} from './ports/index.js';

export type { CreaturePack } from './creatures/manifest.js';
export { parseCreaturePack } from './creatures/pack.js';

export type { PerchState } from './state/schema.js';
export { createInitialState, readState } from './state/schema.js';
