import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { brightRatio, diffRatio, meanLuminance } from './image';

function png(pixels: [number, number, number, number][]): Buffer {
  const img = new PNG({ width: pixels.length, height: 1 });
  pixels.forEach((px, i) => img.data.set(px, i * 4));
  return PNG.sync.write(img);
}

describe('image utils', () => {
  it('diffRatio is 0 for identical images', () => {
    const a = png([[1, 2, 3, 255], [4, 5, 6, 255]]);
    expect(diffRatio(a, a, 8)).toBe(0);
  });

  it('diffRatio counts pixels where any channel differs by more than the threshold', () => {
    const a = png([[0, 0, 0, 255], [10, 10, 10, 255]]);
    const b = png([[0, 0, 9, 255], [10, 10, 10, 255]]);
    expect(diffRatio(a, b, 8)).toBe(0.5);
    expect(diffRatio(a, b, 9)).toBe(0);
  });

  it('diffRatio throws when sizes differ', () => {
    expect(() => diffRatio(png([[0, 0, 0, 255]]), png([[0, 0, 0, 255], [0, 0, 0, 255]]), 8)).toThrow();
  });

  it('brightRatio counts pixels brighter than the luma threshold', () => {
    const img = png([[255, 255, 255, 255], [5, 6, 7, 255], [0, 0, 0, 255], [120, 120, 120, 255]]);
    expect(brightRatio(img, 0.15)).toBe(0.5);
    expect(brightRatio(img, 0.9)).toBe(0.25);
  });

  it('meanLuminance is 1 for white and 0 for black', () => {
    expect(meanLuminance(png([[255, 255, 255, 255]]))).toBeCloseTo(1);
    expect(meanLuminance(png([[0, 0, 0, 255]]))).toBe(0);
  });
});
