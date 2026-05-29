# Spike: Native watch-history write — findings

- **Date:** 2026-05-30
- **Question:** Can a content-script fire YouTube's playback-tracking pings (approach B) to create a real native watch-history entry — and a "watched" progress bar — without playing the video?
- **Verdict:** **YES. Approach B confirmed and sufficient. Approach A (background-tab playback) is NOT needed.**

## What was tested

Run against the user's real, logged-in YouTube via Claude-in-Chrome, on test video
`jNQXAC9IVRw` ("Me at the zoo", 19s). Baseline: video was not in history.

Sequence executed from a `youtube.com` page context (same-origin, `credentials: 'include'`):
1. `fetch('/watch?v=ID')` → extract `ytInitialPlayerResponse` → read
   `playbackTracking.videostatsPlaybackUrl` / `videostatsWatchtimeUrl` + `videoDetails.lengthSeconds`.
2. Generate a 16-char `cpn`.
3. Fire the playback + watchtime pings with `cpn` appended.

## Results

- All pings returned **HTTP 204** (success).
- The video **did appear in native watch history** (confirmed visually by the user and via DOM
  query for `a[href*="jNQXAC9IVRw"]`).
- **Propagation is not instant** — the history feed/bar took a short time (tens of seconds) to
  reflect the write. (Validates the design's optimistic-styling decision.)
- **Progress-bar fidelity depended on how watchtime was reported:**
  - A single instant ping (`cmt=19, st=0, et=19, state=playing`) → history entry but only a
    **10%** progress bar.
  - **Progressive** pings — playback (`cmt=0`) then watchtime segments covering `0→duration`
    (`[0,5] [5,10] [10,15] [15,19]`), last one with `state=paused` + `final=1` → **100%**
    watched progress bar (fully-watched look).

## Confirmed working recipe (for the engine)

1. `GET videostatsPlaybackUrl + &ver=2&cpn=<cpn>&cmt=0`
2. For each segment in `0→duration` (≈4 segments): `GET videostatsWatchtimeUrl + &ver=2&cpn=<cpn>&cmt=<et>&st=<st>&et=<et>&state=playing`
3. Final watchtime ping: `state=paused` + `final=1` (this commits the watched position).
- No real-time delay between pings is required — they were fired back-to-back and still credited 100%.

## DOM findings for Plan 2 (important — YouTube migrated components)

The watch-history page renders video items with YouTube's **new** web components, not the
legacy `ytd-video-renderer` / `ytd-thumbnail-overlay-resume-playback-renderer`:

- Video item lockup: `yt-lockup-view-model`
- Progress bar overlay: `yt-thumbnail-overlay-progress-bar-view-model`
  (classes `ytThumbnailOverlayProgressBarHost ytThumbnailOverlayProgress`)
- Watched-progress fill: a `div.ytThumbnailOverlayProgressBarHostWatchedProgressBar...`
  whose inner segment div carries `style="width: <pct>%"`.

Both legacy `ytd-*` and new `yt-*-view-model` structures may appear (rollout/A-B in progress),
so Plan 2's thumbnail detection, button injection, and optimistic styling must handle **both**.
The hover-overlay buttons ("Add to queue" / "Watch later") also no longer use
`ytd-thumbnail-overlay-toggle-button-renderer`; Plan 2 needs a fresh hover-based DOM capture to
find the current injection point.

## Decision

- Ship **approach B** with the progressive-watchtime recipe above.
- Update Plan 1 Task 6 (ping URL builders) and Task 8 (engine) to send progressive segments + a
  final commit ping, instead of one instant ping.
- Drop approach A from the near-term plan; the `tabs` permission is not required for v1.
