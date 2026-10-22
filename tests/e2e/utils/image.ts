import { PNG } from 'pngjs';

/** Share of pixels where any RGB channel differs by more than `channelThreshold` (0–255). */
export function diffRatio(a: Buffer, b: Buffer, channelThreshold: number): number {
  const imgA = PNG.sync.read(a);
  const imgB = PNG.sync.read(b);
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    throw new Error(`size mismatch: ${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}`);
  }
  const pixels = imgA.width * imgA.height;
  let differing = 0;
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    for (let c = 0; c < 3; c++) {
      if (Math.abs(imgA.data[o + c] - imgB.data[o + c]) > channelThreshold) {
        differing++;
        break;
      }
    }
  }
  return differing / pixels;
}

/** Mean Rec.709 luma of an image, 0 (black) to 1 (white). Alpha is ignored. */
export function meanLuminance(png: Buffer): number {
  const img = PNG.sync.read(png);
  const pixels = img.width * img.height;
  let sum = 0;
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    sum += (0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2]) / 255;
  }
  return sum / pixels;
}
