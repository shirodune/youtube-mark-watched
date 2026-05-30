// src/content.ts
import { isActiveSurface } from './page/pageScope';
import { injectStylesOnce } from './dom/styles';
import { findThumbnailAnchors, videoIdOfThumbnail } from './dom/thumbnails';
import { injectButton, applyWatchedStyle, removeWatchedStyle, markButtonState } from './dom/decorate';
import { markWatched } from './engine';
import { showToast } from './ui/toast';

const inFlight = new Set<string>();

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
async function handleClick(anchor: HTMLAnchorElement, videoId: string): Promise<void> {
  if (isSignedOut()) {
    showToast('Sign in to mark videos as watched');
    return;
  }
  if (inFlight.has(videoId)) return;
  inFlight.add(videoId);
  applyWatchedStyle(anchor); // optimistic, this view only
  markButtonState(anchor, true);
  try {
    const res = await markWatched(videoId);
    if (!res.ok) throw new Error(res.error ?? 'unknown');
  } catch (e) {
    console.warn('[YMW] mark failed', videoId, e);
    removeWatchedStyle(anchor); // revert on failure
    markButtonState(anchor, false);
    showToast('Couldn’t mark as watched');
  } finally {
    inFlight.delete(videoId);
  }
}

function scan(): void {
  if (!isActiveSurface(location.pathname)) return;
  for (const anchor of findThumbnailAnchors(document)) {
    const videoId = videoIdOfThumbnail(anchor);
    if (!videoId) continue;
    injectButton(anchor, () => void handleClick(anchor, videoId));
  }
}

function debounce(fn: () => void, ms: number): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (t) clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

function start(): void {
  injectStylesOnce();
  const run = debounce(scan, 250);
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-finish', scan);
  scan();
}

start();
