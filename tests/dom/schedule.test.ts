// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addsContent, coalesce } from '../../src/dom/schedule';

describe('coalesce (B3)', () => {
  afterEach(() => vi.useRealTimers());

  it('runs once per burst, ms after the first call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const run = coalesce(fn, 250);
    run();
    run();
    run();
    vi.advanceTimersByTime(249);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('is not starved by calls arriving faster than the window (B3)', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const run = coalesce(fn, 250);
    // A call every 100ms for 1s: a debounce would never fire until the calls stop.
    for (let t = 0; t < 1000; t += 100) {
      run();
      vi.advanceTimersByTime(100);
      if (t === 200) expect(fn).toHaveBeenCalledTimes(1); // 250ms after the first call
    }
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

describe('addsContent (B3)', () => {
  const rec = (...nodes: Node[]) => ({ addedNodes: nodes }) as unknown as MutationRecord;
  const el = (tag: string, cls?: string) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  it('is true when an element that could hold thumbnails is added', () => {
    expect(addsContent(rec(el('ytd-rich-item-renderer')))).toBe(true);
    expect(addsContent(rec(el('script'), el('div')))).toBe(true);
  });

  it('ignores script/style churn, text, our own UI and removals', () => {
    expect(addsContent(rec(el('script')))).toBe(false); // History does this every 250ms
    expect(addsContent(rec(el('style'), el('link')))).toBe(false);
    expect(addsContent(rec(document.createTextNode('x')))).toBe(false);
    expect(addsContent(rec(el('button', 'ymw-mark-btn'), el('div', 'ymw-watched-bar')))).toBe(false);
    expect(addsContent(rec())).toBe(false);
  });
});
