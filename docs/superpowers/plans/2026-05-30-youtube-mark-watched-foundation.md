# YouTube Mark-as-Watched — Plan 1: Foundation & Feasibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove we can write to native YouTube watch history, then build the unit-tested marking engine and utilities behind a swappable `markWatched(videoId)` interface.

**Architecture:** A feasibility spike runs first (against real, logged-in YouTube via Claude-in-Chrome) to confirm the lightweight-ping mechanism (approach B) and capture the live hover-overlay DOM. Then we scaffold a TypeScript + esbuild + Vitest project and implement the marking engine as small, pure, mock-testable modules behind the `markWatched` interface. The content-script UI is a separate follow-up plan (Plan 2).

**Tech Stack:** TypeScript, esbuild (bundling content/service-worker entries), Vitest (unit tests), Chrome Manifest V3.

**Spec:** [docs/superpowers/specs/2026-05-30-youtube-mark-watched-design.md](../specs/2026-05-30-youtube-mark-watched-design.md)

**Commit convention:** Conventional Commits. Every commit message must end with the trailer:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure (created across this plan)

```
youtube-mark-watched/
├── manifest.json              # MV3 manifest
├── package.json               # scripts + devDeps
├── tsconfig.json              # TS config
├── build.mjs                  # esbuild build script
├── vitest.config.ts           # test config
├── src/
│   ├── engine/
│   │   ├── types.ts           # MarkResult, MarkWatched interface
│   │   ├── cpn.ts             # generateCpn()
│   │   ├── pingUrl.ts         # buildPlaybackPingUrl / buildWatchtimePingUrl / appendParams
│   │   ├── playerResponse.ts  # extractJsonObject / extractPlayerResponse
│   │   ├── playerApi.ts       # fetchTrackingUrls()
│   │   ├── pingEngine.ts      # markWatchedViaPings()  (approach B)
│   │   └── index.ts           # exports `markWatched` bound to the chosen impl
│   ├── page/
│   │   └── pageScope.ts       # extractVideoId() / isActiveSurface()
│   └── content.ts             # content-script entry (minimal smoke for Plan 1)
└── tests/
    ├── engine/{cpn,pingUrl,playerResponse,playerApi,pingEngine}.test.ts
    └── page/pageScope.test.ts
```

Each `src/engine/*` file has one responsibility and is testable in isolation with a mocked `fetch`. `src/page/pageScope.ts` holds pure string functions. `content.ts` stays a stub until Plan 2.

---

## Task 1: Feasibility spike (exploratory — not TDD)

**Purpose:** Empirically decide approach B vs A, capture B's real ping parameters, and record the live hover-overlay DOM for Plan 2. This task writes to the user's REAL watch history.

**Files:**
- Create: `docs/superpowers/spikes/2026-05-30-native-history-spike.md` (findings record)

- [ ] **Step 1: Get explicit user go-ahead**

