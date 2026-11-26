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

const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT']);

/**
 * Does this childList record add something that could hold a thumbnail (B3)? Ignores removals, text,
 * our own UI and script/style churn (History inserts a <script> every 250ms).
 */
export function addsContent(record: MutationRecord): boolean {
  for (const node of record.addedNodes) {
    if (!(node instanceof Element)) continue;
    if (IGNORED_TAGS.has(node.tagName)) continue;
    if (node.classList.contains('ymw-mark-btn') || node.classList.contains('ymw-watched-bar')) continue;
    return true;
  }
  return false;
}
