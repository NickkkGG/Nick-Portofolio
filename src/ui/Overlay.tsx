'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { SoundScape } from '@/audio/SoundScape';
import { Soundtrack } from '@/audio/Soundtrack';
import { useDebugMode } from '@/debug/useDebugMode';
import { useExperience } from '@/store/useExperience';
import { glassAt } from '@/timeline/transitions';
import { ChapterTexts } from './ChapterTexts';
import { Loader } from './Loader';
import { Osd } from './Osd';

// leva only ever loads in the browser, and only for ?debug.
const DebugPanel = dynamic(() => import('@/debug/DebugPanel'), { ssr: false });

/**
 * Fixed HTML layer above the canvas. It ignores the pointer; interactive children
 * opt back in with pointer-events-auto. Visible UI pieces carry data-overlay-item
 * so tests can mask them without masking the whole screen.
 */
export function Overlay() {
  const debugMode = useDebugMode();
  const root = useRef<HTMLDivElement>(null);
  // The chapter texts sit behind the same glass as the picture at chapter changes (see globals.css).
  useEffect(
    () =>
      useExperience.subscribe(
        (s) => glassAt(s.p).amount,
        (amount) => root.current?.style.setProperty('--glass', amount.toFixed(3)),
      ),
    [],
  );
  return (
    <div ref={root} data-testid="overlay" className="pointer-events-none fixed inset-0 z-10">
      <Soundtrack />
      <SoundScape />
      <ChapterTexts />
      <Osd />
      <Loader />
      {debugMode === 'full' && (
        <div className="pointer-events-auto">
          <DebugPanel />
        </div>
      )}
    </div>
  );
}
