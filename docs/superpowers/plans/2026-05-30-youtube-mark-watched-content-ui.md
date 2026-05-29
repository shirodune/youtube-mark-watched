# YouTube Mark-as-Watched — Plan 2: Content-Script UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the visible feature — a "mark as watched" button on YouTube thumbnails that, on click, optimistically styles the video as watched and calls the (already-built, tested) `markWatched(videoId)` engine to write native history.

**Architecture:** A content script scans the page for video thumbnails, injects our own button overlay (styled to match YouTube's native hover buttons, class-independent), and wires clicks to the engine. A `MutationObserver` + YouTube's `yt-navigate-finish` event keep buttons/styling applied through infinite scroll and SPA navigation. Marked videos are stored in `chrome.storage.local` so optimistic styling re-applies as thumbnails recycle. Builds on Plan 1's `src/engine` and `src/page/pageScope.ts`.

**Tech Stack:** TypeScript, esbuild, Vitest (+ jsdom for DOM unit tests), Chrome MV3.

**Spec:** [../specs/2026-05-30-youtube-mark-watched-design.md](../specs/2026-05-30-youtube-mark-watched-design.md) · **Spike DOM findings:** [../spikes/2026-05-30-native-history-spike.md](../spikes/2026-05-30-native-history-spike.md)

**Commit convention:** Conventional Commits; every commit ends with the trailer
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Live DOM facts (captured 2026-05-30, source of truth for selectors)

- Feed video item: `yt-lockup-view-model` (usually inside `ytd-rich-item-renderer`). Legacy `ytd-rich-item-renderer` / `ytd-compact-video-renderer` / `ytd-grid-video-renderer` may also appear.
- **Thumbnail link** = an `a[href*="/watch?v="]` that **contains a `yt-thumbnail-view-model`** (or an `img`). The video's *title* link is a separate `a[href*="/watch?v="]` (no thumbnail inside) — must be excluded.
- Each video therefore has ≥2 watch anchors; dedupe by videoId and only decorate the thumbnail link.
- Ads: lockups containing `ad-badge-view-model` — skip.
- Shorts: `/shorts/` links — skip (already excluded by `extractVideoId`, which only accepts `/watch`).
- **Class names are hashed** — never select by class. Use tag names (`yt-lockup-view-model`, `yt-thumbnail-view-model`), `href`, and our own injected classes (prefixed `ymw-`).

## Button placement decision

We inject our own button (class `ymw-mark-btn`) absolutely positioned in the **top-left** corner of the thumbnail link, revealed on hover via our CSS. Native queue/watch-later buttons sit top-right on hover, so top-left avoids collision. The button is styled to visually match the native ones (translucent black, white icon, rounded). True "sit alongside the native buttons" placement is intentionally NOT attempted (their container is lazily rendered with hashed classes and resisted synthetic inspection) — revisit as a follow-up if desired after seeing it live.

## File structure (added in this plan)

```
src/
  content.ts            # REWRITE: orchestrator (gate, observe, scan, wire clicks, re-apply)
  dom/
    thumbnails.ts       # findThumbnailAnchors(root), videoIdOfThumbnail(anchor)  [pure-ish, jsdom-tested]
    decorate.ts         # injectButton(anchor, onClick), applyWatchedStyle(anchor), markButtonState(anchor)
    styles.ts           # CSS string (ymw-* rules) + injectStylesOnce()
  store/
    watchedStore.ts     # chrome.storage.local wrapper: isMarked, add, getAll  [mock-chrome tested]
  ui/
    toast.ts            # showToast(message)
tests/
  dom/thumbnails.test.ts        # jsdom
  store/watchedStore.test.ts    # mocked chrome
```

`content.ts` stays the entry; everything else is small focused modules it composes.

---

## Task 1: watchedStore (chrome.storage.local wrapper)

**Files:** Create `src/store/watchedStore.ts`, `tests/store/watchedStore.test.ts`

- [ ] **Step 1: Failing test** (`tests/store/watchedStore.test.ts`)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isMarked, add, getAll } from '../../src/store/watchedStore';

// Minimal in-memory chrome.storage.local mock
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
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/store/watchedStore.test.ts`
- [ ] **Step 3: Implement** (`src/store/watchedStore.ts`)

```ts
// src/store/watchedStore.ts
const KEY = 'ymw:watched';

async function readSet(): Promise<Set<string>> {
  const got = await chrome.storage.local.get(KEY);
  const arr = (got[KEY] as string[] | undefined) ?? [];
  return new Set(arr);
}

export async function getAll(): Promise<Set<string>> {
  return readSet();
}

export async function isMarked(videoId: string): Promise<boolean> {
  return (await readSet()).has(videoId);
}

