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

describe('extractPlayerResponse marker (§4.1)', () => {
  it('uses the assignment, not an earlier mention of the name', () => {
    const html =
      '<script>if (window.ytInitialPlayerResponse) { use({"wrong": true}); }</script>' +
      '<script>var ytInitialPlayerResponse = {"playbackTracking":{"videostatsPlaybackUrl":{"baseUrl":"p"},' +
      '"videostatsWatchtimeUrl":{"baseUrl":"w"}},"videoDetails":{"lengthSeconds":"5"}};</script>';
    const pr = extractPlayerResponse(html);
    expect(pr.playbackTracking.videostatsPlaybackUrl.baseUrl).toBe('p');
  });
});
