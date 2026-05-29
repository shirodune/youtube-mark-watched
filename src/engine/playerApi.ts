// src/engine/playerApi.ts
import { extractPlayerResponse } from './playerResponse';

export interface TrackingUrls {
  playbackUrl: string;
  watchtimeUrl: string;
  lengthSeconds: number;
}

export async function fetchTrackingUrls(
  videoId: string,
  // Wrap global fetch (see pingEngine) so a detached native fetch is never called directly.
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<TrackingUrls> {
  const res = await fetchImpl(`https://www.youtube.com/watch?v=${videoId}`, { credentials: 'include' });
  const html = await res.text();
  const player = extractPlayerResponse(html);
  const pt = player.playbackTracking;
  return {
    playbackUrl: pt.videostatsPlaybackUrl.baseUrl,
    watchtimeUrl: pt.videostatsWatchtimeUrl.baseUrl,
    lengthSeconds: Number(player.videoDetails?.lengthSeconds ?? 0),
  };
}