export async function add(videoId: string): Promise<void> {
  const set = await readSet();
  if (set.has(videoId)) return;
  set.add(videoId);
  await chrome.storage.local.set({ [KEY]: [...set] });
}
```

- [ ] **Step 4: Run, expect PASS (3 tests)** — `npx vitest run tests/store/watchedStore.test.ts`
- [ ] **Step 5: Commit** — `feat: add chrome.storage watched-id store`

---

## Task 2: Thumbnail detection (jsdom-tested)

**Files:** Create `src/dom/thumbnails.ts`, `tests/dom/thumbnails.test.ts`

- [ ] **Step 1: Failing test** (`tests/dom/thumbnails.test.ts`) — note the jsdom directive on line 1

```ts
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
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/dom/thumbnails.test.ts`
- [ ] **Step 3: Implement** (`src/dom/thumbnails.ts`)

```ts
// src/dom/thumbnails.ts
import { extractVideoId } from '../page/pageScope';

export const DECORATED_ATTR = 'data-ymw';

/** True if the anchor is a *thumbnail* link (wraps the thumbnail), not a title link. */
function isThumbnailAnchor(a: Element): boolean {
  return !!a.querySelector('yt-thumbnail-view-model, img, yt-image');
}

function isInsideAd(a: Element): boolean {
  const lockup = a.closest('yt-lockup-view-model, ytd-rich-item-renderer');
  return !!lockup && !!lockup.querySelector('ad-badge-view-model');
}

/** Find undecorated thumbnail anchors under `root` that point at a /watch video. */
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
```

- [ ] **Step 4: Run, expect PASS** — `npx vitest run tests/dom/thumbnails.test.ts`
- [ ] **Step 5: Commit** — `feat: add thumbnail anchor detection`

---

## Task 3: Styles + decoration helpers

**Files:** Create `src/dom/styles.ts`, `src/dom/decorate.ts`. (Light jsdom test for decorate.)
Test: `tests/dom/decorate.test.ts`

- [ ] **Step 1: Implement styles** (`src/dom/styles.ts`)

```ts
// src/dom/styles.ts
// All visual styling for the extension. Class-independent of YouTube (own ymw- prefix).
const CSS = `
.ymw-anchor { position: relative; }
.ymw-mark-btn {
  position: absolute; top: 8px; left: 8px; z-index: 60;
  width: 28px; height: 28px; padding: 0;
  display: none; align-items: center; justify-content: center;
  border: none; border-radius: 50%; cursor: pointer;
  background: rgba(0,0,0,0.6); color: #fff;
}
.ymw-mark-btn svg { width: 16px; height: 16px; fill: currentColor; }
.ymw-mark-btn:hover { background: rgba(0,0,0,0.8); }
.ymw-mark-btn.ymw-done { background: rgba(0,0,0,0.85); color: #3ea6ff; }
.ymw-anchor:hover .ymw-mark-btn, .ymw-mark-btn:focus-visible { display: inline-flex; }
.ymw-watched-bar {
  position: absolute; left: 0; right: 0; bottom: 0; height: 4px; z-index: 59;
  background: #f00;
}
.ymw-anchor.ymw-watched yt-thumbnail-view-model, .ymw-anchor.ymw-watched img { opacity: 0.55; }
`;

export function injectStylesOnce(): void {
  if (document.getElementById('ymw-styles')) return;
  const el = document.createElement('style');
  el.id = 'ymw-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}
```

- [ ] **Step 2: Failing test** (`tests/dom/decorate.test.ts`)

```ts
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
```

- [ ] **Step 3: Implement** (`src/dom/decorate.ts`)

```ts
// src/dom/decorate.ts
import { DECORATED_ATTR } from './thumbnails';

const EYE_SVG =
  '<svg viewBox="0 0 24 24"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z"/></svg>';

export function injectButton(anchor: HTMLAnchorElement, onClick: () => void): void {
  if (anchor.hasAttribute(DECORATED_ATTR)) return;
  anchor.setAttribute(DECORATED_ATTR, '1');
  anchor.classList.add('ymw-anchor');

  const btn = document.createElement('button');
  btn.className = 'ymw-mark-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Mark as watched');
  btn.title = 'Mark as watched';
  btn.innerHTML = EYE_SVG;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  anchor.appendChild(btn);
}

export function applyWatchedStyle(anchor: HTMLAnchorElement): void {
  anchor.classList.add('ymw-watched');
  if (!anchor.querySelector('.ymw-watched-bar')) {
    const bar = document.createElement('div');
    bar.className = 'ymw-watched-bar';
    anchor.appendChild(bar);
  }
}

export function removeWatchedStyle(anchor: HTMLAnchorElement): void {
  anchor.classList.remove('ymw-watched');
  anchor.querySelector('.ymw-watched-bar')?.remove();
}

export function markButtonState(anchor: HTMLAnchorElement, done: boolean): void {
  const btn = anchor.querySelector('button.ymw-mark-btn');
  if (btn) btn.classList.toggle('ymw-done', done);
}
```

- [ ] **Step 4: Run, expect PASS** — `npx vitest run tests/dom/decorate.test.ts`
- [ ] **Step 5: Commit** — `feat: add button + watched-style decoration helpers`

---

## Task 4: Orchestrator (content.ts)

**Files:** Rewrite `src/content.ts`. (No unit test — verified in the browser in Task 6. The composed pieces are already unit-tested.)

- [ ] **Step 1: Implement** (`src/content.ts`)

```ts
// src/content.ts
import { isActiveSurface } from './page/pageScope';
import { injectStylesOnce } from './dom/styles';
import { findThumbnailAnchors, videoIdOfThumbnail } from './dom/thumbnails';
import { injectButton, applyWatchedStyle, removeWatchedStyle, markButtonState } from './dom/decorate';
import { isMarked, add, getAll } from './store/watchedStore';
import { markWatched } from './engine';
import { showToast } from './ui/toast';

