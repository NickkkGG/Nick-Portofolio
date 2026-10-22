import { describe, expect, it } from 'vitest';
import { formatTimecode } from './timecode';

describe('formatTimecode', () => {
  it('maps one loop onto 00:13:37 of tape', () => {
    expect(formatTimecode(0)).toBe('00:00:00');
    expect(formatTimecode(0.25)).toBe('00:03:24');
    expect(formatTimecode(0.5)).toBe('00:06:48');
    expect(formatTimecode(0.9999)).toBe('00:13:36');
  });

  it('wraps like a rewound tape', () => {
    expect(formatTimecode(1)).toBe('00:00:00');
    expect(formatTimecode(-0.5)).toBe('00:06:48');
  });
});
