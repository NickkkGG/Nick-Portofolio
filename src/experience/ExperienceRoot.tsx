'use client';

import dynamic from 'next/dynamic';

// The WebGL scene only exists in the browser; the page text is server-rendered (spec §4.3).
const Experience = dynamic(() => import('./Experience'), { ssr: false });

export function ExperienceRoot() {
  return (
    <div data-testid="experience" className="fixed inset-0 z-0">
      <Experience />
    </div>
  );
}
