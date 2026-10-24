import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '@/timeline/chapters';
import { chapterP } from '@/timeline/resolve';
import { type Atmosphere, ATMOSPHERES, atmosphereAt, hexToRgb } from './atmosphere';

const flat = (a: Atmosphere) => [...a.top, ...a.horizon, ...a.bottom, ...a.fog, a.fogDensity, a.exposure];

describe('atmosphere', () => {
  it('hexToRgb reads sRGB hex into 0..1 channels', () => {
    const [r, g, b] = hexToRgb('#ff8000');
    expect(r).toBe(1);
    expect(g).toBeCloseTo(128 / 255);
    expect(b).toBe(0);
  });

  it('the middle of every chapter uses that chapter preset', () => {
    for (const chapter of CHAPTERS) {
      const mid = (chapter.start + chapter.end) / 2;
      const expected = chapter.id === 'loop' ? ATMOSPHERES.room : ATMOSPHERES[chapter.id];
      expect(atmosphereAt(mid), chapter.id).toEqual(expected);
    }
  });

  it('the loop starts in darkness and arrives in the room atmosphere', () => {
    expect(atmosphereAt(chapterP('loop', 0.1))).toEqual(ATMOSPHERES.loop);
    expect(atmosphereAt(0.9999)).toEqual(atmosphereAt(0));
  });

  it('changes smoothly across every chapter boundary', () => {
    for (const { start } of CHAPTERS) {
      const before = flat(atmosphereAt(start - 1e-6));
      const after = flat(atmosphereAt(start + 1e-6));
      before.forEach((value, i) => expect(Math.abs(value - after[i]), `boundary ${start} #${i}`).toBeLessThan(1e-3));
    }
  });

  it('exposure stays positive everywhere', () => {
    for (let i = 0; i < 1000; i++) expect(atmosphereAt(i / 1000).exposure).toBeGreaterThan(0);
  });
});
