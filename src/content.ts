// src/content.ts
import { isActiveSurface } from './page/pageScope';
import { injectStylesOnce } from './dom/styles';
import { findThumbnailAnchors, videoIdOfThumbnail } from './dom/thumbnails';
import { injectButton, applyWatchedStyle, removeWatchedStyle, markButtonState } from './dom/decorate';
import { add, getAll } from './store/watchedStore';
import { markWatched } from './engine';
import { showToast } from './ui/toast';

const inFlight = new Set<string>();

function isLoggedIn(): boolean {
  return !!document.querySelector('#avatar-btn, ytd-topbar-menu-button-renderer #avatar, button[aria-label*="Account"]');
}

async function handleClick(anchor: HTMLAnchorElement, videoId: string): Promise<void> {
  if (!isLoggedIn()) { showToast('Sign in to mark videos as watched'); return; }
  if (inFlight.has(videoId)) return;
  inFlight.add(videoId);
  applyWatchedStyle(anchor);       // optimistic
  markButtonState(anchor, true);
  await add(videoId);              // local record so styling persists across recycling
  try {
    const res = await markWatched(videoId);
    if (!res.ok) throw new Error(res.error ?? 'unknown');
  } catch {
    removeWatchedStyle(anchor);    // revert on failure
    markButtonState(anchor, false);
    showToast('Couldn’t mark as watched');
  } finally {
    inFlight.delete(videoId);
  }
}

async function scan(): Promise<void> {
  if (!isActiveSurface(location.pathname)) return;
  const marked = await getAll();
  for (const anchor of findThumbnailAnchors(document)) {
    const videoId = videoIdOfThumbnail(anchor);
    if (!videoId) continue;
    injectButton(anchor, () => void handleClick(anchor, videoId));
    if (marked.has(videoId)) {
      applyWatchedStyle(anchor);
      markButtonState(anchor, true);
    }
  }
}

function debounce(fn: () => void, ms: number): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => { if (t) clearTimeout(t); t = setTimeout(fn, ms); };
}

function start(): void {
  injectStylesOnce();
  const run = debounce(() => void scan(), 250);
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('yt-navigate-finish', () => void scan());
  void scan();
}

start();
