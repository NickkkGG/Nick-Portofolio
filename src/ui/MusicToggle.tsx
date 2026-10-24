'use client';

import { useState } from 'react';
import { playSfx } from '@/audio/sfx';
import { saveMusicChoice } from '@/audio/Soundtrack';
import { useExperience } from '@/store/useExperience';
import { DecodeText } from './DecodeText';

/** How fast each bar of the meter bounces. */
const BARS = [0.9, 1.7, 1.2, 2.3];

/** The soundtrack's switch, drawn as a camcorder's audio meter: it lies flat while the music is off. */
export function MusicToggle() {
  const on = useExperience((s) => s.music);
  // 12 steps a second on the store clock, so frozen screenshots stay still.
  const tick = useExperience((s) => Math.floor(s.time * 12));
  const [passes, setPasses] = useState(0);
  const notice = () => {
    setPasses((n) => n + 1);
    playSfx('hover');
  };
  const toggle = () => {
    useExperience.getState().setMusic(!on);
    saveMusicChoice(!on);
    playSfx('toggle');
  };
  return (
    <button
      type="button"
      data-overlay-item
      data-testid="music-toggle"
      aria-label="Music"
      aria-pressed={on}
      onPointerEnter={notice}
      onFocus={notice}
      onClick={toggle}
      className={`pointer-events-auto flex items-center gap-2 text-xl tracking-widest transition-opacity hover:opacity-100 ${on ? 'opacity-70' : 'opacity-40'}`}
    >
      <span aria-hidden className="flex h-4 items-end gap-[3px]">
        {BARS.map((speed, i) => {
          const level = on ? 0.25 + 0.75 * Math.abs(Math.sin((tick / 12) * speed * 3 + i * 1.9)) : 0.12;
          return <span key={speed} className="w-[3px] bg-current" style={{ height: `${Math.round(level * 100)}%` }} />;
        })}
      </span>
      <DecodeText text="MUSIC" replay={passes} />
    </button>
  );
}
