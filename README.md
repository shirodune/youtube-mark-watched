# YouTube Mark as Watched

[![Latest release](https://img.shields.io/github/v/release/shirodune/youtube-mark-watched)](https://github.com/shirodune/youtube-mark-watched/releases/latest)
[![Download](https://img.shields.io/badge/download-chrome.zip-blue)](https://github.com/shirodune/youtube-mark-watched/releases/latest/download/youtube-mark-watched-chrome.zip)

A Chrome extension that adds a **Mark as watched** button to YouTube thumbnails.

One click writes the video to your **real YouTube watch history**: it shows up in
[History](https://www.youtube.com/feed/history), gets YouTube's own red progress bar and syncs to your
other devices.

Other "mark as watched" extensions, such as [Watchmarker](https://github.com/sniklaus/youtube-watchmarker), keep their own local list and just grey out
thumbnails. This one records the view in your YouTube account instead.

<p align="center"><img src=".github/screenshot.png" alt="The eye button on a hovered YouTube thumbnail" width="371"></p>

## Features

- An eye button on each thumbnail, shown when you hover over it (or focus it with Tab).
- Works on Home, Subscriptions, channel pages, the watch-page sidebar, playlists (including Watch Later),
  History and the You page. Not on search results or Shorts.
- Shows a red bar right away. YouTube can take up to a minute to update History; after a reload its own
  progress bar takes over.
- No permissions, no account, no servers. It only talks to YouTube, using the session you're already
  signed in with.

## Install

It isn't on the Chrome Web Store; install it from a release:

1. Download [youtube-mark-watched-chrome.zip](https://github.com/shirodune/youtube-mark-watched/releases/latest/download/youtube-mark-watched-chrome.zip)
   from the [latest release](https://github.com/shirodune/youtube-mark-watched/releases/latest) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder.

Unpacked extensions don't update themselves. To update, delete the old folder, put the newly unzipped one
at the same path and click ↻ on the extension's card.

Or build from source with [Bun](https://bun.sh):

```bash
git clone https://github.com/shirodune/youtube-mark-watched.git
cd youtube-mark-watched
bun install
bun run build   # then load .output/chrome-mv3
```

## How it works

YouTube has no API for writing watch history. When you play a video, the player reports progress to
YouTube's stats endpoints. The extension sends the same reports for the video you clicked, as if you had
watched it to the end. The full mechanism is in [SPEC.md](SPEC.md) (in Chinese).

## Limitations

- You must be signed in to YouTube.
- Premieres and upcoming streams can't be marked: YouTube has no playback data for them yet.
- It relies on YouTube's undocumented endpoints and page layout, so a YouTube update can break it.
- Automating playback reports goes against YouTube's Terms of Service. It's meant for personal use; use it
  at your own risk.

## Development

```bash
bun install
bun run dev     # build to .output/chrome-mv3-dev; load that folder once, then it reloads on save
bun run check   # lint + typecheck + tests
```

## License

[MIT](LICENSE)
