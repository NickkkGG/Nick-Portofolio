import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Slide } from '@/content/schema';
import { mulberry32 } from '@/lib/random';

/** A slide's pixels: 3:2, like the film. */
export const SLIDE_PIXELS = { width: 1024, height: 683 } as const;

/** Title slides as they were made for talks: deep teal film, warm cream letters. */
const INK = '255, 231, 191';
const FILM_TOP = '#0f3b46';
const FILM_BOTTOM = '#061d26';
/** The empty slot after the last slide: the lamp's own light through the bare gate. */
const BARE_GATE = '#fff3df';
const MARGIN = 64;

type Measure = (text: string) => number;

/** `text` broken into lines no wider than `maxWidth`, between words only. */
export function wrapLines(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Fonts {
  title: string;
  body: string;
}

/** The page's fonts by family name (next/font hashes them), so the slides match the site. */
function fonts(): Fonts {
  const style = getComputedStyle(document.documentElement);
  return {
    title: style.getPropertyValue('--font-vt323').trim() || 'monospace',
    body: style.getPropertyValue('--font-plex').trim() || 'monospace',
  };
}

/** The film itself: the dye a little thinner behind the words, and grain that is the same on every showing. */
function film(ctx: CanvasRenderingContext2D, seed: number) {
  const { width, height } = SLIDE_PIXELS;
  const dye = ctx.createLinearGradient(0, 0, 0, height);
  dye.addColorStop(0, FILM_TOP);
  dye.addColorStop(1, FILM_BOTTOM);
  ctx.fillStyle = dye;
  ctx.fillRect(0, 0, width, height);
  const thin = ctx.createRadialGradient(width * 0.36, height * 0.46, 0, width * 0.36, height * 0.46, width * 0.72);
  thin.addColorStop(0, 'rgba(70, 150, 155, 0.24)');
  thin.addColorStop(1, 'rgba(70, 150, 155, 0)');
  ctx.fillStyle = thin;
  ctx.fillRect(0, 0, width, height);
  grain(ctx, seed, 0.035, 0.05);
}

function grain(ctx: CanvasRenderingContext2D, seed: number, light: number, dark: number) {
  const { width, height } = SLIDE_PIXELS;
  const rand = mulberry32(seed);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rand() < 0.5 ? `rgba(255, 255, 255, ${light})` : `rgba(0, 0, 0, ${dark})`;
    ctx.fillRect(rand() * width, rand() * height, 1.5, 1.5);
  }
}

