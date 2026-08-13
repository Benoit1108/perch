import type {
  ActivityPort,
  ClockPort,
  EarnConfig,
  Evidence,
  PerchState,
  StoragePort,
} from '@perch/core';
import { advanceState, defaultEarnConfig, noEvidence } from '@perch/core';

/** Ce que les sources branchées savent rapporter à un instant donné. */
export interface SourceSnapshot {
  readonly evidence: Evidence;
  readonly observedCommits: readonly string[];
  readonly tasksDone: number;
}

export const noSources: SourceSnapshot = {
  evidence: noEvidence,
  observedCommits: [],
  tasksDone: 0,
};

const DEFAULT_TICK_MS = 60_000;

export interface ProgressionDeps {
  readonly clock: ClockPort;
  readonly activity: ActivityPort;
  readonly storage: StoragePort;
  readonly config?: EarnConfig;
  readonly tickMs?: number;
  readonly onLevelUp?: (level: number) => void;
  readonly onQuestDone?: (questId: string) => void;
  /** Relevé des sources spécialisées. Absent = profil universel seul, jeu complet. */
  readonly sources?: () => Promise<SourceSnapshot>;
}

export interface Progression {
  current(): PerchState;
  stop(): void;
}

/**
 * Accumulation de l'expérience, une minute à la fois.
 *
 * Le temps écoulé est BORNÉ à deux ticks. Sans cette borne, une machine mise en veille
 * huit heures rendrait huit heures d'expérience au réveil : `Date.now()` a avancé, mais
 * personne n'a travaillé. Le moniteur d'inactivité ne suffit pas à s'en protéger — au
 * réveil, l'utilisateur bouge sa souris et paraît donc parfaitement actif.
 */
export function startProgression(initial: PerchState, deps: ProgressionDeps): Progression {
  const tickMs = deps.tickMs ?? DEFAULT_TICK_MS;
  const config = deps.config ?? defaultEarnConfig;

  let state = initial;
  let lastAt = deps.clock.now();

  const tick = async (): Promise<void> => {
    const now = deps.clock.now();
    const elapsed = Math.min(Math.max(now - lastAt, 0), tickMs * 2);
    lastAt = now;

    const [idleMs, app, sources] = await Promise.all([
      deps.activity.idleMs(),
      deps.activity.focusedApp(),
      deps.sources?.() ?? Promise.resolve(noSources),
    ]);

    const result = advanceState(state, {
      sample: { idleMs, app },
      elapsedMs: elapsed,
      nowMs: now,
      earn: config,
      evidence: sources.evidence,
      observedCommits: sources.observedCommits,
      tasksDone: sources.tasksDone,
    });
    state = result.state;

    if (result.leveledTo !== null) deps.onLevelUp?.(result.leveledTo);
    for (const quest of result.completedQuests) deps.onQuestDone?.(quest);

    await deps.storage.write(state);
  };

  const timer = setInterval(() => {
    void tick().catch((error: unknown) => {
      console.error('[perch] progression', error);
    });
  }, tickMs);

  return {
    current: () => state,
    stop: () => {
      clearInterval(timer);
    },
  };
}
