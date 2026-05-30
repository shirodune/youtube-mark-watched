# Chrome Web Store submission checklist

## Build the package

```
npm run package
```

This builds `dist/` and produces `youtube-mark-watched-v<version>.zip` at the repo root.
Upload that `.zip` in the Developer Dashboard.

## Before submitting

- [ ] Bump `version` in `manifest.json` and `package.json` if this is an update.
- [ ] Run `npm test` and `npm run build` — both clean.
- [ ] Load the unpacked `dist/` once more and smoke-test on YouTube.
- [ ] Register as a Chrome Web Store developer (one-time US$5 fee) at
      https://chrome.google.com/webstore/devconsole

## Store listing fields

- **Name:** YouTube Mark as Watched
- **Summary (≤132 chars):** Add a button to YouTube thumbnails that marks a video as watched in your real YouTube history.
- **Category:** Productivity
- **Language:** English
- **Screenshots:** at least one 1280×800 (or 640×400) PNG/JPEG. Capture a YouTube feed with
  the button visible on a thumbnail (hover state) and, ideally, a marked video.
- **Icon:** 128×128 (already included in the package as `icons/icon128.png`).

## Permissions justification (reviewers require these)

- **`host_permissions: *://*.youtube.com/*`** — The extension only runs on YouTube. It needs
  to (a) inject the content script that adds the button to thumbnails, and (b) make
  same-origin requests to YouTube's playback-tracking endpoints to record the video as
  watched in the signed-in user's own history. No other sites are accessed.
- No `storage`, `tabs`, `scripting`, or remote-host permissions are requested.

## Privacy / data use

- **Data collected:** none. The extension does not collect, transmit, or store any user
  data. It has no external server and no analytics.
- **What it does with data:** it reads the video ID from the thumbnail the user clicks and
  sends YouTube's own playback pings to YouTube using the user's existing session cookies.
  Nothing leaves YouTube.
- Complete the Dashboard's **Privacy practices** tab accordingly (single purpose:
  "mark YouTube videos as watched"; no data collection).

## Disclosure to keep in mind

The extension uses YouTube's internal endpoints to write watch history. Automating
interactions can conflict with YouTube's Terms of Service; this is a personal-use tool.
Mention the single, narrow purpose clearly in the listing to aid review.
