import { describe, expect, it } from 'vitest';
import { readDebugMode } from './useDebugMode';

describe('readDebugMode', () => {
  it('is off without ?debug', () => {
    expect(readDebugMode('')).toBe('off');
    expect(readDebugMode('?quiet')).toBe('off');
  });

  it('is full with ?debug and quiet with ?debug&quiet', () => {
    expect(readDebugMode('?debug')).toBe('full');
    expect(readDebugMode('?debug&quiet')).toBe('quiet');
  });
});
