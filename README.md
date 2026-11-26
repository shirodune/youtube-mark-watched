# YouTube Mark as Watched

A Chrome extension that adds a **Mark as watched** button to YouTube thumbnails.

One click writes the video to your **real YouTube watch history**: it shows up in
[History](https://www.youtube.com/feed/history), gets YouTube's own red progress bar and syncs to your
other devices.

Other "mark as watched" extensions, such as Watchmarker, keep their own local list and just grey out
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

There's no Chrome Web Store release; build it from source. You need [Bun](https://bun.sh).

```bash
git clone https://github.com/shirodune/youtube-mark-watched.git
cd youtube-mark-watched
bun install
bun run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick
`.output/chrome-mv3`.

To update: `git pull`, `bun install`, `bun run build`, then click ↻ on the extension's card.

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
bun run dev     # build to .output/chrome-mv3-dev; load that folder once, then it reloads on save
bun run check   # lint + typecheck + tests
```

## License

[MIT](LICENSE)
