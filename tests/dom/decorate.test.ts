// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  applyWatchedStyle,
  buttonOf,
  injectButton,
  markButtonState,
  removeWatchedStyle,
  syncWatchedState,
  thumbnailBox,
  undecorate,
} from '../../src/dom/decorate';
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
    const btn = buttonOf(a)!;
    expect(btn.parentElement).toBe(a);
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
    expect(buttonOf(a)!.classList.contains('ymw-done')).toBe(true);
  });

  it('applyWatchedStyle is idempotent (one bar only)', () => {
    const a = thumbAnchor();
    applyWatchedStyle(a);
    applyWatchedStyle(a);
    expect(a.querySelectorAll('.ymw-watched-bar')).toHaveLength(1);
  });
});

describe('syncWatchedState (C6: reused nodes follow their current href)', () => {
  const isOn = (a: HTMLAnchorElement) => ({
    bar: !!a.querySelector('.ymw-watched-bar'),
    done: buttonOf(a)!.classList.contains('ymw-done'),
  });

  it('shows bar + done when the current video is marked', () => {
    const a = thumbAnchor();
    injectButton(a, vi.fn());
    syncWatchedState(a, new Set(['AAA']));
    expect(isOn(a)).toEqual({ bar: true, done: true });
  });

  it('clears bar + done when the anchor is reused for an unmarked video', () => {
    const a = thumbAnchor();
    injectButton(a, vi.fn());
    const marked = new Set(['AAA']);
    syncWatchedState(a, marked);
    a.setAttribute('href', '/watch?v=BBB');
    syncWatchedState(a, marked);
    expect(isOn(a)).toEqual({ bar: false, done: false });
  });

  it('clears state when the video is unmarked (failure rollback)', () => {
    const a = thumbAnchor();
    injectButton(a, vi.fn());
    const marked = new Set(['AAA']);
    syncWatchedState(a, marked);
    marked.delete('AAA');
    syncWatchedState(a, marked);
    expect(isOn(a)).toEqual({ bar: false, done: false });
  });
});

describe('undecorate', () => {
  it('removes the button, bar, marker attribute and class', () => {
    const a = thumbAnchor();
    injectButton(a, vi.fn());
    applyWatchedStyle(a);
    undecorate(a);
    expect(buttonOf(a)).toBeNull();
    expect(a.querySelector('.ymw-watched-bar')).toBeNull();
    expect(a.hasAttribute(DECORATED_ATTR)).toBe(false);
    expect(a.classList.contains('ymw-anchor')).toBe(false);
  });
});

describe('watched bar placement (C2)', () => {
  it('goes inside the thumbnail element, not the wider <a>', () => {
    const a = thumbAnchor(); // contains <yt-thumbnail-view-model>
    applyWatchedStyle(a);
    const bar = a.querySelector('.ymw-watched-bar')!;
    expect(bar.parentElement!.tagName).toBe('YT-THUMBNAIL-VIEW-MODEL');
    expect(thumbnailBox(a)).toBe(bar.parentElement);
  });

  it('falls back to the <a> for legacy thumbnails', () => {
    const a = document.createElement('a');
    a.setAttribute('href', '/watch?v=LEG');
    a.appendChild(document.createElement('img'));
    applyWatchedStyle(a);
    expect(a.querySelector('.ymw-watched-bar')!.parentElement).toBe(a);
  });

  it('is removed again from inside the thumbnail', () => {
    const a = thumbAnchor();
    applyWatchedStyle(a);
    removeWatchedStyle(a);
    expect(a.querySelector('.ymw-watched-bar')).toBeNull();
  });

  it('draws no bar inside the inline preview, but the button still shows done', () => {
    const preview = document.createElement('ytd-video-preview');
    const a = document.createElement('a');
    a.setAttribute('href', '/watch?v=AAA');
    a.appendChild(document.createElement('div'));
    preview.appendChild(a);
    document.body.appendChild(preview);
    injectButton(a, vi.fn());
    syncWatchedState(a, new Set(['AAA']));
    expect(a.querySelector('.ymw-watched-bar')).toBeNull();
    expect(buttonOf(a)!.classList.contains('ymw-done')).toBe(true);
  });
});
