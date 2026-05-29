// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { injectButton, applyWatchedStyle, markButtonState } from '../../src/dom/decorate';
import { DECORATED_ATTR } from '../../src/dom/thumbnails';

function thumbAnchor(): HTMLAnchorElement {
  const a = document.createElement('a');
  a.setAttribute('href', '/watch?v=AAA');
  a.innerHTML = '<yt-thumbnail-view-model></yt-thumbnail-view-model>';
  document.body.appendChild(a);
  return a;
}

describe('injectButton', () => {
  it('marks the anchor decorated, adds a button with aria-label, and calls onClick', () => {
    const a = thumbAnchor();
    const onClick = vi.fn();
    injectButton(a, onClick);
    expect(a.hasAttribute(DECORATED_ATTR)).toBe(true);
    expect(a.classList.contains('ymw-anchor')).toBe(true);
    const btn = a.querySelector('button.ymw-mark-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Mark as watched');
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not inject twice', () => {
    const a = thumbAnchor();
    injectButton(a, vi.fn());
    injectButton(a, vi.fn());
    expect(a.querySelectorAll('button.ymw-mark-btn')).toHaveLength(1);
  });
});

describe('applyWatchedStyle + markButtonState', () => {
  it('adds the watched class + a bar, and flips the button to done', () => {
    const a = thumbAnchor();
    injectButton(a, vi.fn());
    applyWatchedStyle(a);
    expect(a.classList.contains('ymw-watched')).toBe(true);
    expect(a.querySelector('.ymw-watched-bar')).toBeTruthy();
    markButtonState(a, true);
    expect(a.querySelector('button.ymw-mark-btn')!.classList.contains('ymw-done')).toBe(true);
  });

  it('applyWatchedStyle is idempotent (one bar only)', () => {
    const a = thumbAnchor();
    applyWatchedStyle(a);
    applyWatchedStyle(a);
    expect(a.querySelectorAll('.ymw-watched-bar')).toHaveLength(1);
  });
});
