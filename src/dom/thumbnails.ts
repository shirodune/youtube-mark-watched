// src/dom/thumbnails.ts
import { extractVideoId } from '../page/pageScope';

export const DECORATED_ATTR = 'data-ymw';

function isThumbnailAnchor(a: Element): boolean {
  return !!a.querySelector('yt-thumbnail-view-model, img, yt-image');
}

function isInsideAd(a: Element): boolean {
  // Outermost card first: the ad badge can sit outside a nested lockup (B4).
  const card = a.closest('ytd-rich-item-renderer') ?? a.closest('yt-lockup-view-model');
  return !!card?.querySelector('ad-badge-view-model');
}

export function findThumbnailAnchors(root: ParentNode): HTMLAnchorElement[] {
  const out: HTMLAnchorElement[] = [];
  const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href*="/watch?v="]');
  for (const a of anchors) {
    // Re-inject if YouTube re-rendered the anchor's children and dropped our button (B1).
    if (a.querySelector(':scope > .ymw-mark-btn')) continue;
    if (!isThumbnailAnchor(a)) continue;
    if (isInsideAd(a)) continue;
    if (!videoIdOfThumbnail(a)) continue;
    out.push(a);
  }
  return out;
}

export function videoIdOfThumbnail(a: Element): string | null {
  return extractVideoId(a.getAttribute('href') ?? '');
}
