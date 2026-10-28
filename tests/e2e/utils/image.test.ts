import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { brightBounds, brightRatio, diffRatio, grain, litBlockRatio, meanLuminance } from './image';

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

  it('grain is the mean luma step between horizontal neighbours: 0 when flat, 1 for black and white stripes', () => {
    expect(grain(png([[90, 90, 90, 255], [90, 90, 90, 255], [90, 90, 90, 255]]))).toBe(0);
    expect(grain(png([[0, 0, 0, 255], [255, 255, 255, 255], [0, 0, 0, 255]]))).toBeCloseTo(1);
    expect(grain(png([[0, 0, 0, 255], [0, 0, 0, 255], [255, 255, 255, 255]]))).toBeCloseTo(0.5);
  });

  it('brightRatio counts pixels brighter than the luma threshold', () => {
    const img = png([[255, 255, 255, 255], [5, 6, 7, 255], [0, 0, 0, 255], [120, 120, 120, 255]]);
    expect(brightRatio(img, 0.15)).toBe(0.5);
    expect(brightRatio(img, 0.9)).toBe(0.25);
  });

  it('brightBounds returns the box of pixels brighter than the threshold as fractions of the frame', () => {
    const img = PNG.sync.write(
      Object.assign(new PNG({ width: 4, height: 2 }), {
        data: Buffer.from([
          ...[0, 0, 0, 255], ...[255, 255, 255, 255], ...[255, 255, 255, 255], ...[0, 0, 0, 255],
          ...[0, 0, 0, 255], ...[0, 0, 0, 255], ...[255, 255, 255, 255], ...[0, 0, 0, 255],
        ]),
      }),
    );
    expect(brightBounds(img, 0.5)).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(brightBounds(PNG.sync.write(new PNG({ width: 2, height: 2 })), 0.5)).toBeNull();
  });

  it('litBlockRatio averages blocks before thresholding, so per-pixel grain does not count as content', () => {
    const img = new PNG({ width: 4, height: 2 });
    // Left 2×2 block: noisy black (two grain pixels). Right 2×2 block: evenly grey.
    const px = [
      [0, 0, 0], [60, 60, 60], [128, 128, 128], [128, 128, 128],
      [60, 60, 60], [0, 0, 0], [128, 128, 128], [128, 128, 128],
    ];
    px.forEach(([r, g, b], i) => img.data.set([r, g, b, 255], i * 4));
    const buf = PNG.sync.write(img);
    expect(litBlockRatio(buf, 2, 0.2)).toBe(0.5);
    expect(litBlockRatio(buf, 2, 0.2, { x: 0.5, y: 0, width: 0.5, height: 1 })).toBe(0);
  });

  it('meanLuminance is 1 for white and 0 for black', () => {
    expect(meanLuminance(png([[255, 255, 255, 255]]))).toBeCloseTo(1);
    expect(meanLuminance(png([[0, 0, 0, 255]]))).toBe(0);
  });
});
