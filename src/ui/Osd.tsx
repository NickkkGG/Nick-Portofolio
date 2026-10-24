'use client';

import { content } from '@/content';
import { slideNumber } from '@/experience/chapters/booth/slides';
import { useExperience } from '@/store/useExperience';
import { getChapter } from '@/timeline/chapters';
import { displayState } from '@/timeline/loop';
import { DecodeText } from './DecodeText';
import { MusicToggle } from './MusicToggle';
import { Nav } from './Nav';
import { formatTimecode } from './timecode';

const SLIDES = content.about.slides.length;
const pad = (n: number) => String(n).padStart(2, '0');

/** Camcorder on-screen display (spec §3.12). */
export function Osd() {
  const started = useExperience((s) => s.started);
  // Blink at 1 Hz on the store clock, so frozen screenshots stay deterministic.
  const recOn = useExperience((s) => Math.floor(s.time * 2) % 2 === 0);
  const timecode = useExperience((s) => formatTimecode(s.p));
  const chapter = useExperience((s) => {
    const c = getChapter(displayState(s.p).chapterId);
    return `${c.code} / ${c.label}`;
  });
  const loopIndex = useExperience((s) => s.loopIndex);
  // In the booth, which slide is on the sheet, like a carousel's counter.
  const slide = useExperience((s) => slideNumber(s.p, SLIDES));
  if (!started) return null;

  return (
    <div className="font-osd text-osd">
      <div data-overlay-item className="absolute left-6 top-5 flex items-center gap-4 text-2xl tracking-widest">
        <span data-testid="osd-rec">
          <span className={recOn ? 'text-alarm' : 'text-transparent'}>●</span> REC
        </span>
        <span data-testid="osd-name" className="opacity-80">
          {content.site.name}
        </span>
      </div>
      <div className="absolute right-6 top-5 flex items-center gap-8">
        <Nav />
        <MusicToggle />
      </div>
      <div data-overlay-item data-testid="timecode" className="absolute bottom-5 left-6 text-2xl tracking-widest">
        {timecode}
      </div>
      <div data-overlay-item className="absolute bottom-5 right-6 flex flex-col items-end text-2xl tracking-widest">
        {loopIndex > 1 && (
          <span data-testid="osd-loop">
            <DecodeText text={`LOOP ${String(loopIndex).padStart(2, '0')}`} />
          </span>
        )}
        {slide !== null && (
          <span data-testid="slide-counter">
            <DecodeText text={`SLIDE ${pad(slide)} / ${pad(SLIDES)}`} />
          </span>
        )}
        <span data-testid="osd-chapter">
          <DecodeText text={chapter} />
        </span>
      </div>
    </div>
  );
}