This step performs a real, account-affecting write. Confirm with the user in chat: "OK to run the spike now? It will mark one throwaway test video as watched in your real YouTube history." Ask the user to name a specific test video (or pick a random one they don't mind appearing in history) and record its 11-char videoId.

- [ ] **Step 2: Confirm logged-in session (Claude-in-Chrome)**

Use the Claude-in-Chrome tools: create an MCP tab, navigate to `https://www.youtube.com`, and verify the account avatar is present (logged in). If logged out, stop — native history is impossible; report to user.

- [ ] **Step 3: Run B's ping sequence from the page context**

On a `youtube.com` tab, execute this snippet via the `javascript_tool` (replace `VIDEO_ID`). It mirrors what `src/engine` will productionize:

```js
(async (videoId) => {
  const CPN = Array.from({length:16}, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[Math.floor(Math.random()*64)]
  ).join('');
  const html = await (await fetch(`https://www.youtube.com/watch?v=${videoId}`, {credentials:'include'})).text();
  const i = html.indexOf('ytInitialPlayerResponse');
  const start = html.indexOf('{', i);
  // naive balanced-brace scan for the spike only
  let depth = 0, end = start, inStr = false, esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = j+1; break; } }
  }
  const player = JSON.parse(html.slice(start, end));
  const pt = player.playbackTracking;
  const dur = Number(player.videoDetails.lengthSeconds);
  const pb = new URL(pt.videostatsPlaybackUrl.baseUrl); pb.searchParams.set('ver','2'); pb.searchParams.set('cpn',CPN);
  const wt = new URL(pt.videostatsWatchtimeUrl.baseUrl);
  wt.searchParams.set('ver','2'); wt.searchParams.set('cpn',CPN);
  wt.searchParams.set('cmt',String(dur)); wt.searchParams.set('st','0'); wt.searchParams.set('et',String(dur)); wt.searchParams.set('state','playing');
  const r1 = await fetch(pb.toString(), {credentials:'include'});
  const r2 = await fetch(wt.toString(), {credentials:'include'});
  return {playback:r1.status, watchtime:r2.status, dur, pbUrl:pb.toString(), wtUrl:wt.toString()};
})('VIDEO_ID');
```

Record the returned statuses and the exact playback/watchtime URLs.

- [ ] **Step 4: Verify native history was written**

Navigate to `https://www.youtube.com/feed/history`, reload, and check: (a) does the test video appear at the top of history; (b) does its thumbnail show the red progress bar. Also check the video's thumbnail on the home/subscriptions feed for the red bar.

- [ ] **Step 5: Capture the live hover-overlay DOM for Plan 2**

On a feed page, use `read_page` (or `get_page_text` / DOM inspection) to capture the markup of a thumbnail's hover overlay containing the native "Add to queue" and "Watch later" buttons. Record: the container element/selector, the button element tag/classes, and how hover-reveal is wired. This makes Plan 2's injection concrete.

- [ ] **Step 6: Record findings + decide**

Write `docs/superpowers/spikes/2026-05-30-native-history-spike.md` with: the statuses, whether history + bar appeared, the confirmed param set, and the captured overlay DOM. Decision gate:
- **History + bar appeared** → approach B confirmed. Proceed to Task 2. The param set here is the source of truth for Tasks 6–8.
- **History appeared, no bar** → keep B (history is the goal); note bar tuning as a known limitation. Proceed to Task 2.
- **Nothing appeared** → approach B failed. **Do not proceed with Tasks 6–8 as written.** Stop and write a revised engine plan for approach A (background-tab playback). Tasks 2–5 (scaffold + pure utils) still apply unchanged.

- [ ] **Step 7: Commit the findings**

```bash
git add docs/superpowers/spikes/2026-05-30-native-history-spike.md
git commit -m "docs: record native-history feasibility spike findings"
```

---

## Task 2: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `build.mjs`, `vitest.config.ts`, `manifest.json`, `src/content.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "youtube-mark-watched",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "esbuild": "^0.21.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["chrome"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "tests", "build.mjs", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `build.mjs`**

```js
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/content.ts'],
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome120',
  logLevel: 'info',
});
await copyFile('manifest.json', 'dist/manifest.json');
console.log('Build complete -> dist/');
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "YouTube Mark as Watched",
  "version": "0.1.0",
  "description": "Adds a button to YouTube thumbnails to mark videos as watched in native YouTube history.",
  "permissions": ["storage"],
  "host_permissions": ["*://*.youtube.com/*"],
  "content_scripts": [
    {
      "matches": ["*://*.youtube.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

(Note: `tabs` permission is added in Plan 2 only if approach A is integrated.)

- [ ] **Step 6: Create `src/content.ts` (stub)**

```ts
// Full thumbnail/button UI lands in Plan 2. This stub confirms the bundle loads.
console.log('[YT Mark Watched] content script loaded');
```

- [ ] **Step 7: Install, build, and smoke-test**

Run: `npm install && npm run build`
Expected: `dist/content.js` and `dist/manifest.json` exist; "Build complete -> dist/" prints.
Then load `dist/` as an unpacked extension in Chrome, open YouTube, and confirm the console logs `[YT Mark Watched] content script loaded`.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json build.mjs vitest.config.ts manifest.json src/content.ts
git commit -m "chore: scaffold MV3 extension with esbuild + vitest"
```

