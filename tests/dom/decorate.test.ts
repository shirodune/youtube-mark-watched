// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { injectButton, applyWatchedStyle, markButtonState, syncWatchedState } from '../../src/dom/decorate';
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

describe('syncWatchedState (C6: reused nodes follow their current href)', () => {
  const isOn = (a: HTMLAnchorElement) => ({
    bar: !!a.querySelector('.ymw-watched-bar'),
    done: a.querySelector('button.ymw-mark-btn')!.classList.contains('ymw-done'),
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
