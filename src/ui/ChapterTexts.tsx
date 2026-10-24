'use client';

import { useShallow } from 'zustand/react/shallow';
import { content } from '@/content';
import { channelLabel, scribbledHref } from '@/content/schema';
import { focusedIndex } from '@/experience/chapters/spiral/helix';
import { useExperience } from '@/store/useExperience';
import { displayState } from '@/timeline/loop';
import { DecodeText } from './DecodeText';
import { showKnockHint } from './knockHint';
import { revealFraction, TEXT_WINDOWS } from './reveal';

const pad = (n: number) => String(n).padStart(2, '0');
const { site, projects, about, stack, contact } = content;

function RoomText({ t }: { t: number }) {
  const f = revealFraction(t, TEXT_WINDOWS.roomIntro);
  const hint = useExperience((s) => showKnockHint(s.time, s.lastActivity, s.p));
  // Blinks at 1 Hz on the store clock, like REC, so frozen screenshots stay still.
  const hintOn = useExperience((s) => Math.floor(s.time) % 2 === 0);
  return (
    <div data-overlay-item className="absolute bottom-28 left-10 font-osd">
      {/* Right after PLAY the picture is still opening: the title waits for it as noise. */}
      <p className="text-6xl tracking-wide">
        <DecodeText text={site.greeting} fraction={f} delay={0.55} />
      </p>
      <p className="mt-1 text-2xl tracking-widest opacity-80">
        <DecodeText text={site.role} fraction={f} delay={0.75} />
      </p>
      {hint && (
        <p data-testid="knock-hint" className={`mt-4 text-xl tracking-widest ${hintOn ? 'opacity-70' : 'opacity-30'}`}>
          <DecodeText text="▸ knock knock" />
        </p>
      )}
    </div>
  );
}

function SpiralText({ t }: { t: number }) {
  const f = revealFraction(t, TEXT_WINDOWS.spiralProject);
  const index = focusedIndex(t, projects.length);
  const project = projects[index];
  return (
    <div data-overlay-item className="absolute right-10 top-1/3 max-w-sm text-right font-osd">
      <p className="text-xl tracking-widest opacity-70">
        <DecodeText text={`${pad(index + 1)} / ${pad(projects.length)}`} fraction={f} />
      </p>
      <p className="mt-2 text-5xl">
        <DecodeText text={project.title} fraction={f} />
      </p>
      {project.tags.length > 0 && (
        <p className="mt-2 text-xl opacity-80">
          <DecodeText text={project.tags.join(' · ')} fraction={f} />
        </p>
      )}
      {project.status === 'no-signal' && (
        <p className="mt-3 text-xl tracking-widest text-screen">
          <DecodeText text={`NO SIGNAL · ${channelLabel(index)}`} fraction={f} />
        </p>
      )}
    </div>
  );
}

function ProblemText({ t }: { t: number }) {
  return (
    <div data-overlay-item className="absolute bottom-24 left-1/2 w-full max-w-2xl -translate-x-1/2 px-6 text-center">
      <p className="font-osd text-4xl">
        <DecodeText text={about.motto} fraction={revealFraction(t, TEXT_WINDOWS.ideasMotto)} />
      </p>
    </div>
  );
}

function StackText({ t }: { t: number }) {
  const f = revealFraction(t, TEXT_WINDOWS.stackList);
  return (
    <ul data-overlay-item className="absolute right-10 top-1/4 text-right font-osd text-2xl leading-snug">
      {stack.map((item) => (
        <li key={item.name}>
          <DecodeText text={`${item.name} — ${item.category}`} fraction={f} />
        </li>
      ))}
    </ul>
  );
}

function ContactText({ t }: { t: number }) {
  // The links themselves are the tapes in the scene (and plain links in the content document).
  const hint = revealFraction(t, TEXT_WINDOWS.contactHint);
  // A tape's own label is too small to read from here: the one under the pointer names its address.
  const tape = useExperience((s) => s.tape);
  return (
    <div data-overlay-item className="absolute left-1/2 top-24 -translate-x-1/2 text-center font-osd">
      <p className="text-4xl">
        <DecodeText text={site.tagline} fraction={revealFraction(t, TEXT_WINDOWS.contactTagline)} />
      </p>
      <p data-testid="tape-hint" className="mt-3 text-xl tracking-widest opacity-70">
        {tape === null ? (
          <DecodeText text={`▸ pick a tape · ${contact.length} on the shelf`} fraction={hint} />
        ) : (
          <DecodeText text={`▸ ${scribbledHref(contact[tape].href)}`} />
        )}
      </p>
    </div>
  );
}

/** Chapter texts typed in by the scroll, decoding off the tape; the end of the loop already shows the room. */
export function ChapterTexts() {
  const started = useExperience((s) => s.started);
  const { chapterId, t } = useExperience(useShallow((s) => displayState(s.p)));
  if (!started) return null;
  return (
    // Full-screen: the glass veil's transform makes this box what the texts are placed in.
    <div data-testid="chapter-texts" className="glass-veil absolute inset-0 text-osd">
      {chapterId === 'room' && <RoomText t={t} />}
      {chapterId === 'spiral' && <SpiralText t={t} />}
      {chapterId === 'problem' && <ProblemText t={t} />}
      {chapterId === 'stack' && <StackText t={t} />}
      {chapterId === 'contact' && <ContactText t={t} />}
    </div>
  );
}
