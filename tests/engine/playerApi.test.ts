import { describe, expect, it, vi } from 'vitest';
import { fetchTrackingUrls, youtubeUrl } from '../../src/engine/playerApi';

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
      ok: true,
      text: () =>
        Promise.resolve(
          htmlWith(
            'https://s.youtube.com/api/stats/playback?docid=ID',
            'https://s.youtube.com/api/stats/watchtime?docid=ID',
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

  it('rejects a non-2xx watch page even if it contains player data (§4.5)', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(htmlWith('https://s.youtube.com/p', 'https://s.youtube.com/w', '10')),
    });
    await expect(fetchTrackingUrls('ID', fakeFetch as unknown as typeof fetch)).rejects.toThrow('500');
  });

  it('rejects tracking URLs that are not https YouTube (§4.6)', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(htmlWith('https://evil.example/p', 'https://s.youtube.com/w', '10')),
    });
    await expect(fetchTrackingUrls('ID', fakeFetch as unknown as typeof fetch)).rejects.toThrow(
      'non-YouTube',
    );
  });
});

describe('youtubeUrl', () => {
  it('accepts youtube.com and its subdomains over https', () => {
    expect(youtubeUrl('https://s.youtube.com/api/stats/playback')).toBe(
      'https://s.youtube.com/api/stats/playback',
    );
    expect(youtubeUrl('https://youtube.com/x')).toBe('https://youtube.com/x');
  });
  it('rejects other hosts, look-alikes and http', () => {
    expect(() => youtubeUrl('https://notyoutube.com/x')).toThrow();
    expect(() => youtubeUrl('https://youtube.com.evil.example/x')).toThrow();
    expect(() => youtubeUrl('http://s.youtube.com/x')).toThrow();
  });
});
