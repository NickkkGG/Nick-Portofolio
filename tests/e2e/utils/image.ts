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

function lumaAt(data: Buffer, pixel: number): number {
  const o = pixel * 4;
  return (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
}

/** Mean Rec.709 luma of an image, 0 (black) to 1 (white). Alpha is ignored. */
export function meanLuminance(png: Buffer): number {
  const img = PNG.sync.read(png);
  const pixels = img.width * img.height;
  let sum = 0;
  for (let i = 0; i < pixels; i++) sum += lumaAt(img.data, i);
  return sum / pixels;
}

/**
 * Bounding box (as fractions of the frame) of pixels whose luma is above `threshold`,
 * or null when nothing is that bright: "how big is the lit thing on screen?".
 */
export function brightBounds(
  png: Buffer,
  threshold: number,
): { x: number; y: number; width: number; height: number } | null {
  const img = PNG.sync.read(png);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (lumaAt(img.data, y * img.width + x) <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  return {
    x: minX / img.width,
    y: minY / img.height,
    width: (maxX - minX + 1) / img.width,
    height: (maxY - minY + 1) / img.height,
  };
}

/**
 * Share of `blockSize`² blocks whose mean luma is above `threshold`. Averaging first
 * cancels per-pixel film grain, so only real image content counts. Blocks whose
 * centre falls inside `exclude` (fractions of the frame) are left out.
 */
export function litBlockRatio(
  png: Buffer,
  blockSize: number,
  threshold: number,
  exclude?: { x: number; y: number; width: number; height: number },
): number {
  const img = PNG.sync.read(png);
  let considered = 0;
  let lit = 0;
  for (let by = 0; by < img.height; by += blockSize) {
    for (let bx = 0; bx < img.width; bx += blockSize) {
      const w = Math.min(blockSize, img.width - bx);
      const h = Math.min(blockSize, img.height - by);
      const cx = (bx + w / 2) / img.width;
      const cy = (by + h / 2) / img.height;
      if (exclude && cx >= exclude.x && cx <= exclude.x + exclude.width && cy >= exclude.y && cy <= exclude.y + exclude.height) {
        continue;
      }
      let sum = 0;
      for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) sum += lumaAt(img.data, y * img.width + x);
      considered++;
      if (sum / (w * h) > threshold) lit++;
    }
  }
  return considered === 0 ? 0 : lit / considered;
}

/** Share of pixels whose luma is above `threshold` (0–1): "is anything clearly lit?". */
export function brightRatio(png: Buffer, threshold: number): number {
  const img = PNG.sync.read(png);
  const pixels = img.width * img.height;
  let bright = 0;
  for (let i = 0; i < pixels; i++) if (lumaAt(img.data, i) > threshold) bright++;
  return bright / pixels;
}

/**
 * Mean luma step between horizontally neighbouring pixels, 0 (flat) to 1: TV static is
 * all grain, a picture mostly is not.
 */
export function grain(png: Buffer): number {
  const img = PNG.sync.read(png);
  let sum = 0;
  let steps = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 1; x < img.width; x++) {
      const i = y * img.width + x;
      sum += Math.abs(lumaAt(img.data, i) - lumaAt(img.data, i - 1));
      steps++;
    }
  }
  return steps === 0 ? 0 : sum / steps;
}
