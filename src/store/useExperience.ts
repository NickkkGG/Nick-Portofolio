import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CameraPose, Vec3 } from '@/experience/camera/types';
import { canKnock, INITIAL_KNOCK, knock, type KnockState } from '@/experience/chapters/room/knock';
import type { ScrollApi } from '@/scroll/types';
import { nextLoopIndex } from '@/timeline/loop';
import { wrapProgress } from '@/timeline/resolve';
import { boundarySpike } from '@/timeline/transitions';

export const VHS_BASE_DEFAULT = 0.22;

export interface ExperienceState {
  started: boolean;
  sceneReady: boolean;
  /** 0..1: how far the scene has warmed up behind the loader; 1 once it is ready. */
  warmup: number;
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
  knock: KnockState;
  sounds: SoundEvent[];
  lastActivity: number;
  /** The contact tape under the pointer, if any. */
  tape: number | null;
  /** Whether the soundtrack plays (the visitor's choice; the sounds of the scene always do). */
  music: boolean;
  setSceneReady(): void;
  setWarmup(amount: number): void;
  play(): void;
  setScroll(p: number, opts?: { programmatic?: boolean }): void;
  tick(delta: number): void;
  setFrozen(on: boolean): void;
  spikeVhs(amount: number): void;
  setVhsBase(v: number): void;
  setCameraPose(pose: CameraPose): void;
  registerScroll(api: ScrollApi | null): void;
  knockAt(position: Vec3): boolean;
  setTape(index: number | null): void;
  setMusic(on: boolean): void;
}

export interface SoundEvent {
  name: string;
  time: number;
  position?: Vec3;
}

export const initialExperienceState: Pick<
  ExperienceState,
  | 'started'
  | 'sceneReady'
  | 'warmup'
  | 'p'
  | 'loopIndex'
  | 'frame'
  | 'time'
  | 'frozen'
  | 'vhsBase'
  | 'vhsSpike'
  | 'cameraPose'
  | 'scroll'
  | 'knock'
  | 'sounds'
  | 'lastActivity'
  | 'tape'
  | 'music'
> = {
  started: false,
  sceneReady: false,
  warmup: 0,
  p: 0,
  loopIndex: 1,
  frame: 0,
  time: 0,
  frozen: false,
  vhsBase: VHS_BASE_DEFAULT,
  vhsSpike: 0,
  cameraPose: null,
  scroll: null,
  knock: INITIAL_KNOCK,
  sounds: [],
  lastActivity: 0,
  tape: null,
  music: true,
};

export const useExperience = create<ExperienceState>()(
  subscribeWithSelector((set, get) => ({
    ...initialExperienceState,
    setSceneReady: () => set({ sceneReady: true, warmup: 1 }),
    setWarmup: (amount) => set({ warmup: Math.max(get().warmup, amount) }),
    play: () => {
      if (get().started) return;
      set({ started: true, vhsSpike: 1, lastActivity: get().time });
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
        lastActivity: get().time,
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
    knockAt: (position) => {
      const { p, time, sounds } = get();
      if (!canKnock(p)) return false;
      const result = knock(get().knock, time);
      if (!result.accepted) return false;
      set({
        knock: result.state,
        // Kept short: tests read it, nothing else needs history.
        sounds: [...sounds, { name: 'knock', time, position }].slice(-32),
        lastActivity: time,
      });
      return true;
    },
    setTape: (index) => {
      if (get().tape !== index) set({ tape: index });
    },
    setMusic: (on) => set({ music: on }),
  })),
);
