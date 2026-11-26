import { describe, expect, it, vi } from 'vitest';
import { fetchTrackingUrls } from '../../src/engine/playerApi';

function htmlWith(pb: string, wt: string, len: string): string {
  return (
    'x var ytInitialPlayerResponse = ' +
    JSON.stringify({
      playbackTracking: {
        videostatsPlaybackUrl: { baseUrl: pb },
        videostatsWatchtimeUrl: { baseUrl: wt },
      },
      videoDetails: { lengthSeconds: len },
    }) +
    '; y'
  );
}

describe('fetchTrackingUrls', () => {
  it('fetches the watch page and returns tracking URLs + duration', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      text: () =>
        Promise.resolve(
          htmlWith(
            'https://yt/api/stats/playback?docid=ID',
            'https://yt/api/stats/watchtime?docid=ID',
            '212',
          ),
        ),
    });
    const out = await fetchTrackingUrls('ID', fakeFetch as unknown as typeof fetch);
    expect(fakeFetch).toHaveBeenCalledWith('https://www.youtube.com/watch?v=ID', { credentials: 'include' });
    expect(out.playbackUrl).toContain('/api/stats/playback');
    expect(out.watchtimeUrl).toContain('/api/stats/watchtime');
    expect(out.lengthSeconds).toBe(212);
  });
});
