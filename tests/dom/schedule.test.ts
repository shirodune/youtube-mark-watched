import { afterEach, describe, expect, it, vi } from 'vitest';
import { coalesce } from '../../src/dom/schedule';

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

  it('is not starved by calls arriving every 250ms', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const run = coalesce(fn, 250);
    for (let i = 0; i < 8; i++) {
      run();
      vi.advanceTimersByTime(250);
    }
    expect(fn).toHaveBeenCalledTimes(8);
  });
});
