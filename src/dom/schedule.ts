// src/dom/schedule.ts

/**
 * Run `fn` once, `ms` after the first call of a burst; later calls in the window are merged.
 * Unlike a debounce, a steady stream of calls cannot postpone it forever (B3).
 */
export function coalesce(fn: () => void, ms: number): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      fn();
    }, ms);
  };
}
