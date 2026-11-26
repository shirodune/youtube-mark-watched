import { describe, expect, it } from 'vitest';
import { extractVideoId, isActiveSurface } from '../../src/page/pageScope';

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

describe('isActiveSurface', () => {
  it('is active on home', () => expect(isActiveSurface('/')).toBe(true));
  it('is active on subscriptions', () => expect(isActiveSurface('/feed/subscriptions')).toBe(true));
  it('is active on a watch page (sidebar)', () => expect(isActiveSurface('/watch')).toBe(true));
  it('is active on handle channel pages', () => {
    expect(isActiveSurface('/@SomeChannel')).toBe(true);
    expect(isActiveSurface('/@SomeChannel/videos')).toBe(true);
  });
  it('is active on legacy channel paths', () => {
    expect(isActiveSurface('/channel/UC123')).toBe(true);
    expect(isActiveSurface('/c/SomeChannel')).toBe(true);
    expect(isActiveSurface('/user/SomeUser')).toBe(true);
  });
  it('is INACTIVE on search results', () => expect(isActiveSurface('/results')).toBe(false));
  it('is active on playlists, incl. Watch Later', () => expect(isActiveSurface('/playlist')).toBe(true));
  it('is active on history', () => expect(isActiveSurface('/feed/history')).toBe(true));
  it('is active on the You page', () => expect(isActiveSurface('/feed/you')).toBe(true));
  it('is INACTIVE on other feeds', () => {
    expect(isActiveSurface('/feed/trending')).toBe(false);
    expect(isActiveSurface('/feed/playlists')).toBe(false);
  });
});