/** The slide's place in the talk, small along the top, with a rule under it. */
function header(ctx: CanvasRenderingContext2D, family: string, index: number, count: number) {
  const { width } = SLIDE_PIXELS;
  ctx.font = `38px ${family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = `rgba(${INK}, 0.6)`;
  ctx.textAlign = 'left';
  ctx.fillText('ABOUT ME', MARGIN, 82);
  ctx.textAlign = 'right';
  const number = (n: number) => String(n).padStart(2, '0');
  ctx.fillText(`${number(index + 1)} / ${number(count)}`, width - MARGIN, 82);
  ctx.textAlign = 'left';
  ctx.fillStyle = `rgba(${INK}, 0.32)`;
  ctx.fillRect(MARGIN, 100, width - 2 * MARGIN, 2);
}

/** `text` in `family`, from `size` down to `smallest`, until it fits `width` in `maxLines` lines. */
function fit(ctx: CanvasRenderingContext2D, text: string, family: string, size: number, smallest: number, width: number, maxLines: number) {
  for (let s = size; ; s -= 4) {
    ctx.font = `${s}px ${family}`;
    const lines = wrapLines(text, width, (line) => ctx.measureText(line).width);
    if (lines.length <= maxLines || s - 4 < smallest) return { lines, size: s };
  }
}

/** The title, then the body under it, in a column `width` wide from `x`. */
function words(ctx: CanvasRenderingContext2D, slide: Slide, families: Fonts, x: number, width: number, top: number, titleSize: number, bodySize: number) {
  // One line if it fits without shrinking much, two otherwise: the body keeps clear of the bottom.
  let title = fit(ctx, slide.title, families.title, titleSize, titleSize * 0.72, width, 1);
  if (title.lines.length > 1) title = fit(ctx, slide.title, families.title, titleSize, 56, width, 2);
  ctx.fillStyle = `rgb(${INK})`;
  let y = top + title.size * 0.8;
  for (const line of title.lines) {
    ctx.font = `${title.size}px ${families.title}`;
    ctx.fillText(line, x, y);
    y += title.size * 0.92;
  }
  const body = fit(ctx, slide.body, families.body, bodySize, 22, width, 6);
  ctx.font = `${body.size}px ${families.body}`;
  ctx.fillStyle = `rgba(${INK}, 0.86)`;
  y += body.size * 0.9;
  for (const line of body.lines) {
    ctx.fillText(line, x, y);
    y += body.size * 1.45;
  }
}

/** A square print of the portrait with its cream border, as if mounted on the slide. */
function print(ctx: CanvasRenderingContext2D, image: CanvasImageSource & { width: number; height: number }, x: number, y: number, size: number) {
  const border = 12;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(x + 8, y + 10, size, size);
  ctx.fillStyle = '#efe5d2';
  ctx.fillRect(x, y, size, size);
  const side = Math.min(image.width, image.height);
  ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, x + border, y + border, size - 2 * border, size - 2 * border);
}

/** How much light the slide lets through, 0..1 (linear), from a tiny copy of it. */
function lightThrough(canvas: HTMLCanvasElement): number {
  const tiny = document.createElement('canvas');
  tiny.width = 12;
  tiny.height = 8;
  const ctx = tiny.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0.2;
  ctx.drawImage(canvas, 0, 0, tiny.width, tiny.height);
  const { data } = ctx.getImageData(0, 0, tiny.width, tiny.height);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const luma = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    sum += luma ** 2.2;
  }
  return sum / (data.length / 4);
}

/**
 * The booth's slides, painted once each: one canvas per slide and one for the bare gate
 * after them. The sheet shows them through one texture whose picture is swapped as the
 * carousel turns.
 */
export class SlideReel {
  readonly texture: CanvasTexture;
  private readonly frames: HTMLCanvasElement[];
  private readonly light: number[];
  private shown = -1;

  constructor(
    private readonly slides: readonly Slide[],
    private readonly portrait: (CanvasImageSource & { width: number; height: number }) | null,
  ) {
    this.frames = Array.from({ length: slides.length + 1 }, () => {
      const canvas = document.createElement('canvas');
      canvas.width = SLIDE_PIXELS.width;
      canvas.height = SLIDE_PIXELS.height;
      return canvas;
    });
    this.light = this.frames.map(() => 0);
    this.texture = new CanvasTexture(this.frames[slides.length]);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.paint();
  }

  /** Paints every frame; again once the page's fonts have loaded. */
  paint() {
    const families = fonts();
    const count = this.slides.length;
    this.frames.forEach((canvas, index) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (index === count) {
        ctx.fillStyle = BARE_GATE;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        grain(ctx, 900, 0.02, 0.04);
      } else {
        film(ctx, 700 + index);
        header(ctx, families.title, index, count);
        if (index === 0 && this.portrait) {
          const size = 400;
          print(ctx, this.portrait, MARGIN, 140, size);
          const x = MARGIN + size + 48;
          words(ctx, this.slides[index], families, x, SLIDE_PIXELS.width - MARGIN - x, 150, 104, 34);
        } else {
          words(ctx, this.slides[index], families, MARGIN, SLIDE_PIXELS.width - 2 * MARGIN, 150, 128, 42);
        }
      }
      this.light[index] = lightThrough(canvas);
    });
    this.texture.needsUpdate = true;
  }

  /**
   * Puts slide `index` in the gate (-1 or `count` for the bare gate) and says how much light
   * it lets through, 0..1.
   */
  show(index: number): number {
    const frame = index < 0 || index >= this.slides.length ? this.slides.length : index;
    if (frame !== this.shown) {
      this.shown = frame;
      this.texture.image = this.frames[frame];
      this.texture.needsUpdate = true;
    }
    return this.light[frame];
  }

  dispose() {
    this.texture.dispose();
  }
}
