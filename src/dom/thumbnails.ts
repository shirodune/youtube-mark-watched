// src/dom/thumbnails.ts
import { extractVideoId } from '../page/pageScope';

export const DECORATED_ATTR = 'data-ymw';

function isThumbnailAnchor(a: Element): boolean {
  return !!a.querySelector('yt-thumbnail-view-model, img, yt-image');
}

function isInsideAd(a: Element): boolean {
  const lockup = a.closest('yt-lockup-view-model, ytd-rich-item-renderer');
  return !!lockup && !!lockup.querySelector('ad-badge-view-model');
}

export function findThumbnailAnchors(root: ParentNode): HTMLAnchorElement[] {
  const out: HTMLAnchorElement[] = [];
  const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href*="/watch?v="]');
  for (const a of anchors) {
    if (a.hasAttribute(DECORATED_ATTR)) continue;
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
