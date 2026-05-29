# YouTube "Mark as Watched" Extension — Design

- **Date:** 2026-05-30
- **Status:** Approved (brainstorming complete; ready for implementation planning)
- **Author:** shirodune + Claude

## 1. Goal

A Chrome extension that adds a button to YouTube video thumbnails. Clicking it marks
that video as watched in the user's **real, native YouTube watch history** —
server-side state tied to the Google account that produces the red progress bar under
thumbnails, syncs across devices, and influences recommendations. It is **not** a
local-only visual overlay.

## 2. Key decisions

| Decision | Choice |
| --- | --- |
| Watched semantics | Real, native YouTube watch history (server-side) |
| Surfaces | Home feed, Subscriptions (`/feed/subscriptions`), Channel pages, watch-page sidebar |
| Excluded surfaces | Search results (`/results`), Shorts |
| Click feedback | Optimistic — apply watched styling instantly, write native history in background |
| Button appearance | Third sibling alongside the native hover-overlay buttons (Add to queue / Watch later), matching their look |
| Native-write mechanism | Spike-driven: validate lightweight pings (B) empirically; fall back to background-tab playback (A). Both kept behind one swappable interface. |
| Tech stack | TypeScript + esbuild/Vite build + Vitest |

## 3. Background / constraints (confirmed by research)

