import { describe, expect, it } from 'vitest';
import { isSfx, Spacer } from './sfx';

describe('spacing the sounds', () => {
  it('ticks closer together than their spacing are dropped, so a line of text chatters instead of buzzing', () => {
    const spacer = new Spacer();
    expect(spacer.allow('tick', 1)).toBe(true);
    expect(spacer.allow('tick', 1.01)).toBe(false);
    expect(spacer.allow('tick', 1.04)).toBe(true);
  });

  it('a floor scrolled back and forth over breaks once a moment, not on every crossing', () => {
    const spacer = new Spacer();
    expect(spacer.allow('floor-break', 0)).toBe(true);
    expect(spacer.allow('floor-break', 0.5)).toBe(false);
    expect(spacer.allow('floor-break', 2)).toBe(true);
  });

  it('each sound keeps its own spacing', () => {
    const spacer = new Spacer();
    expect(spacer.allow('tick', 1)).toBe(true);
    expect(spacer.allow('drip', 1)).toBe(true);
    expect(spacer.allow('channel', 1)).toBe(true);
  });
});

describe('the voices', () => {
  it('every sound the story logs has a voice, except the knock, which plays in the room itself', () => {
    for (const name of ['power-on', 'floor-break', 'dust', 'landing', 'channel', 'seam', 'bulb', 'tiles', 'tapes', 'tune']) expect(isSfx(name), name).toBe(true);
    expect(isSfx('knock')).toBe(false);
    expect(isSfx('toString')).toBe(false);
  });
});
