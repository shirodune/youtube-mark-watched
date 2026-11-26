import { describe, expect, it } from 'vitest';
import { extractJsonObject, extractPlayerResponse } from '../../src/engine/playerResponse';

describe('extractJsonObject', () => {
  it('extracts a balanced object after a marker, ignoring braces in strings', () => {
    const text = 'foo var ytInitialPlayerResponse = {"a":1,"b":{"c":"}{"}}; more';
    const obj = JSON.parse(extractJsonObject(text, 'ytInitialPlayerResponse'));
    expect(obj).toEqual({ a: 1, b: { c: '}{' } });
  });
  it('throws when the marker is absent', () => {
    expect(() => extractJsonObject('nothing here', 'ytInitialPlayerResponse')).toThrow();
  });
});

describe('extractPlayerResponse', () => {
  it('parses playbackTracking and lengthSeconds from page HTML', () => {
    const html =
      '<script>var ytInitialPlayerResponse = ' +
      JSON.stringify({
        playbackTracking: {
          videostatsPlaybackUrl: { baseUrl: 'https://www.youtube.com/api/stats/playback?docid=ID' },
          videostatsWatchtimeUrl: { baseUrl: 'https://www.youtube.com/api/stats/watchtime?docid=ID' },
        },
        videoDetails: { lengthSeconds: '212' },
      }) +
      ';</script>';
    const pr = extractPlayerResponse(html);
    expect(pr.playbackTracking.videostatsPlaybackUrl.baseUrl).toContain('/api/stats/playback');
    expect(pr.videoDetails.lengthSeconds).toBe('212');
  });
});
