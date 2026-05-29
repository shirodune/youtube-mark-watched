// src/engine/pingEngine.ts
import { generateCpn } from './cpn';
import { fetchTrackingUrls } from './playerApi';
import { buildPlaybackPingUrl, buildWatchtimePingUrl, watchtimeSegments } from './pingUrl';
import type { MarkResult } from './types';

export interface PingEngineDeps {
  fetch: typeof fetch;
}

export async function markWatchedViaPings(
  videoId: string,
  deps: PingEngineDeps = { fetch },
): Promise<MarkResult> {
  try {
    const { playbackUrl, watchtimeUrl, lengthSeconds } = await fetchTrackingUrls(videoId, deps.fetch);
    const cpn = generateCpn();
    const duration = lengthSeconds > 0 ? lengthSeconds : 1;

    // 1) Session init (playback ping, cmt=0).
    const playbackRes = await deps.fetch(buildPlaybackPingUrl(playbackUrl, cpn), { credentials: 'include' });
    if (!playbackRes.ok) return { ok: false, error: `playback ping failed: ${playbackRes.status}` };

    // 2) Progressive watchtime pings over 0..duration; the final ping commits the watched position.
    const segments = watchtimeSegments(duration);
    for (const [i, [st, et]] of segments.entries()) {
      const final = i === segments.length - 1;
      const res = await deps.fetch(buildWatchtimePingUrl(watchtimeUrl, cpn, st, et, { final }), { credentials: 'include' });
      if (!res.ok) return { ok: false, error: `watchtime ping failed: ${res.status}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
