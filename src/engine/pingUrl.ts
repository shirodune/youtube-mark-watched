// src/engine/pingUrl.ts

export function appendParams(baseUrl: string, params: Record<string, string | number>): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function buildPlaybackPingUrl(baseUrl: string, cpn: string): string {
  return appendParams(baseUrl, { ver: 2, cpn, cmt: 0 });
}

/** Contiguous [start, end] segments covering 0..duration (defaults to 4 segments). */
export function watchtimeSegments(durationSeconds: number, segmentCount = 4): Array<[number, number]> {
  const dur = Math.max(1, Math.floor(durationSeconds));
  const seg = Math.max(1, Math.round(dur / segmentCount));
  const steps: Array<[number, number]> = [];
  let prev = 0;
  for (let p = seg; p < dur; p += seg) {
    steps.push([prev, p]);
    prev = p;
  }
  steps.push([prev, dur]);
  return steps;
}

export function buildWatchtimePingUrl(
  baseUrl: string,
  cpn: string,
  st: number,
  et: number,
  opts: { final?: boolean } = {},
): string {
  const params: Record<string, string | number> = {
    ver: 2,
    cpn,
    cmt: et,
    st,
    et,
    state: opts.final ? 'paused' : 'playing',
  };
  if (opts.final) params.final = 1;
  return appendParams(baseUrl, params);
}
