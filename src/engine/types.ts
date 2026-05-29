// src/engine/types.ts
export interface MarkResult {
  ok: boolean;
  error?: string;
}

export type MarkWatched = (videoId: string) => Promise<MarkResult>;
