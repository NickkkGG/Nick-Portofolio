'use client';

import { useProgress } from '@react-three/drei';
import { useExperience } from '@/store/useExperience';
import { formatLoading, loaderState } from './loaderState';
import { useCoarsePointer } from './useCoarsePointer';

const WARNING = 'WARNING — This tape contains flashing lights and loud sounds. Headphones recommended.';

/** Bulb whose filament warms up with the loading progress. */
function Filament({ glow }: { glow: number }) {
  return (
    <svg width="72" height="108" viewBox="0 0 72 108" aria-hidden className="mb-8">
      <path
        d="M36 6c-17 0-30 13-30 30 0 12 7 20 13 27 4 5 6 10 6 15v6h22v-6c0-5 2-10 6-15 6-7 13-15 13-27C66 19 53 6 36 6z"
        fill="none"
        stroke="#e8e6d9"
        strokeOpacity={0.25}
        strokeWidth={1.5}
      />
      <path d="M27 92h18M28 98h16M31 104h10" stroke="#e8e6d9" strokeOpacity={0.25} strokeWidth={1.5} />
      <path
        d="M28 84V58l4-10 4 10 4-10 4 10v26"
        fill="none"
        stroke="#ffb35c"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{
          opacity: 0.15 + 0.85 * glow,
          filter: `drop-shadow(0 0 ${2 + 12 * glow}px #ffb35c)`,
        }}
      />
    </svg>
  );
}

export function Loader() {
  const started = useExperience((s) => s.started);
  const sceneReady = useExperience((s) => s.sceneReady);
  const play = useExperience((s) => s.play);
  const { active, loaded, total, errors } = useProgress();
  const coarse = useCoarsePointer();
  if (started) return null;

  const { status, percent } = loaderState({ sceneReady, active, loaded, total, errors });

  return (
    <div
      data-testid="loader"
      className="pointer-events-auto fixed inset-0 z-20 flex flex-col items-center justify-center bg-ink px-6 text-center font-osd text-osd"
    >
      <p className="mb-12 max-w-xl border border-osd/40 px-6 py-4 text-xl leading-snug tracking-wide">{WARNING}</p>
      <Filament glow={percent / 100} />
      {status === 'error' ? (
        <>
          <p className="mb-4 text-2xl text-alarm">TAPE ERROR</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-osd px-6 py-2 text-2xl hover:bg-osd hover:text-ink"
          >
            RETRY
          </button>
        </>
      ) : status === 'ready' ? (
        <button
          type="button"
          onClick={play}
          className="border border-osd px-8 py-2 text-3xl tracking-widest hover:bg-osd hover:text-ink"
        >
          ▶ PLAY
        </button>
      ) : (
        <p className="text-2xl tracking-widest">{formatLoading(percent)}</p>
      )}
      {coarse && <p className="mt-10 text-lg text-osd/70">Best experienced on a desktop with headphones.</p>}
    </div>
  );
}
