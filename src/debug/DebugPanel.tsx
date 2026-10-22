'use client';

import { button, Leva, useControls } from 'leva';
import { useExperience, VHS_BASE_DEFAULT } from '@/store/useExperience';
import { CHAPTERS } from '@/timeline/chapters';
import { chapterStartP } from '@/timeline/resolve';

const jumps = Object.fromEntries(
  CHAPTERS.map((chapter) => [
    `Jump: ${chapter.label}`,
    button(() => useExperience.getState().scroll?.jumpTo(chapterStartP(chapter.id) + 0.002)),
  ]),
);

/** leva panel for ?debug (full mode only): chapter jumps, freeze, VHS strength. */
export default function DebugPanel() {
  useControls('Debug', {
    ...jumps,
    'Freeze time': { value: false, onChange: (on: boolean) => useExperience.getState().setFrozen(on) },
    'VHS base': {
      value: VHS_BASE_DEFAULT,
      min: 0,
      max: 1,
      step: 0.01,
      onChange: (v: number) => useExperience.getState().setVhsBase(v),
    },
  });
  return <Leva collapsed={false} />;
}
