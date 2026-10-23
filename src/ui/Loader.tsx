'use client';

import { useProgress } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { useExperience } from '@/store/useExperience';
import { filamentHeat, formatLoading, loaderState } from './loaderState';
import { useCoarsePointer } from './useCoarsePointer';

const WARNING = 'WARNING — This tape contains flashing lights and loud sounds. Headphones recommended.';
/** How long the set takes to switch on after PLAY; the .loader animations in globals.css fit inside it. */
const SWITCH_ON_MS = 900;

/** The shown percent counts up toward `target` like a tape counter: never jumping, never going back. */
function useCounter(target: number): number {
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (shown >= target) return;
    const frame = requestAnimationFrame(() => setShown((s) => Math.min(target, s + Math.max(1, Math.ceil((target - s) * 0.12)))));
    return () => cancelAnimationFrame(frame);
  }, [shown, target]);
  return shown;
}

/** A bare filament across the dark, glowing out from its middle and warming from dull red to white as the tape loads. */
function Filament({ level }: { level: number }) {
  const heat = filamentHeat(level);
  return (
    <div aria-hidden className="relative h-px w-56">
      <div className="absolute inset-0 bg-osd/10" />
      <div
        className="filament absolute inset-x-0 -top-px h-[3px] rounded-full"
        style={{
          transform: `scaleX(${Math.max(0.02, level)})`,
          backgroundColor: heat,
          boxShadow: `0 0 ${4 + 14 * level}px ${1 + 2 * level}px ${heat}`,
        }}
      />
    </div>
  );
}

/**
 * The switched-off set before the tape plays: a filament warming up with the loading, the
 * counter, the warning. PLAY switches the set on: the filament flares into the tube's beam
 * and the dark parts from its line, opening the picture from the middle.
 */
export function Loader() {
  const started = useExperience((s) => s.started);
  const sceneReady = useExperience((s) => s.sceneReady);
  const warmup = useExperience((s) => s.warmup);
  const play = useExperience((s) => s.play);
  const { active, loaded, total, errors } = useProgress();
  const coarse = useCoarsePointer();
  const { status, percent } = loaderState({ sceneReady, active, loaded, total, errors, warmup });
  const shown = useCounter(percent);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!switching) return;
    const timer = setTimeout(() => setSwitching(false), SWITCH_ON_MS);
    return () => clearTimeout(timer);
  }, [switching]);

  if (started && !switching) return null;

  const onPlay = () => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setSwitching(true);
    play();
  };

  return (
    <div data-testid="loader" data-switching={switching || undefined} className="loader pointer-events-auto fixed inset-0 z-20 font-osd text-osd">
      <div className="tube tube-top" />
      <div className="tube tube-bottom" />
      <div className="loader-face absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="flex flex-col items-center gap-7">
          {status === 'error' ? (
            <div className="flex items-center gap-6 text-xl tracking-[0.3em]">
              <span className="text-alarm">TAPE ERROR</span>
              <button type="button" onClick={() => window.location.reload()} className="tracking-[0.3em] underline-offset-8 hover:underline">
                RETRY
              </button>
            </div>
          ) : status === 'ready' && shown >= 100 ? (
            <button type="button" onClick={onPlay} className="play-button text-2xl tracking-[0.35em]">
              ▶ PLAY
            </button>
          ) : (
            <p className="text-xl tracking-[0.3em] text-osd/70">{formatLoading(shown)}</p>
          )}
          <Filament level={shown / 100} />
        </div>
        <div className="absolute inset-x-6 bottom-10 flex flex-col items-center gap-2">
          <p className="max-w-md text-lg leading-snug tracking-wide text-osd/55">{WARNING}</p>
          {coarse && <p className="text-base tracking-wide text-osd/45">Best experienced on a desktop with headphones.</p>}
        </div>
      </div>
      <div aria-hidden className="beam" />
    </div>
  );
}
