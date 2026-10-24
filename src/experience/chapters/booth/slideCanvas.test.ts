import { describe, expect, it } from 'vitest';
import { wrapLines } from './slideCanvas';

/** Every character 10 px wide, spaces too. */
const measure = (text: string) => text.length * 10;

describe('wrapping a slide line', () => {
  it('keeps a line that fits whole', () => {
    expect(wrapLines('Hi there.', 200, measure)).toEqual(['Hi there.']);
  });

  it('breaks between words, never inside one', () => {
    expect(wrapLines('one two three four', 100, measure)).toEqual(['one two', 'three four']);
  });

  it('puts a word longer than the line on a line of its own', () => {
    expect(wrapLines('a extraordinarily b', 100, measure)).toEqual(['a', 'extraordinarily', 'b']);
  });

  it('collapses runs of spaces', () => {
    expect(wrapLines('  wide   gaps  ', 200, measure)).toEqual(['wide gaps']);
  });
});