---

## Task 3: `extractVideoId` (pure)

**Files:**
- Create: `src/page/pageScope.ts`
- Test: `tests/page/pageScope.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { extractVideoId } from '../../src/page/pageScope';

describe('extractVideoId', () => {
  it('extracts id from a relative watch href', () => {
    expect(extractVideoId('/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('extracts id from an absolute watch URL with extra params', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=abc123XYZ_-&list=PL1')).toBe('abc123XYZ_-');
  });
  it('returns null for a shorts link', () => {
    expect(extractVideoId('/shorts/dQw4w9WgXcQ')).toBeNull();
  });
  it('returns null for a non-watch path', () => {
    expect(extractVideoId('/feed/subscriptions')).toBeNull();
  });
  it('returns null for empty/garbage input', () => {
    expect(extractVideoId('')).toBeNull();
    expect(extractVideoId('not a url')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/page/pageScope.test.ts`
Expected: FAIL — `extractVideoId` is not exported / module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/page/pageScope.ts

export function extractVideoId(href: string): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, 'https://www.youtube.com');
  } catch {
    return null;
  }
  if (url.pathname !== '/watch') return null;
  return url.searchParams.get('v');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/page/pageScope.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/page/pageScope.ts tests/page/pageScope.test.ts
git commit -m "feat: add extractVideoId helper"
```

---

## Task 4: `isActiveSurface` (pure)

**Files:**
- Modify: `src/page/pageScope.ts`
- Test: `tests/page/pageScope.test.ts` (add cases)

- [ ] **Step 1: Write the failing test (append to the existing file)**

```ts
import { isActiveSurface } from '../../src/page/pageScope';

