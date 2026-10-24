'use client';

import { useState } from 'react';
import { playSfx } from '@/audio/sfx';
import { useExperience } from '@/store/useExperience';
import type { ChapterId } from '@/timeline/chapters';
import { DecodeText } from './DecodeText';

const LINKS: { label: string; chapter: ChapterId }[] = [
  { label: 'WORK', chapter: 'spiral' },
  { label: 'ABOUT', chapter: 'problem' },
  { label: 'CONTACT', chapter: 'contact' },
];

/** A nav button: under the pointer (or focus) its label runs through the tape noise again, with a blip. */
function NavButton({ label, chapter }: { label: string; chapter: ChapterId }) {
  const scroll = useExperience((s) => s.scroll);
  const [passes, setPasses] = useState(0);
  const notice = () => {
    setPasses((n) => n + 1);
    playSfx('hover');
  };
  return (
    <button
      type="button"
      onPointerEnter={notice}
      onFocus={notice}
      onClick={() => scroll?.toChapter(chapter)}
      className="opacity-70 transition-opacity hover:opacity-100"
    >
      <DecodeText text={label} replay={passes} />
    </button>
  );
}

export function Nav() {
  return (
    <nav data-overlay-item className="pointer-events-auto flex gap-6 text-xl tracking-widest">
      {LINKS.map(({ label, chapter }) => (
        <NavButton key={label} label={label} chapter={chapter} />
      ))}
    </nav>
  );
}
