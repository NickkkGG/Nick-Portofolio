import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CameraPose } from '@/experience/camera/types';
import type { ScrollApi } from '@/scroll/types';
import { nextLoopIndex } from '@/timeline/loop';
import { wrapProgress } from '@/timeline/resolve';
import { boundarySpike } from '@/timeline/transitions';

export const VHS_BASE_DEFAULT = 0.22;

export interface ExperienceState {
  started: boolean;
  sceneReady: boolean;
  /** Global progress through one loop, 0..1. */
  p: number;
  loopIndex: number;
  frame: number;
  /** Scene clock in seconds; stops while frozen. */
  time: number;
  frozen: boolean;
  vhsBase: number;
  vhsSpike: number;
  cameraPose: CameraPose | null;
  scroll: ScrollApi | null;
  setSceneReady(): void;
  play(): void;
  setScroll(p: number, opts?: { programmatic?: boolean }): void;
  tick(delta: number): void;
  setFrozen(on: boolean): void;
  spikeVhs(amount: number): void;
  setVhsBase(v: number): void;
  setCameraPose(pose: CameraPose): void;
  registerScroll(api: ScrollApi | null): void;
}

export const initialExperienceState: Pick<
  ExperienceState,
  'started' | 'sceneReady' | 'p' | 'loopIndex' | 'frame' | 'time' | 'frozen' | 'vhsBase' | 'vhsSpike' | 'cameraPose' | 'scroll'
> = {
  started: false,
  sceneReady: false,
  p: 0,
  loopIndex: 1,
  frame: 0,
  time: 0,
  frozen: false,
  vhsBase: VHS_BASE_DEFAULT,
  vhsSpike: 0,
  cameraPose: null,
  scroll: null,
};

export const useExperience = create<ExperienceState>()(
  subscribeWithSelector((set, get) => ({
    ...initialExperienceState,
    setSceneReady: () => set({ sceneReady: true }),
    play: () => {
      if (get().started) return;
      set({ started: true, vhsSpike: 1 });
      get().scroll?.start();
    },
    setScroll: (p, opts) => {
      const { p: prevP, loopIndex, vhsSpike } = get();
      const next = wrapProgress(p);
      const nextLoop = opts?.programmatic ? loopIndex : nextLoopIndex(prevP, next, loopIndex);
      // Jumps (nav, tests) cut cleanly; only the visitor's own scrolling chews the tape.
      const chapterSpike = opts?.programmatic ? 0 : boundarySpike(prevP, next);
      const loopSpike = nextLoop !== loopIndex ? 0.6 : 0;
      set({
        p: next,
        loopIndex: nextLoop,
        vhsSpike: Math.max(vhsSpike, chapterSpike, loopSpike),
      });
    },
    tick: (delta) => {
      const { frame, frozen, time, vhsSpike } = get();
      if (frozen) {
        set({ frame: frame + 1 });
        return;
      }
      set({ frame: frame + 1, time: time + delta, vhsSpike: Math.max(0, vhsSpike - delta * 1.2) });
    },
    setFrozen: (on) => set({ frozen: on }),
    spikeVhs: (amount) => set({ vhsSpike: Math.max(get().vhsSpike, amount) }),
    setVhsBase: (v) => set({ vhsBase: v }),
    setCameraPose: (pose) => set({ cameraPose: pose }),
    registerScroll: (api) => set({ scroll: api }),
  })),
);