const inFlight = new Set<string>();

async function handleClick(anchor: HTMLAnchorElement, videoId: string): Promise<void> {
  if (inFlight.has(videoId)) return;
  inFlight.add(videoId);
  applyWatchedStyle(anchor);     // optimistic
  markButtonState(anchor, true);
  await add(videoId);            // local record (so it persists across recycling)
  try {
    const res = await markWatched(videoId);
    if (!res.ok) throw new Error(res.error ?? 'unknown');
  } catch (e) {
    removeWatchedStyle(anchor);  // revert
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
```

- [ ] **Step 2: Build** — `npm run build`; expect `dist/content.js` rebuilt with no errors. Run `npx tsc --noEmit` (expect clean) and `npm test` (expect all prior tests still pass).
- [ ] **Step 3: Commit** — `feat: wire content-script orchestrator (scan, inject, mark, restyle)`

---

## Task 5: Toast UI + logged-out guard

**Files:** Create `src/ui/toast.ts`. Modify `src/content.ts` (logged-out guard).

- [ ] **Step 1: Implement toast** (`src/ui/toast.ts`)

```ts
// src/ui/toast.ts
export function showToast(message: string): void {
  const el = document.createElement('div');
  el.textContent = message;
  el.setAttribute('role', 'status');
  Object.assign(el.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 16px',
    borderRadius: '8px', zIndex: '99999', fontSize: '14px', pointerEvents: 'none',
  } as CSSStyleDeclaration);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
```

- [ ] **Step 2: Add a logged-out guard** in `src/content.ts` — at the top of `handleClick`, before optimistic styling, bail with a toast if the user is signed out. YouTube exposes login state on the page; read it defensively:

```ts
function isLoggedIn(): boolean {
  // ytcfg lives in the page's main world; the content script can't read it directly.
  // Use a DOM signal instead: the account avatar button is present only when signed in.
  return !!document.querySelector('#avatar-btn, ytd-topbar-menu-button-renderer #avatar, button[aria-label*="Account"]');
}
```
Then in `handleClick`:
```ts
  if (!isLoggedIn()) { showToast('Sign in to mark videos as watched'); return; }
```
(Place this as the first statement in `handleClick`, before `inFlight`/optimistic styling.)

- [ ] **Step 3: Build + typecheck + test** — `npm run build && npx tsc --noEmit && npm test`; all clean/pass.
- [ ] **Step 4: Commit** — `feat: add toast + signed-out guard`

---

## Task 6: Browser verification (manual, controller-run)

**Not a code task — the controller verifies in a real browser via Claude-in-Chrome.** Load `dist/` unpacked, then on a logged-in YouTube:

- [ ] Home feed: button appears on thumbnail hover; matches native look reasonably; click → thumbnail gets red bar + dim, button flips state.
- [ ] After a few seconds, reload `/feed/history`: the clicked video is present and shows a watched bar (native write succeeded via the engine).
- [ ] Subscriptions, a channel page, and the watch-page sidebar: buttons inject and work.
- [ ] Search results (`/results`): NO buttons (gating).
- [ ] Scroll (infinite scroll) and SPA-navigate: buttons keep appearing; previously-marked videos stay styled.
- [ ] Signed-out (or simulate): clicking shows the sign-in toast, no broken styling.

Record results; file any defects as follow-up tasks.

---

## Self-Review (plan author)

**Spec coverage:** button on thumbnails (T3/T4) · surfaces gated via `isActiveSurface` (T4) · optimistic styling (T3/T4) · native write via engine (T4, Plan 1) · storage/re-apply (T1/T4) · observer + SPA nav (T4) · error revert + toast (T4/T5) · logged-out (T5) · Shorts/ads/search excluded (T2/T4). ✓

**Placeholder scan:** none — every step has concrete code or concrete browser checks.

**Type consistency:** `DECORATED_ATTR` defined in `thumbnails.ts`, imported by `decorate.ts`/tests. `injectButton/applyWatchedStyle/removeWatchedStyle/markButtonState` signatures consistent across `decorate.ts` and `content.ts`. `isMarked/add/getAll` consistent across `watchedStore.ts` and `content.ts`. `markWatched` imported from `./engine` (Plan 1 `index.ts`). `showToast` consistent.

**Known follow-ups (not blocking):** true "alongside native buttons" placement; concurrency beyond the in-flight de-dupe (per spec a heavier queue was optional — the `inFlight` set covers double-click de-dupe, which is the real risk for the lightweight engine).
