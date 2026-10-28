'use client';

import { useEffect, useRef, useState } from 'react';
import { useExperience } from '@/store/useExperience';
import { typeOn } from './reveal';

/**
 * How much of a text is typed (reveal.ts): while it is `up` it types itself in on the scene
 * clock, and back out once it is down, wherever the scroll stops. It starts from nothing, or
 * already typed if `startTyped` and it is up the moment it mounts (the room's title on PLAY,
 * which waits for the picture as noise instead). A frozen clock or reduced motion settles at once.
 */
export function useTyped(up: boolean, startTyped = false): number {
  const [fraction, setFraction] = useState(() => (startTyped && up ? 1 : 0));
  const live = useRef(fraction);

  useEffect(() => {
    const done = up ? 1 : 0;
    if (live.current === done) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = useExperience.getState().time;
    let frame = 0;
    const step = () => {
      const { time, frozen } = useExperience.getState();
      live.current = typeOn(live.current, frozen || reduced ? Infinity : time - last, up);
      last = time;
      setFraction(live.current);
      if (live.current !== done) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [up]);

  return fraction;
}
