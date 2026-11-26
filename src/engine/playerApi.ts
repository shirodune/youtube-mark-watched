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
  if (!res.ok) throw new Error(`watch page failed: ${res.status}`);
  const html = await res.text();
  const player = extractPlayerResponse(html);
  const pt = player.playbackTracking;
  return {
    playbackUrl: youtubeUrl(pt.videostatsPlaybackUrl.baseUrl),
    watchtimeUrl: youtubeUrl(pt.videostatsWatchtimeUrl.baseUrl),
    lengthSeconds: Number(player.videoDetails?.lengthSeconds ?? 0),
  };
}

/** Only ever send tracking pings to YouTube over HTTPS (SPEC §4.6, §6). */
export function youtubeUrl(raw: string): string {
  const url = new URL(raw);
  const host = url.hostname;
  if (url.protocol !== 'https:' || !(host === 'youtube.com' || host.endsWith('.youtube.com'))) {
    throw new Error(`refusing non-YouTube tracking URL: ${host}`);
  }
  return raw;
}
