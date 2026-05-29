// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { findThumbnailAnchors, videoIdOfThumbnail } from '../../src/dom/thumbnails';

function lockup(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('findThumbnailAnchors', () => {
  it('finds the thumbnail link (anchor wrapping yt-thumbnail-view-model), not the title link', () => {
    const root = lockup(`
      <yt-lockup-view-model>
        <a id="thumb" href="/watch?v=AAA"><yt-thumbnail-view-model></yt-thumbnail-view-model></a>
        <yt-lockup-metadata-view-model>
          <h3><a id="title" href="/watch?v=AAA">Title</a></h3>
        </yt-lockup-metadata-view-model>
      </yt-lockup-view-model>`);
    const anchors = findThumbnailAnchors(root);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.id).toBe('thumb');
  });

  it('skips ad lockups', () => {
    const root = lockup(`
      <yt-lockup-view-model>
        <ad-badge-view-model></ad-badge-view-model>
        <a href="/watch?v=BBB"><yt-thumbnail-view-model></yt-thumbnail-view-model></a>
      </yt-lockup-view-model>`);
    expect(findThumbnailAnchors(root)).toHaveLength(0);
  });

  it('does not double-pick already-decorated anchors', () => {
    const root = lockup(`<a href="/watch?v=CCC" data-ymw="1"><yt-thumbnail-view-model></yt-thumbnail-view-model></a>`);
    expect(findThumbnailAnchors(root)).toHaveLength(0);
  });

  it('also matches legacy thumbnails (img inside anchor)', () => {
    const root = lockup(`<a href="/watch?v=DDD"><img src="x"></a>`);
    expect(findThumbnailAnchors(root)).toHaveLength(1);
  });
});

describe('videoIdOfThumbnail', () => {
  it('extracts the id from the anchor href', () => {
    const a = document.createElement('a');
    a.setAttribute('href', '/watch?v=AAA&t=1');
    expect(videoIdOfThumbnail(a)).toBe('AAA');
  });
});
