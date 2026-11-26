// src/entrypoints/content/index.ts — content script entry (see SPEC.md §3)
import './style.css';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

import { injectButton, syncWatchedState, undecorate } from '@/dom/decorate';
import { addsContent, coalesce } from '@/dom/schedule';
import { DECORATED_ATTR, findThumbnailAnchors, videoIdOfThumbnail } from '@/dom/thumbnails';
import { markWatched } from '@/engine';
import { isActiveSurface } from '@/page/pageScope';
import { showToast } from '@/ui/toast';

const inFlight = new Set<string>();
// Videos optimistically marked in this page view (C5: never persisted).
const marked = new Set<string>();

function decoratedAnchors(): HTMLAnchorElement[] {
  return [...document.querySelectorAll<HTMLAnchorElement>(`a[${DECORATED_ATTR}]`)];
}

function syncAll(): void {
  for (const a of decoratedAnchors()) syncWatchedState(a, marked);
}

function isSignedOut(): boolean {
  // Positive avatar detection is unreliable on YouTube's obfuscated masthead, so we
  // default to "signed in" and only block when a clear sign-in affordance is present.
  return !!document.querySelector(
    'ytd-masthead a[href*="accounts.google.com"], ytd-masthead a[href*="ServiceLogin"], a[aria-label="Sign in"]',
  );
}

// The watched bar is OPTIMISTIC FEEDBACK ONLY — it lasts for the current page view and is
// intentionally NOT re-applied after a reload. Once the page reloads, the native YouTube
// state takes over and we leave already-marked thumbnails completely untouched.
async function handleClick(anchor: HTMLAnchorElement): Promise<void> {
  if (!isActiveSurface(location.pathname)) return; // B1: a leftover node on an out-of-scope page
  // Read the id at click time: YouTube reuses lockups and the inline preview (C6).
  const videoId = videoIdOfThumbnail(anchor);
  if (!videoId) return;
  if (isSignedOut()) {
    showToast('Sign in to mark videos as watched');
    return;
  }
  if (inFlight.has(videoId)) return;
  inFlight.add(videoId);
  marked.add(videoId); // optimistic, this view only
  syncAll();
  try {
    const res = await markWatched(videoId);
    if (!res.ok) throw new Error(res.error ?? 'unknown');
  } catch (e) {
    console.warn('[YMW] mark failed', videoId, e);
    marked.delete(videoId); // revert on failure
    syncAll();
    showToast('Couldn’t mark as watched');
  } finally {
    inFlight.delete(videoId);
  }
}

function scan(): void {
  if (!isActiveSurface(location.pathname)) {
    // B1: nodes like the inline preview survive SPA navigation; don't leave our UI on them.
    for (const a of decoratedAnchors()) undecorate(a);
    return;
  }
  for (const anchor of findThumbnailAnchors(document)) {
    injectButton(anchor, () => void handleClick(anchor));
  }
  syncAll(); // C6: new thumbnails of an already-marked video get its state too
}

function start(ctx: ContentScriptContext): void {
  const run = coalesce(() => {
    if (ctx.isValid) scan();
  }, 250);
  const observer = new MutationObserver((records) => {
    let added = false;
    for (const r of records) {
      if (r.type === 'childList') {
        if (addsContent(r)) added = true;
      } else if (r.target instanceof HTMLAnchorElement) {
        if (r.target.hasAttribute(DECORATED_ATTR)) {
          syncWatchedState(r.target, marked); // reused node now points at another video (C6)
        } else if (videoIdOfThumbnail(r.target)) {
          added = true; // B3: an existing link just became a watch link
        }
      }
    }
    if (added) run();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });
  // YouTube's own SPA event isn't in DocumentEventMap, so remove it ourselves on invalidation.
  document.addEventListener('yt-navigate-finish', scan);
  // Extension reloaded/updated: this script is orphaned, stop reacting to the page.
  ctx.onInvalidated(() => {
    observer.disconnect();
    document.removeEventListener('yt-navigate-finish', scan);
    // Our buttons' click handlers belong to this dead script; let the new one re-inject.
    for (const a of decoratedAnchors()) undecorate(a);
  });
  scan();
}

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  runAt: 'document_idle',
  main: start,
});
