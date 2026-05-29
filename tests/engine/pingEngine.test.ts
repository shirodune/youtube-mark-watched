// tests/engine/pingEngine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { markWatchedViaPings } from '../../src/engine/pingEngine';

function watchPageHtml(len = '100'): string {
  return 'x var ytInitialPlayerResponse = ' + JSON.stringify({
    playbackTracking: {
      videostatsPlaybackUrl: { baseUrl: 'https://www.youtube.com/api/stats/playback?docid=ID&ei=E' },
      videostatsWatchtimeUrl: { baseUrl: 'https://www.youtube.com/api/stats/watchtime?docid=ID&ei=E' },
    },
    videoDetails: { lengthSeconds: len },
  }) + '; y';
}

describe('markWatchedViaPings', () => {
  it('fetches the page, fires playback first, then progressive watchtime segments ending with final=1', async () => {
    const calls: string[] = [];
    const fakeFetch = vi.fn((url: string) => {
      calls.push(url);
      if (url.includes('/watch?v=')) return Promise.resolve({ ok: true, text: () => Promise.resolve(watchPageHtml('100')) });
      return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') });
    });
    const res = await markWatchedViaPings('ID', { fetch: fakeFetch as unknown as typeof fetch });
    expect(res.ok).toBe(true);

    const pbIdx = calls.findIndex((u) => u.includes('/api/stats/playback'));
    const firstWtIdx = calls.findIndex((u) => u.includes('/api/stats/watchtime'));
    const wtCalls = calls.filter((u) => u.includes('/api/stats/watchtime'));
    expect(pbIdx).toBeGreaterThan(-1);
    expect(firstWtIdx).toBeGreaterThan(pbIdx); // ordering: playback before watchtime
    expect(wtCalls.length).toBeGreaterThanOrEqual(2); // progressive segments
    expect(calls[pbIdx]).toContain('cpn=');

    const last = wtCalls[wtCalls.length - 1]!;
    expect(last).toContain('final=1');
    expect(new URL(last).searchParams.get('et')).toBe('100'); // last segment ends at duration
  });

  it('returns ok:false when the playback ping is not ok', async () => {
    const fakeFetch = vi.fn((url: string) => {
      if (url.includes('/watch?v=')) return Promise.resolve({ ok: true, text: () => Promise.resolve(watchPageHtml()) });
      if (url.includes('/api/stats/playback')) return Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') });
    });
    const res = await markWatchedViaPings('ID', { fetch: fakeFetch as unknown as typeof fetch });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('403');
  });

  it('returns ok:false on a thrown error', async () => {
    const fakeFetch = vi.fn(() => Promise.reject(new Error('network down')));
    const res = await markWatchedViaPings('ID', { fetch: fakeFetch as unknown as typeof fetch });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('network down');
  });
});
