'use client';

import { useShallow } from 'zustand/react/shallow';
import { content } from '@/content';
import { channelLabel } from '@/content/schema';
import { focusedIndex } from '@/experience/chapters/spiral/helix';
import { useExperience } from '@/store/useExperience';
import { displayState } from '@/timeline/loop';
import { showKnockHint } from './knockHint';
import { revealFraction, TEXT_WINDOWS } from './reveal';
import { TypedText } from './TypedText';

const pad = (n: number) => String(n).padStart(2, '0');
const { site, projects, about, stack, contact } = content;

function RoomText({ t }: { t: number }) {
  const f = revealFraction(t, TEXT_WINDOWS.roomIntro);
  const hint = useExperience((s) => showKnockHint(s.time, s.lastActivity, s.p));
  // Blinks at 1 Hz on the store clock, like REC, so frozen screenshots stay still.
  const hintOn = useExperience((s) => Math.floor(s.time) % 2 === 0);
  return (
    <div data-overlay-item className="absolute bottom-28 left-10 font-osd">
      <p className="text-6xl tracking-wide">
        <TypedText text={site.name} fraction={f} />
      </p>
      <p className="mt-1 text-2xl tracking-widest opacity-80">
        <TypedText text={site.role} fraction={f} />
      </p>
      {hint && (
        <p data-testid="knock-hint" className={`mt-4 text-xl tracking-widest ${hintOn ? 'opacity-70' : 'opacity-30'}`}>
          ▸ knock knock
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
        <TypedText text={`${pad(index + 1)} / ${pad(projects.length)}`} fraction={f} />
      </p>
      <p className="mt-2 text-5xl">
        <TypedText text={project.title} fraction={f} />
      </p>
      {project.tags.length > 0 && (
        <p className="mt-2 text-xl opacity-80">
          <TypedText text={project.tags.join(' · ')} fraction={f} />
        </p>
      )}
      {project.status === 'no-signal' && (
        <p className="mt-3 text-xl tracking-widest text-screen">
          <TypedText text={`NO SIGNAL · ${channelLabel(index)}`} fraction={f} />
        </p>
      )}
    </div>
  );
}

function ProblemText({ t }: { t: number }) {
  const body = revealFraction(t, TEXT_WINDOWS.problemBody);
  return (
    <div data-overlay-item className="absolute bottom-24 left-1/2 w-full max-w-2xl -translate-x-1/2 px-6 text-center">
      <p className="font-osd text-4xl">
        <TypedText text={about.headline} fraction={revealFraction(t, TEXT_WINDOWS.problemHeadline)} />
      </p>
      {about.paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-3 font-body text-base leading-relaxed opacity-85">
          <TypedText text={paragraph} fraction={body} />
        </p>
      ))}
    </div>
  );
}

function StackText({ t }: { t: number }) {
  const f = revealFraction(t, TEXT_WINDOWS.stackList);
  return (
    <ul data-overlay-item className="absolute right-10 top-1/4 text-right font-osd text-2xl leading-snug">
      {stack.map((item) => (
        <li key={item.name}>
          <TypedText text={`${item.name} — ${item.category}`} fraction={f} />
        </li>
      ))}
    </ul>
  );
}

function ContactText({ t }: { t: number }) {
  const links = revealFraction(t, TEXT_WINDOWS.contactLinks);
  return (
    <div data-overlay-item className="absolute left-1/2 top-24 -translate-x-1/2 text-center font-osd">
      <p className="text-4xl">
        <TypedText text={site.tagline} fraction={revealFraction(t, TEXT_WINDOWS.contactTagline)} />
      </p>
      {/* TEMPORARY: plain links until the VHS cassettes arrive in milestone 7 */}
      <ul className="pointer-events-auto mt-4 flex justify-center gap-6 text-2xl tracking-widest">
        {contact.map((link) => (
          <li key={link.label}>
            <a href={link.href} className="opacity-80 hover:opacity-100">
              <TypedText text={link.label} fraction={links} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Typed chapter texts driven by scroll; the end of the loop already shows the room. */
export function ChapterTexts() {
  const started = useExperience((s) => s.started);
  const { chapterId, t } = useExperience(useShallow((s) => displayState(s.p)));
  if (!started) return null;
  return (
    <div data-testid="chapter-texts" className="text-osd">
      {chapterId === 'room' && <RoomText t={t} />}
      {chapterId === 'spiral' && <SpiralText t={t} />}
      {chapterId === 'problem' && <ProblemText t={t} />}
      {chapterId === 'stack' && <StackText t={t} />}
      {chapterId === 'contact' && <ContactText t={t} />}
    </div>
  );
}
