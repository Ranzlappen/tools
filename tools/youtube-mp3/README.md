# YouTube MP3 Studio

> Build the exact `yt-dlp` command for max-quality MP3 — single videos, full
> playlists, even private playlists. Runs entirely in your browser.

> **This builds a command — it does not download anything here.** You run the
> generated `yt-dlp` command on your own machine. Only download content you
> have the rights to, and respect copyright and YouTube's Terms of Service.

## What it does

A web page can't rip YouTube on its own: browsers can't fetch YouTube's
streams (CORS) or decipher its signatures, and a private playlist needs
*your* sign-in cookies, which must never be sent to a server. The legitimate,
de-facto tool for the job is [yt-dlp](https://github.com/yt-dlp/yt-dlp). This
studio is a friendly front-end for it: pick your options and it assembles the
precise command to paste into a terminal — max-quality audio, MP3 conversion,
embedded cover art and tags, whole playlists, and private-playlist
authentication, all handled by yt-dlp locally.

## User guide

### Features

- **Audio format & quality** — MP3 (up to 320 kbps or VBR V0/V2), M4A, Opus,
  or "best" to keep the source codec. Always pulls `bestaudio/best`.
- **Embed options** — cover-art thumbnail, metadata (title/artist), and
  chapters baked into the file; optional SponsorBlock removal,
  ASCII-safe filenames, and a download archive to skip already-grabbed items.
- **Scope** — a single video (`--no-playlist`) or a whole playlist
  (`--yes-playlist`), with an optional item range like `1-10` or `1,3,5-8`.
- **Output template** — a sensible default per scope, fully editable.
- **Private / sign-in cookies** — `--cookies-from-browser` (desktop) or
  `--cookies cookies.txt` (Android / anywhere). Cookies stay on your machine.
- **Presets** — *Max-quality MP3*, *Whole playlist → MP3*, *Private playlist*.
- **Parallel fragments** for faster downloads.
- **Copy** the finished command in one click; **install snippets** for every
  platform including Android (Termux).

### How to use it

1. Paste a video or playlist URL.
2. Pick a preset, or tweak the options to taste.
3. For a private playlist, choose a cookie source under
   **Private / sign-in cookies**.
4. Click **Copy** and run the command in your terminal. (Install yt-dlp +
   ffmpeg first — see the snippets at the bottom of the tool.)

### Examples

Max-quality MP3 of a single video with cover art and tags:

```
yt-dlp -x --audio-format mp3 --audio-quality 320K -f bestaudio/best \
  --embed-thumbnail --embed-metadata --no-playlist \
  -o '%(title)s.%(ext)s' 'https://www.youtube.com/watch?v=…'
```

Whole private playlist, signed in via your local Chrome:

```
yt-dlp -x --audio-format mp3 --audio-quality 320K -f bestaudio/best \
  --embed-thumbnail --embed-metadata --yes-playlist \
  --cookies-from-browser chrome \
  -o '%(playlist_title)s/%(playlist_index)02d - %(title)s.%(ext)s' \
  'https://www.youtube.com/playlist?list=…'
```

### Privacy

The page never contacts YouTube or any server — it only builds a string from
your inputs. The URL you paste is not fetched, stored, or logged. Your
cookies are read by yt-dlp **on your own machine** (the browser or a
`cookies.txt` you supply); they never touch this site. (The in-app help modal
you may have opened to read this is the only network request the page makes.)

## Developer guide

### File layout

- `index.html` — form: URL input, options panel (selects + chip toggles),
  the live command panel, and platform install snippets. One scoped
  `<style>` block (prefix `ytm-`).
- `tool.js` — `buildTokens()` assembles a typed token list, `shq()`
  shell-quotes values, `render()` paints both the copy string
  (`dataset.command`) and the highlighted HTML. Presets and visibility live
  alongside.

### Key DOM hooks

| Selector            | Role                                              |
| ------------------- | ------------------------------------------------- |
| `#yt-url`           | Video / playlist URL.                             |
| `#yt-presets`       | Preset chip group (`data-preset`).                |
| `#yt-options`       | Options panel; delegates `input` / `change`.      |
| `#yt-format` / `#yt-quality` | Audio format and MP3 quality selects.    |
| `#yt-embed`         | Boolean chip toggles (`data-flag`, `aria-pressed`).|
| `#yt-scope` / `#yt-items` | Playlist scope and item range.              |
| `#yt-auth` / `#yt-browser` / `#yt-cookiefile` | Cookie source.        |
| `#yt-output`        | `-o` filename template.                           |
| `#yt-command`       | `<pre>` output; `dataset.command` holds raw text. |
| `[data-action]`     | `paste` / `clear` / `copy`.                       |

### Dependencies

Vanilla JS only — no libraries, no CDN, no backend. String building plus the
Clipboard API.

### Extending

- **Add a flag**: push a `{ t, s }` token inside `buildTokens()`; toggles
  belong in the `#yt-embed` chip group with a `data-flag`.
- **New preset**: add a function to the `PRESETS` map and a chip in
  `#yt-presets`.
- **More formats / qualities**: extend the `<option>`s; the value is passed
  straight to `--audio-format` / `--audio-quality`.

### Limitations / gotchas

- It **generates a command** — it does not download. yt-dlp and ffmpeg must
  be installed locally (ffmpeg is required for MP3 extraction).
- Quoting targets POSIX shells (bash/zsh, Termux, macOS). On Windows
  `cmd.exe`, swap single quotes for double quotes if a path misbehaves;
  PowerShell generally accepts the single-quoted form.
- `--cookies-from-browser` can't read system Chrome on non-rooted Android —
  use a `cookies.txt` there.
- YouTube changes often; if a download fails, update yt-dlp
  (`yt-dlp -U` or via your package manager) before anything else.
