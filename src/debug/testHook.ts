import type { CameraPose } from '@/experience/camera/types';
import { useExperience } from '@/store/useExperience';
import type { ChapterId } from '@/timeline/chapters';
import { displayState } from '@/timeline/loop';
import { resolve } from '@/timeline/resolve';

export interface ExperienceSnapshot {
  started: boolean;
  sceneReady: boolean;
  p: number;
  loopIndex: number;
  chapterId: ChapterId;
  t: number;
  displayChapterId: ChapterId;
  time: number;
  frozen: boolean;
  frame: number;
  camera: CameraPose | null;
  scrollY: number;
}

export interface ExperienceTestHook {
  play(): void;
  jumpTo(p: number): void;
  freezeTime(on: boolean): void;
  getState(): ExperienceSnapshot;
  /** Resolves after `n` animation frames. */
  waitFrames(n: number): Promise<void>;
}

declare global {
  interface Window {
    __experience?: ExperienceTestHook;
  }
}

export function createTestHook(): ExperienceTestHook {
  const store = useExperience.getState;
  return {
    play: () => store().play(),
    jumpTo: (p) => store().scroll?.jumpTo(p),
    freezeTime: (on) => {
      store().setFrozen(on);
      // Screenshots should show the base VHS look, not the spike right after PLAY.
      if (on) useExperience.setState({ vhsSpike: 0 });
    },
    getState: () => {
      const s = store();
      const { chapter, t } = resolve(s.p);
      return {
        started: s.started,
        sceneReady: s.sceneReady,
        p: s.p,
        loopIndex: s.loopIndex,
        chapterId: chapter.id,
        t,
        displayChapterId: displayState(s.p).chapterId,
        time: s.time,
        frozen: s.frozen,
        frame: s.frame,
        camera: s.cameraPose,
        scrollY: window.scrollY,
      };
    },
    waitFrames: (n) =>
      new Promise((done) => {
        let left = Math.max(1, n);
        const step = () => {
          left -= 1;
          if (left <= 0) done();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
  };
}
