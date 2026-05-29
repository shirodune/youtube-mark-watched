// src/engine/index.ts
// Approach B (lightweight pings) is the default per the Task 1 spike.
// If the spike selected approach A, swap this binding for the background-tab engine.
import { markWatchedViaPings } from './pingEngine';
import type { MarkWatched } from './types';

export const markWatched: MarkWatched = (videoId) => markWatchedViaPings(videoId);
export type { MarkResult, MarkWatched } from './types';