- **No official API path.** YouTube Data API v3 cannot write to watch history. Since
  2016 the history (`HL`) and watch-later (`WL`) playlists return empty via the API and
  there is no insert method.
  ([revision history](https://developers.google.com/youtube/v3/revision_history))
- **Native "watched" state is written only by playback tracking.** The player hits
  `/api/stats/playback` first (session init) then `/api/stats/watchtime` (reports watch
  time), both keyed by a `cpn` client-playback-nonce. The pre-built tracking URLs live in
  the player response's `playbackTracking` object. Ordering: playback before watchtime.
  ([playback metrics](https://github.com/Xosrov/YouTube-Playback-Metrics),
  [ordering](https://github.com/Airkek/Youtube-Viewers/issues/128))
- **No prior art for native writes.** Existing "mark as watched" extensions
  (e.g. Watchmarker) are local-only — they keep their own database and grey out
  thumbnails, working even when signed out. None write to native history.
  ([Watchmarker](https://github.com/sniklaus/youtube-watchmarker))
- **ToS:** Both candidate mechanisms automate interactions in a way that is against
  YouTube's Terms of Service. For light personal use the practical risk is low but
  non-zero. The user has accepted this trade-off knowingly.

## 4. Non-goals (v1)

- No settings/options UI (no A/B toggle, no Shorts toggle, no dim toggle).
- No search-results or Shorts support.
- No automated E2E tests against live YouTube.
- No cross-browser build (Chrome / Manifest V3 only).
- No bulk "mark all" action — one video per click.

## 5. Architecture

Manifest V3 extension, loaded unpacked during development.

| Component | Runs in | Responsibility |
| --- | --- | --- |
| Content script | youtube.com pages | Detect thumbnails, inject the button, apply optimistic styling, handle SPA navigation + infinite scroll |
| Marking engine | content script (B) and/or service worker (A) | The swappable `markWatched(videoId)` module |
| Service worker | background | Orchestrates approach A (open/close hidden tab); routes messages |
| Storage (`chrome.storage.local`) | — | Records marked videoIds + status for de-dup and re-applying styling |

**Permissions:** `storage`; `host_permissions` for `*://*.youtube.com/*`; and `tabs`
(required because approach A is retained as a runtime fallback — see §7.3). If the spike
proves B reliable and we later decide to drop A entirely, `tabs` can be removed.

## 6. Data flow (on click)

1. Content script applies optimistic watched styling instantly and writes
   `{ videoId: marked }` to storage.
2. Content script calls `markWatched(videoId)` on the engine.
3. Engine writes native history → resolves `{ ok }` / `{ ok: false, error }`.
4. On failure → revert styling, show a small error toast, clear the storage entry.
5. On scroll / SPA navigation → a `MutationObserver` re-injects buttons and re-applies
   styling for any stored videoIds.

## 7. Detailed design

### 7.1 Thumbnail detection & button injection

- **Generic detection:** target thumbnail anchors linking to a watch URL
  (`a#thumbnail[href*="/watch?v="]`). This same anchor exists across the home/subs grid,
  channel grids, and the watch-page sidebar's compact cards, so one detector covers all
  chosen surfaces. Extract videoId from the href. Tag processed thumbnails with a `data-`
  attribute to avoid double-injection.
- **SPA-aware:** a `MutationObserver` (debounced) catches newly-loaded thumbnails;
  re-scan on YouTube's `yt-navigate-finish` event after in-app navigation.
- **Page gating:** active on home, `/feed/subscriptions`, channel pages
  (`/@handle`, `/channel/`, `/c/`, `/user/`), and `/watch` (sidebar). Skipped on
  `/results`.
- **Shorts excluded** (`/shorts/` links).
- **Button:** injected as a third sibling into the native thumbnail hover-overlay
  container, alongside "Add to queue" and "Watch later". Matches their size, shape,
  translucent background, and white line-icon weight, with a "Mark as watched" tooltip
  and proper `aria-label`. Hover-reveal is inherited from the native overlay. Switches to
  a filled/marked state once marked. Look is matched with our own CSS (not dependent on
  YouTube's internal class names); exact dimensions/icon verified against live markup
  during implementation.

### 7.2 Optimistic styling

- YouTube's native watched look is a thin red progress bar at the bottom of the
  thumbnail. On click we inject a matching full-width red bar plus a slight dim, styled to
  blend with the native look.
- The videoId is stored; the observer re-applies the style class wherever that thumbnail
  reappears (scroll, navigation) until a reload, after which YouTube's own native bar
  takes over (assuming the write succeeded).
- Already-watched (native bar present) or already-marked (in storage) thumbnails render
  the button in its marked state; re-clicking re-marks harmlessly.

### 7.3 Marking engine

Isolation boundary — upstream code only knows:

```ts
markWatched(videoId: string): Promise<{ ok: boolean; error?: string }>
```

A and B are interchangeable implementations behind this interface. Both are retained
(B as the default, A as the fallback); the spike decides which leads.

#### Approach B — lightweight pings (primary candidate)

Runs in the content script (same-origin with youtube.com → carries auth cookies and
correct `Sec-Fetch` headers automatically):

1. **Get tracking URLs** via InnerTube `POST /youtubei/v1/player` using the page's
   `INNERTUBE_API_KEY` + `context` (readable from `ytcfg`) and `{ videoId }`. Response's
   `playbackTracking` gives `videostatsPlaybackUrl` and `videostatsWatchtimeUrl`,
   pre-filled with most params.
2. **Generate `cpn`** — 16-char client nonce.
3. **Fire the `playback` ping first** (session init) with `cpn`.
4. **Fire the `watchtime` ping** with `cpn` + `cmt`/`st`/`et` set near the video's
   duration to report a (near-)full watch. Order matters — playback before watchtime.
5. Resolve `ok` if pings return 2xx.

#### Approach A — background-tab playback (fallback)

1. Content script messages the service worker with the videoId.
2. SW opens `https://www.youtube.com/watch?v=ID` in a background tab
   (`chrome.tabs.create { active: false }`).
3. A watch-page content script detects it was opened by us (flag/param), mutes the
   `<video>`, seeks to `duration - 1`, calls `play()`, waits ~1–2s so the real player
   fires its pings, then signals the SW.
4. SW closes the tab (`chrome.tabs.remove`).

Near-guaranteed native write because it is the genuine player; the seek fills the
progress bar.

#### Validation spike (first implementation step)

On the user's real, logged-in YouTube via Claude-in-Chrome:

1. Pick a throwaway video the user has not watched.
2. Run B's ping sequence for that videoId from the page console.
3. Reload `/feed/history` and check: (a) does the video appear in history; (b) does the
   thumbnail show the red progress bar.

Decision branches:

- B writes history + bar → ship B.
- B writes history but no bar → keep B (history is the goal); optionally tune watchtime
  params.
- B does nothing → fall back to A.

This writes to the user's real history, so it requires an explicit go-ahead at that
moment and uses a disposable test video.

### 7.4 Concurrency

Clicks are queued: serialized for A (one tab at a time), light concurrency for B. Never
hammer YouTube.

## 8. Error handling

- **Write fails** (bad ping response, A's tab errors or times out, InnerTube call fails)
  → revert optimistic styling, clear the storage entry, show a small non-intrusive toast.
  A times out after ~15 seconds if its watch-page script never signals done (tab is
  closed and the write reported as failed).
- **Logged-out** → native history is impossible; detect via `ytcfg`/auth state and show a
  clear message instead of silently succeeding.
- **HTTP-success-but-didn't-register:** B can return 2xx yet not log. Production cannot
  cheaply verify each write, so we trust the spike-validated mechanism.

## 9. Edge cases

- Shorts excluded; live/premieres (no real duration) handled gracefully or skipped;
  unavailable/members-only → fail + revert.
- Already-watched / already-marked → button shows marked state; re-click harmless.
- Same video in multiple thumbnails → storage is source of truth; styling applies to all
  instances of that videoId.
- Infinite scroll / SPA nav → debounced observer re-injects; injection fails gracefully
  (logs, no crash) if YouTube moves the overlay container.
- Rapid/double clicks → de-duped via storage + an in-flight set.

## 10. Testing

- **Unit (Vitest), no browser:** videoId extraction from href, `cpn` generation
  (length/charset), ping-URL construction, page-scope gating logic, storage de-dup logic.
- **Browser integration (Claude-in-Chrome):** button appears + matches native on each
  surface; optimistic styling; click → write; error/revert path; logged-out handling.
- **The spike is test #1** and de-risks the core mechanism before the UI is built.
- No automated E2E against live YouTube (brittle + ToS); a documented manual test
  checklist covers integration instead.

## 11. Tech stack & dev workflow

- TypeScript + esbuild or Vite build + Vitest.
- A build step is required because MV3 content scripts cannot use ES module `import`
  directly; bundling keeps the code in clean, focused, testable modules.
- `npm run build` → `dist/`; load unpacked from `dist/`; reload extension + refresh
  YouTube to test. Watch mode for iteration.

## 12. Implementation order (high level)

1. **Validation spike** — decide B vs A. (Requires user go-ahead; writes real history.)
2. Project scaffold: manifest, build, Vitest, module structure.
3. Marking engine (the spike-selected implementation; keep the interface and the other
   implementation as fallback).
4. Thumbnail detection + button injection (matched to native overlay).
5. Optimistic styling + storage + observer re-application.
6. Error handling, edge cases, toasts, logged-out detection.
7. Manual test checklist across all surfaces.

## 13. Risks & open questions

- **Core risk:** approach B may not register native history; mitigated by the spike-first
  order and the A fallback.
- **DOM fragility:** YouTube can change the hover-overlay container; mitigated by generic
  anchor detection, our-own-CSS, and graceful injection failure.
- **Internal-API fragility (B):** YouTube can change ping params/endpoints; mitigated by
  retaining A.
- **ToS:** accepted by the user for personal use.
