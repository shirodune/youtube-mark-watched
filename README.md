# YouTube Mark as Watched

A Chrome extension that adds a **"Mark as watched"** button to YouTube video thumbnails.
Click it, and the video is recorded in your **real, native YouTube watch history** — the
same state YouTube tracks when you actually watch something (it syncs across devices and
influences recommendations).

Unlike other "mark as watched" extensions that only grey out thumbnails with a local
database, this writes to your genuine account history.

## Features

- One-click **Mark as watched** button on thumbnails — appears on hover, styled to match YouTube.
- Writes to **native** YouTube watch history (not a local overlay).
- Instant optimistic feedback (a red bar) on click; YouTube's own state takes over after reload.
- Works on the **home feed, Subscriptions, channel pages, and the watch-page sidebar** (skips search).
- No account creation, no external servers — everything runs in your browser using your existing signed-in session.

## How it works

YouTube has no public API to mark a video watched. When you watch a video, YouTube's player
reports progress to its internal tracking endpoints (`/api/stats/playback` and
`/api/stats/watchtime`). This extension replicates that sequence for the clicked video — it
fetches the watch page to obtain the per-video tracking URLs, generates a client playback
nonce (`cpn`), then sends the playback ping followed by progressive watch-time pings — so
YouTube records the video as watched, exactly as if you had played it.

The full mechanism (and the feasibility spike that proved it) is documented in
[`docs/superpowers/spikes/2026-05-30-native-history-spike.md`](docs/superpowers/spikes/2026-05-30-native-history-spike.md).

## Install (unpacked, for development)

1. `npm install`
2. `npm run build` — outputs the built extension to `dist/`
3. Open `chrome://extensions`, enable **Developer mode** (top-right)
4. Click **Load unpacked** and select the `dist/` folder
5. Open YouTube (signed in), hover a thumbnail, and click the eye button

After rebuilding, click the **↻ reload** icon on the extension card and refresh the YouTube tab.

## Development

| Command | What it does |
| --- | --- |
| `npm run build` | Bundle the extension into `dist/` (esbuild) |
| `npm test` | Run the unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run package` | Build, then zip `dist/` into an uploadable `.zip` for the Chrome Web Store |

## Packaging for the Chrome Web Store

1. Run `npm run package` — produces `youtube-mark-watched-v<version>.zip` at the repo root.
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Create a new item and upload the `.zip`.
4. Complete the store listing (description, screenshots, category, privacy practices).
5. Submit for review.

See [`docs/CHROME_WEB_STORE.md`](docs/CHROME_WEB_STORE.md) for a submission checklist, including
the permission and privacy justifications reviewers ask for.

## Project structure

```
src/
  content.ts          # content-script entry: scans thumbnails, injects the button, handles clicks
  page/pageScope.ts   # which pages to run on + videoId extraction
  dom/
    thumbnails.ts     # find thumbnail anchors (skips ads/shorts/title links)
    decorate.ts       # inject the button + apply the watched bar
    styles.ts         # injected CSS
  engine/             # the markWatched() engine that writes native history
  ui/toast.ts         # failure toast
tests/                # Vitest unit tests
icons/                # extension icons (16/48/128)
docs/                 # spec, implementation plans, spike findings, Web Store checklist
build.mjs             # esbuild build script
```

## Notes & limitations

- **You must be signed in** to YouTube — the extension uses your existing session.
- **Upcoming / premiere** videos can't be marked (they have no playback data yet) and show a brief "Couldn't mark" toast.
- It relies on YouTube's internal, undocumented endpoints and DOM, so a future YouTube change could break it.
- Automating interactions this way is technically against YouTube's Terms of Service. It is intended for personal use; use at your own discretion.

## License

[MIT](LICENSE)