describe('isActiveSurface', () => {
  it('is active on home', () => expect(isActiveSurface('/')).toBe(true));
  it('is active on subscriptions', () => expect(isActiveSurface('/feed/subscriptions')).toBe(true));
  it('is active on a watch page (sidebar)', () => expect(isActiveSurface('/watch')).toBe(true));
  it('is active on handle channel pages', () => {
    expect(isActiveSurface('/@SomeChannel')).toBe(true);
    expect(isActiveSurface('/@SomeChannel/videos')).toBe(true);
  });
  it('is active on legacy channel paths', () => {
    expect(isActiveSurface('/channel/UC123')).toBe(true);
    expect(isActiveSurface('/c/SomeChannel')).toBe(true);
    expect(isActiveSurface('/user/SomeUser')).toBe(true);
  });
  it('is INACTIVE on search results', () => expect(isActiveSurface('/results')).toBe(false));
  it('is INACTIVE on history feed', () => expect(isActiveSurface('/feed/history')).toBe(false));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/page/pageScope.test.ts`
Expected: FAIL — `isActiveSurface` is not exported.

- [ ] **Step 3: Write minimal implementation (append to `src/page/pageScope.ts`)**

```ts
export function isActiveSurface(pathname: string): boolean {
  if (pathname === '/' || pathname === '/feed/subscriptions' || pathname === '/watch') {
    return true;
  }
  if (pathname.startsWith('/@') || pathname.startsWith('/channel/') ||
      pathname.startsWith('/c/') || pathname.startsWith('/user/')) {
    return true;
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/page/pageScope.test.ts`
Expected: PASS (all `extractVideoId` + `isActiveSurface` cases).

- [ ] **Step 5: Commit**

```bash
git add src/page/pageScope.ts tests/page/pageScope.test.ts
git commit -m "feat: add isActiveSurface page gating"
```

---

## Task 5: `generateCpn` (pure)

**Files:**
- Create: `src/engine/cpn.ts`
- Test: `tests/engine/cpn.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { generateCpn, CPN_CHARS } from '../../src/engine/cpn';

describe('generateCpn', () => {
  it('returns a 16-character string', () => {
    expect(generateCpn()).toHaveLength(16);
  });
  it('uses only the YouTube cpn charset', () => {
    const cpn = generateCpn();
    for (const ch of cpn) expect(CPN_CHARS).toContain(ch);
  });
  it('produces different values across calls', () => {
    const a = generateCpn(), b = generateCpn();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/cpn.test.ts`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/cpn.ts

export const CPN_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function generateCpn(): string {
  let cpn = '';
  for (let i = 0; i < 16; i++) {
    cpn += CPN_CHARS[Math.floor(Math.random() * CPN_CHARS.length)];
  }
  return cpn;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/cpn.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/cpn.ts tests/engine/cpn.test.ts
git commit -m "feat: add cpn generator"
```

---

## Task 6: Ping URL builders (pure)

**Files:**
- Create: `src/engine/pingUrl.ts`
- Test: `tests/engine/pingUrl.test.ts`

> **Source of truth:** the exact extra params come from Task 1's spike findings. The params below (`ver`, `cpn`, and watchtime `cmt`/`st`/`et`/`state`) are what the spike snippet used; if the spike confirmed a different set, update both the test and the implementation to match before committing.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { appendParams, buildPlaybackPingUrl, buildWatchtimePingUrl } from '../../src/engine/pingUrl';

const BASE = 'https://www.youtube.com/api/stats/playback?ns=yt&el=detailpage&docid=ID&ei=XYZ';
const WT_BASE = 'https://www.youtube.com/api/stats/watchtime?ns=yt&el=detailpage&docid=ID&ei=XYZ';

describe('appendParams', () => {
  it('preserves existing params and adds new ones', () => {
    const out = new URL(appendParams(BASE, { ver: 2, cpn: 'CPN16CHAR' }));
    expect(out.searchParams.get('docid')).toBe('ID');
    expect(out.searchParams.get('ver')).toBe('2');
    expect(out.searchParams.get('cpn')).toBe('CPN16CHAR');
  });
});

describe('buildPlaybackPingUrl', () => {
  it('adds ver and cpn', () => {
    const out = new URL(buildPlaybackPingUrl(BASE, 'CPN16CHAR'));
    expect(out.searchParams.get('ver')).toBe('2');
    expect(out.searchParams.get('cpn')).toBe('CPN16CHAR');
  });
});

describe('buildWatchtimePingUrl', () => {
  it('reports a near-full watch via cmt/st/et', () => {
    const out = new URL(buildWatchtimePingUrl(WT_BASE, 'CPN16CHAR', 212));
    expect(out.searchParams.get('cpn')).toBe('CPN16CHAR');
    expect(out.searchParams.get('cmt')).toBe('212');
    expect(out.searchParams.get('st')).toBe('0');
    expect(out.searchParams.get('et')).toBe('212');
    expect(out.searchParams.get('state')).toBe('playing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/pingUrl.test.ts`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/pingUrl.ts

export function appendParams(baseUrl: string, params: Record<string, string | number>): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function buildPlaybackPingUrl(baseUrl: string, cpn: string): string {
  return appendParams(baseUrl, { ver: 2, cpn });
}

export function buildWatchtimePingUrl(baseUrl: string, cpn: string, durationSeconds: number): string {
  return appendParams(baseUrl, {
    ver: 2,
    cpn,
    cmt: durationSeconds,
    st: 0,
    et: durationSeconds,
    state: 'playing',
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/pingUrl.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/pingUrl.ts tests/engine/pingUrl.test.ts
git commit -m "feat: add playback/watchtime ping URL builders"
```

---

## Task 7: Player-response extraction + `fetchTrackingUrls`

**Files:**
- Create: `src/engine/playerResponse.ts`, `src/engine/playerApi.ts`
- Test: `tests/engine/playerResponse.test.ts`, `tests/engine/playerApi.test.ts`

- [ ] **Step 1: Write the failing test for balanced-JSON extraction**

```ts
// tests/engine/playerResponse.test.ts
import { describe, it, expect } from 'vitest';
import { extractJsonObject, extractPlayerResponse } from '../../src/engine/playerResponse';

describe('extractJsonObject', () => {
  it('extracts a balanced object after a marker, ignoring braces in strings', () => {
    const text = 'foo var ytInitialPlayerResponse = {"a":1,"b":{"c":"}{"}}; more';
    const obj = JSON.parse(extractJsonObject(text, 'ytInitialPlayerResponse'));
    expect(obj).toEqual({ a: 1, b: { c: '}{' } });
  });
  it('throws when the marker is absent', () => {
    expect(() => extractJsonObject('nothing here', 'ytInitialPlayerResponse')).toThrow();
  });
});

describe('extractPlayerResponse', () => {
  it('parses playbackTracking and lengthSeconds from page HTML', () => {
    const html = '<script>var ytInitialPlayerResponse = ' + JSON.stringify({
      playbackTracking: {
        videostatsPlaybackUrl: { baseUrl: 'https://www.youtube.com/api/stats/playback?docid=ID' },
        videostatsWatchtimeUrl: { baseUrl: 'https://www.youtube.com/api/stats/watchtime?docid=ID' },
      },
      videoDetails: { lengthSeconds: '212' },
    }) + ';</script>';
    const pr = extractPlayerResponse(html);
    expect(pr.playbackTracking.videostatsPlaybackUrl.baseUrl).toContain('/api/stats/playback');
    expect(pr.videoDetails.lengthSeconds).toBe('212');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/playerResponse.test.ts`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Write `src/engine/playerResponse.ts`**

```ts
// src/engine/playerResponse.ts

/** Extract the first balanced `{...}` object that appears after `marker`. */
export function extractJsonObject(text: string, marker: string): string {
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) throw new Error(`marker not found: ${marker}`);
  const start = text.indexOf('{', markerIdx);
  if (start === -1) throw new Error(`no object after marker: ${marker}`);

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced object');
}

export interface PlayerResponse {
  playbackTracking: {
    videostatsPlaybackUrl: { baseUrl: string };
    videostatsWatchtimeUrl: { baseUrl: string };
  };
  videoDetails?: { lengthSeconds?: string };
}

export function extractPlayerResponse(html: string): PlayerResponse {
  return JSON.parse(extractJsonObject(html, 'ytInitialPlayerResponse')) as PlayerResponse;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/playerResponse.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for `fetchTrackingUrls`**

```ts
// tests/engine/playerApi.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fetchTrackingUrls } from '../../src/engine/playerApi';

function htmlWith(pb: string, wt: string, len: string): string {
  return 'x var ytInitialPlayerResponse = ' + JSON.stringify({
    playbackTracking: {
      videostatsPlaybackUrl: { baseUrl: pb },
      videostatsWatchtimeUrl: { baseUrl: wt },
    },
    videoDetails: { lengthSeconds: len },
  }) + '; y';
}

describe('fetchTrackingUrls', () => {
  it('fetches the watch page and returns tracking URLs + duration', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve(htmlWith('https://yt/api/stats/playback?docid=ID', 'https://yt/api/stats/watchtime?docid=ID', '212')),
    });
    const out = await fetchTrackingUrls('ID', fakeFetch as unknown as typeof fetch);
    expect(fakeFetch).toHaveBeenCalledWith('https://www.youtube.com/watch?v=ID', { credentials: 'include' });
    expect(out.playbackUrl).toContain('/api/stats/playback');
    expect(out.watchtimeUrl).toContain('/api/stats/watchtime');
    expect(out.lengthSeconds).toBe(212);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/engine/playerApi.test.ts`
Expected: FAIL — module/exports missing.

- [ ] **Step 7: Write `src/engine/playerApi.ts`**

```ts
// src/engine/playerApi.ts
import { extractPlayerResponse } from './playerResponse';

export interface TrackingUrls {
  playbackUrl: string;
  watchtimeUrl: string;
  lengthSeconds: number;
}

export async function fetchTrackingUrls(
  videoId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TrackingUrls> {
  const res = await fetchImpl(`https://www.youtube.com/watch?v=${videoId}`, { credentials: 'include' });
  const html = await res.text();
  const player = extractPlayerResponse(html);
  const pt = player.playbackTracking;
  return {
    playbackUrl: pt.videostatsPlaybackUrl.baseUrl,
    watchtimeUrl: pt.videostatsWatchtimeUrl.baseUrl,
    lengthSeconds: Number(player.videoDetails?.lengthSeconds ?? 0),
  };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/engine/playerApi.test.ts`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add src/engine/playerResponse.ts src/engine/playerApi.ts tests/engine/playerResponse.test.ts tests/engine/playerApi.test.ts
git commit -m "feat: extract player response and fetch tracking URLs"
```

---

## Task 8: `markWatchedViaPings` engine + `markWatched` interface

**Files:**
- Create: `src/engine/types.ts`, `src/engine/pingEngine.ts`, `src/engine/index.ts`
- Test: `tests/engine/pingEngine.test.ts`

- [ ] **Step 1: Create `src/engine/types.ts`**

```ts
// src/engine/types.ts
export interface MarkResult {
  ok: boolean;
  error?: string;
}

export type MarkWatched = (videoId: string) => Promise<MarkResult>;
```

- [ ] **Step 2: Write the failing test for the engine**

```ts
// tests/engine/pingEngine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { markWatchedViaPings } from '../../src/engine/pingEngine';

function watchPageHtml(): string {
  return 'x var ytInitialPlayerResponse = ' + JSON.stringify({
    playbackTracking: {
      videostatsPlaybackUrl: { baseUrl: 'https://www.youtube.com/api/stats/playback?docid=ID&ei=E' },
      videostatsWatchtimeUrl: { baseUrl: 'https://www.youtube.com/api/stats/watchtime?docid=ID&ei=E' },
    },
    videoDetails: { lengthSeconds: '100' },
  }) + '; y';
}

describe('markWatchedViaPings', () => {
  it('fetches the page, then fires playback before watchtime, and resolves ok', async () => {
    const calls: string[] = [];
    const fakeFetch = vi.fn((url: string) => {
      calls.push(url);
      if (url.includes('/watch?v=')) return Promise.resolve({ ok: true, text: () => Promise.resolve(watchPageHtml()) });
      return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') });
    });
    const res = await markWatchedViaPings('ID', { fetch: fakeFetch as unknown as typeof fetch });
    expect(res.ok).toBe(true);
    const pbIdx = calls.findIndex((u) => u.includes('/api/stats/playback'));
    const wtIdx = calls.findIndex((u) => u.includes('/api/stats/watchtime'));
    expect(pbIdx).toBeGreaterThan(-1);
    expect(wtIdx).toBeGreaterThan(pbIdx); // ordering: playback before watchtime
    expect(calls[pbIdx]).toContain('cpn=');
  });

  it('returns ok:false when the playback ping is not ok', async () => {
    const fakeFetch = vi.fn((url: string) => {
      if (url.includes('/watch?v=')) return Promise.resolve({ ok: true, text: () => Promise.resolve(watchPageHtml()) });
      if (url.includes('/api/stats/playback')) return Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') });
    });
    const res = await markWatchedViaPings('ID', { fetch: fakeFetch as unknown as typeof fetch });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('403');
  });

  it('returns ok:false on a thrown error', async () => {
    const fakeFetch = vi.fn(() => Promise.reject(new Error('network down')));
    const res = await markWatchedViaPings('ID', { fetch: fakeFetch as unknown as typeof fetch });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('network down');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/engine/pingEngine.test.ts`
Expected: FAIL — module/exports missing.

- [ ] **Step 4: Write `src/engine/pingEngine.ts`**

```ts
// src/engine/pingEngine.ts
import { generateCpn } from './cpn';
import { fetchTrackingUrls } from './playerApi';
import { buildPlaybackPingUrl, buildWatchtimePingUrl } from './pingUrl';
import type { MarkResult } from './types';

export interface PingEngineDeps {
  fetch: typeof fetch;
}

export async function markWatchedViaPings(
  videoId: string,
  deps: PingEngineDeps = { fetch },
): Promise<MarkResult> {
  try {
    const { playbackUrl, watchtimeUrl, lengthSeconds } = await fetchTrackingUrls(videoId, deps.fetch);
    const cpn = generateCpn();
    const duration = lengthSeconds > 0 ? lengthSeconds : 1;

    const playbackRes = await deps.fetch(buildPlaybackPingUrl(playbackUrl, cpn), { credentials: 'include' });
    if (!playbackRes.ok) return { ok: false, error: `playback ping failed: ${playbackRes.status}` };

    const watchtimeRes = await deps.fetch(buildWatchtimePingUrl(watchtimeUrl, cpn, duration), { credentials: 'include' });
    if (!watchtimeRes.ok) return { ok: false, error: `watchtime ping failed: ${watchtimeRes.status}` };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/pingEngine.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Create `src/engine/index.ts` (binds the chosen implementation)**

```ts
// src/engine/index.ts
// Approach B (lightweight pings) is the default per the Task 1 spike.
// If the spike selected approach A, swap this binding for the background-tab engine.
import { markWatchedViaPings } from './pingEngine';
import type { MarkWatched } from './types';

export const markWatched: MarkWatched = (videoId) => markWatchedViaPings(videoId);
export type { MarkResult, MarkWatched } from './types';
```

- [ ] **Step 7: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/engine/types.ts src/engine/pingEngine.ts src/engine/index.ts tests/engine/pingEngine.test.ts
git commit -m "feat: compose markWatched engine behind swappable interface"
```

---

## Self-Review (completed by plan author)

**Spec coverage (Plan 1 portion):**
- Native-write mechanism + spike → Task 1, Tasks 5–8. ✓
- `markWatched(videoId)` swappable interface → Task 8 (`types.ts`, `index.ts`). ✓
- Approach B detail (player response → tracking URLs → cpn → playback then watchtime) → Tasks 5–8. ✓
- Page-scope gating + videoId extraction → Tasks 3–4. ✓
- Tech stack (TS + esbuild + Vitest) + dev workflow → Task 2. ✓
- Approach A, thumbnail detection, button injection, optimistic styling, storage, observer, toast, logged-out UI, concurrency → **deferred to Plan 2** (depend on live DOM captured in Task 1, Step 5) — explicitly out of scope here.

**Placeholder scan:** No TBD/TODO. Task 6's "source of truth" note is an empirical-reconciliation instruction (concrete code is provided), not a placeholder.

**Type consistency:** `MarkResult` / `MarkWatched` (types.ts) used consistently in `pingEngine.ts` and `index.ts`. `TrackingUrls` fields (`playbackUrl`, `watchtimeUrl`, `lengthSeconds`) match between `playerApi.ts` and `pingEngine.ts`. `fetchImpl`/`deps.fetch` typed as `typeof fetch` throughout. Builder names (`buildPlaybackPingUrl`, `buildWatchtimePingUrl`, `appendParams`) consistent between Task 6 and Task 8.

---

## Plan 2 preview (written after Task 1)

Once the spike confirms the engine and yields the live overlay DOM, Plan 2 will cover: thumbnail detection (anchor scan + `extractVideoId` + dedupe attribute), button injection into the native hover overlay (matched styling), optimistic red-bar styling + `chrome.storage.local`, `MutationObserver` + `yt-navigate-finish` re-application, the error toast + logged-out detection, the click-queue concurrency control, and the manual cross-surface test checklist. If the spike selected approach A, Plan 2 also adds the service worker + `tabs` permission + watch-page playback content script.
