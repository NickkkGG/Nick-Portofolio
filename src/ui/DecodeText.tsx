'use client';

import { useLayoutEffect, useRef } from 'react';
import { playSfx } from '@/audio/sfx';
import { useExperience } from '@/store/useExperience';
import { birthTimes, decodeChar, isBlank, SETTLE, textSeed } from './decode';
import { typedCount } from './reveal';

interface DecodeTextProps {
  text: string;
  /** How much of it is typed in (reveal.ts); all of it by default. */
  fraction?: number;
  /** Seconds what shows at first waits as noise (the room's title waits for the picture to open). */
  delay?: number;
  /** Changing it decodes the whole text again (a button under the pointer). */
  replay?: number;
}

/**
 * Text coming in off the tape (decode.ts): each character arrives as tape noise and settles
 * into itself, ticking as it lands. The words are in the page all along, for reading, finding
 * and tests; the noise is drawn over them from data-glyph (globals.css). Typed in and out by
 * `fraction`, with a block cursor while it types. A frozen clock (screenshots) shows the words.
 */
export function DecodeText({ text, fraction = 1, delay = 0, replay = 0 }: DecodeTextProps) {
  const shown = typedCount(text.length, fraction);
  const root = useRef<HTMLSpanElement>(null);
  const born = useRef<{ key: string; times: (number | undefined)[] } | null>(null);

  // Before paint, so a new character never flashes up as itself before its noise.
  useLayoutEffect(() => {
    const { time, frozen } = useExperience.getState();
    const key = `${replay}:${text}`;
    const first = born.current === null;
    const times = birthTimes(born.current?.key === key ? born.current.times : [], shown, text.length, first ? time + delay : time);
    born.current = { key, times };
    const el = root.current;
    if (!el) return;
    const chars = Array.from(el.querySelectorAll<HTMLElement>('[data-i]'));
    if (frozen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const char of chars) delete char.dataset.glyph;
      return;
    }
    const box = el.getBoundingClientRect();
    const pan = 0.6 * Math.max(-1, Math.min(1, ((box.left + box.width / 2) / window.innerWidth) * 2 - 1));
    const seed = textSeed(text);
    let heardUntil = time;
    let frame = 0;
    const paint = () => {
      const { time: now, frozen: still } = useExperience.getState();
      // Frozen mid-decode: show the words, not noise stuck forever.
      if (still) {
        for (const char of chars) delete char.dataset.glyph;
        return;
      }
      let noisy = false;
      let landed = false;
      for (const char of chars) {
        const i = Number(char.dataset.i);
        const at = times[i];
        if (at === undefined) continue;
        const shows = decodeChar(text[i], now - at, i, now, seed);
        if (shows.settled) delete char.dataset.glyph;
        else {
          char.dataset.glyph = shows.char;
          noisy = true;
        }
        if (!isBlank(text[i]) && at + SETTLE > heardUntil && at + SETTLE <= now) landed = true;
      }
      if (landed) playSfx('tick', { pan });
      heardUntil = now;
      if (noisy) frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, [text, shown, delay, replay]);

  if (shown === 0) return null;
  return (
    <span ref={root}>
      {text
        .slice(0, shown)
        .split('')
        .map((char, i) => (
          <span key={i} data-i={i} className="decode-char">
            {char}
          </span>
        ))}
      {shown < text.length && <span aria-hidden>█</span>}
    </span>
  );
}
