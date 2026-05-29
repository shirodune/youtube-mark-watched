import { describe, it, expect } from 'vitest';
import { extractVideoId } from '../../src/page/pageScope';

describe('extractVideoId', () => {
  it('extracts id from a relative watch href', () => {
    expect(extractVideoId('/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('extracts id from an absolute watch URL with extra params', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=abc123XYZ_-&list=PL1')).toBe('abc123XYZ_-');
  });
  it('returns null for a shorts link', () => {
    expect(extractVideoId('/shorts/dQw4w9WgXcQ')).toBeNull();
  });
  it('returns null for a non-watch path', () => {
    expect(extractVideoId('/feed/subscriptions')).toBeNull();
  });
  it('returns null for empty/garbage input', () => {
    expect(extractVideoId('')).toBeNull();
    expect(extractVideoId('not a url')).toBeNull();
  });
});
