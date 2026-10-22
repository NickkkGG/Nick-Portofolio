'use client';

import { useExperience } from '@/store/useExperience';
import type { ChapterId } from '@/timeline/chapters';

const LINKS: { label: string; chapter: ChapterId }[] = [
  { label: 'WORK', chapter: 'spiral' },
  { label: 'ABOUT', chapter: 'problem' },
  { label: 'CONTACT', chapter: 'contact' },
];

export function Nav() {
  const scroll = useExperience((s) => s.scroll);
  return (
    <nav data-overlay-item className="pointer-events-auto flex gap-6 text-xl tracking-widest">
      {LINKS.map(({ label, chapter }) => (
        <button
          key={label}
          type="button"
          onClick={() => scroll?.toChapter(chapter)}
          className="opacity-70 transition-opacity hover:opacity-100"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
