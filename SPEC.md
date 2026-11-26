# SPEC — YouTube Mark as Watched

> The single spec. It describes what the extension **should** do. To change behaviour, change this file
> first, then the code and tests. Acceptance criteria are numbered (e.g. `B3`); refer to them from tests
> and commit messages.

## 1. Goal

A Chrome (MV3) extension that adds a "Mark as watched" button to YouTube thumbnails. Clicking it writes the
video to the **user's native YouTube watch history** (server-side state: syncs across devices, shows up in
`/feed/history`, gets YouTube's red progress bar on thumbnails). It is not a local overlay and keeps no
local database.

## 2. Scope

| Active | Not active |
| --- | --- |
| Home `/` | Search `/results` |
| Subscriptions `/feed/subscriptions` | Shorts (`/shorts/` links) |
| Channel pages `/@…` `/channel/…` `/c/…` `/user/…` | Ad cards |
| Watch-page sidebar `/watch` | Every other path |
| Playlists `/playlist` (incl. Watch Later `list=WL`) | |
| History `/feed/history` | |
| The You page `/feed/you` | |

## 3. Behaviour (acceptance criteria)

**Button**
- **B1** Every link to `/watch?v=<id>` that contains a thumbnail image gets one button, placed inside the
  `<a>` (its top-left corner is the thumbnail's; moving the button out to the parent broke sizing and
  placement). One button per link; if a YouTube re-render
  drops it, the next scan puts it back. When SPA navigation leaves the scope (e.g. to search), injected
  buttons and bars are removed (nodes such as the inline preview survive across pages).
- **B2** The button is hidden until the thumbnail is hovered (or keyboard focus is inside the thumbnail
  link); `aria-label="Mark as watched"`. Position: top-left, a 40px circle (same size as the inline
  preview's native buttons); thumbnails ≤ 300px wide (e.g. the watch-page sidebar) get a 28px button. The
  inline preview (`ytd-video-preview`) that covers a hovered thumbnail must show the button too.
- **B3** New thumbnails from infinite scroll and SPA navigation (`yt-navigate-finish`) get buttons too, via
  a MutationObserver: one scan 250ms after the first relevant change, and further changes do not postpone
  it (History changes every 250ms, which starves a debounce). A change is relevant when it adds an element
  other than `<script>`, `<style>`, `<link>`, `<meta>`, `<noscript>` or our own UI (History inserts a
  `<script>` every 250ms; rescanning for that is wasted work), or when an undecorated link's `href` becomes
  a watch URL without any node being added.
- **B4** No button on ad cards (an outer `ytd-rich-item-renderer` or `yt-lockup-view-model` containing
  `ad-badge-view-model`), on links that aren't thumbnails (e.g. titles), or on a playlist's header cover
  (`ytd-playlist-header-renderer`: it links to the first video but stands for the whole playlist).

**Click**
- **C1** Signed out (the masthead shows a sign-in link) → toast "Sign in to mark videos as watched", no
  requests.
- **C2** Signed in → immediately show a full red progress bar on the thumbnail and switch the button to its
  done state (optimistic), then write native history in the background. The bar mimics YouTube's own: 4px
  high, YouTube's red (`var(--yt-sys-color-baseline--static-brand-red, #f03)`), inside the thumbnail element
  (`yt-thumbnail-view-model`, falling back to the `<a>`) where the native bar lives, so it gets the
  thumbnail's width and rounded corners. (Unwatched thumbnails have no native bar to reuse; YouTube only
  renders one when it has progress data.) The `<a>` is often bigger than the thumbnail (12px bottom padding
  on Home/Subscriptions/channels, 16px right on History, 12px right in the watch sidebar), so a bar spanning
  the `<a>` lands outside it. No bar inside the inline preview (`ytd-video-preview`): its link has no
  thumbnail box (height 0), and the preview covers the thumbnail that does get the bar; the button still
  switches to done.
- **C3** Write fails → remove the bar, reset the button, toast "Couldn’t mark as watched".
- **C4** Clicks on a video whose request is still in flight are ignored.
- **C5** The red bar lasts for the current page view only; it is not re-applied after a reload, where
  YouTube's own progress bar takes over.
- **C6** YouTube reuses cards and the inline preview (it swaps `href`, not the node): the video ID is read
  from the link's **current** `href` at click time, and when `href` changes the bar and button follow the
  new video. Thumbnails of a marked video that appear later get the same state (all thumbnails of one
  video agree).

## 4. Write mechanism (verified on a real account by the 2026-05-30 spike)

YouTube has no public API for writing watch history (Data API v3 has not supported the `HL` list since
2016), so the extension replays the player's reports. Everything is
`fetch(..., { credentials: 'include' })` from the content script (`/watch` is same-origin; pings go to
`s.youtube.com`, whose CORS allows credentialed requests from `www.youtube.com`):

