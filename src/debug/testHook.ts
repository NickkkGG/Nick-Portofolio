import type { CameraPose } from '@/experience/camera/types';
import { tensionAt } from '@/experience/chapters/room/knock';
import { type SoundEvent, useExperience } from '@/store/useExperience';
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
  /** Ghost knock tension right now (0-5). */
  tension: number;
  /** Sound events so far, e.g. each knock and where it came from. */
  sounds: SoundEvent[];
  /** Whether the soundtrack is switched on. */
  music: boolean;
}

export interface ExperienceTestHook {
  play(): void;
  jumpTo(p: number): void;
  freezeTime(on: boolean): void;
  /** Sets the scene clock, so frozen screenshots from different runs show the same moment. */
  setTime(seconds: number): void;
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
    setTime: (seconds) => useExperience.setState({ time: seconds }),
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
        tension: tensionAt(s.knock, s.time),
        sounds: s.sounds,
        music: s.music,
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
