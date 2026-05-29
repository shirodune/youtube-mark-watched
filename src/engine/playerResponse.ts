// src/engine/playerResponse.ts

/** Extract the first balanced `{...}` object that appears after `marker`. */
export function extractJsonObject(text: string, marker: string): string {
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) throw new Error(`marker not found: ${marker}`);
  const start = text.indexOf('{', markerIdx);
  if (start === -1) throw new Error(`no object after marker: ${marker}`);

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced object');
}

export interface PlayerResponse {
  playbackTracking: {
    videostatsPlaybackUrl: { baseUrl: string };
    videostatsWatchtimeUrl: { baseUrl: string };
  };
  videoDetails: { lengthSeconds?: string };
}

export function extractPlayerResponse(html: string): PlayerResponse {
  return JSON.parse(extractJsonObject(html, 'ytInitialPlayerResponse')) as PlayerResponse;
}