1. `GET /watch?v=<id>` and extract the object assigned in `ytInitialPlayerResponse = {…}` (match the
   assignment, not the first mention of the name). Read `playbackTracking.videostatsPlaybackUrl.baseUrl`,
   `videostatsWatchtimeUrl.baseUrl` and `videoDetails.lengthSeconds`.
2. Generate a 16-character `cpn` (alphabet `A-Za-z0-9-_`).
3. Playback ping: `playbackUrl + ver=2&cpn=<cpn>&cmt=0`.
4. Split `0→duration` into about 4 segments and send a watchtime ping for each:
   `ver=2&cpn&cmt=<et>&st&et&state=playing`; the **last** one has `state=paused&final=1` (commits the
   watched position).
5. Any non-2xx response (including the `/watch` page in step 1) → failure.
6. Tracking URLs must be `https://` on `youtube.com` or a subdomain; otherwise send nothing and fail (§6).

Known facts:
- A single instant ping → a history entry but only a ~10% progress bar; segments + `final=1` → 100%.
- No real waiting is needed between segments; they can be sent back to back.
- History updates with a delay (tens of seconds), which is why feedback is optimistic.
- `lengthSeconds` is whole seconds (e.g. 50 for a 50.03s video), so the last ping can stop just short of
  the end; YouTube still shows a full bar.
- Premieres and upcoming streams have no `playbackTracking` and end in C3.

Known limits (not detectable from the page):
- A 2xx response means YouTube accepted the ping, not that it was recorded. If the user has **paused watch
  history**, nothing is recorded but the click still reports success.
- C1's signed-out check is a heuristic; if it misses, the same false success happens.

## 5. Non-goals

A settings page, bulk marking, Shorts or search support, local persistence, cross-browser builds,
automated E2E against live YouTube.

## 6. Constraints and risks

- Depends on YouTube's undocumented endpoints and DOM (old `ytd-*` and new `yt-*-view-model` components
  coexist), which can change at any time.
- This automation is against YouTube's Terms of Service; it's for personal use and the user accepts that.
- Least privilege: no `permissions` or `host_permissions`; the content script only matches
  `https://www.youtube.com/*` (MV3 content-script requests run as the page under CORS and don't use
  extension host permissions, see §4). No data is collected or sent anywhere but YouTube.

## 7. Engineering

- Stack: WXT (Vite) + TypeScript + Vitest + Biome (lint/format), Bun as package manager; GitHub Actions
  runs `check` and `build`.
- `src/entrypoints/content/`: entry `index.ts` + `style.css` (injected via the manifest by WXT). The WXT
  `ctx` manages the lifecycle: when the extension is reloaded or updated and this script is invalidated, it
  stops observing and removes its buttons and bars so the new script can re-inject them.
  `src/page` (scope), `src/dom` (find / inject / scan scheduling), `src/engine` (write mechanism; only
  `markWatched(videoId): Promise<{ ok; error? }>` is public), `src/ui` (toast).
- Pure logic (`page`, `dom`, `engine`) must have unit tests; `tests/` mirrors `src/`; Vitest uses the
  `WxtVitest()` plugin.

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies (runs `wxt prepare`) |
| `bun run dev` | Dev build to `.output/chrome-mv3-dev`, reloads the extension on change (if it reports "Reloaded: content" but nothing changes, click ↻ in `chrome://extensions`) |
| `bun run build` | Production build to `.output/chrome-mv3` |
| `bun run zip` | Release zip |
| `bun run test` | Unit tests (not `bun test`) |
| `bun run format` | Biome format and safe fixes |
| `bun run check` | Lint + typecheck + tests (same as CI; run before committing) |

Releasing: bump `version` in `package.json` → commit → `git tag -a v<version> -m v<version>` (must be an
annotated tag; `--follow-tags` doesn't push lightweight tags) → `git push --follow-tags`. GitHub Actions
(`release.yml`) checks the tag matches the version, runs `check`, then publishes the `bun run zip` output
as a GitHub Release.

## 8. Manual acceptance (in a real, signed-in Chrome; Claude in Chrome can run it)

1. Home, Subscriptions, a channel page, the watch-page sidebar, a playlist (incl. Watch Later), History and
   the You page: hovering shows the button (B1, B2); search shows none.
2. After scrolling down, new cards have buttons too (B3).
3. Click an unwatched short video: the red bar appears immediately (C2); about a minute later it is in
   `/feed/history`.
4. Click a premiere: the bar disappears and the failure toast shows (C3).

> Step 3 writes real watch history; ask the user before running it.
