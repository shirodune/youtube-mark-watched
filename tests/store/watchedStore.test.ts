import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isMarked, add, getAll } from '../../src/store/watchedStore';

function installChromeMock(initial: Record<string, unknown> = {}) {
  let store: Record<string, unknown> = { ...initial };
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (keys: string[] | string) =>
          Promise.resolve(
            (Array.isArray(keys) ? keys : [keys]).reduce((acc, k) => {
              if (k in store) acc[k] = store[k];
              return acc;
            }, {} as Record<string, unknown>),
          ),
        set: (items: Record<string, unknown>) => {
          store = { ...store, ...items };
          return Promise.resolve();
        },
      },
    },
  };
  return () => store;
}

describe('watchedStore', () => {
  beforeEach(() => installChromeMock());

  it('reports not marked for unknown ids', async () => {
    expect(await isMarked('abc')).toBe(false);
  });
  it('adds an id and then reports it marked', async () => {
    await add('abc');
    expect(await isMarked('abc')).toBe(true);
  });
  it('getAll returns the set of marked ids', async () => {
    await add('one');
    await add('two');
    const all = await getAll();
    expect(all.has('one')).toBe(true);
    expect(all.has('two')).toBe(true);
  });
});
