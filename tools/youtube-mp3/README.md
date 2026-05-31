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
- **Sign in with Google (optional)** — pull your **Liked videos** or any of
  your playlists without exporting cookies. See the section below.
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

### Sign in with Google (optional)

Your **Liked videos** list is private, so yt-dlp normally needs your sign-in
cookies to read it — painful on a phone with stock Chrome. But the *videos
inside* the list are public, so there's a cleaner route: sign in **read-only**,
let the tool list the video IDs via the YouTube Data API, and download them
**without any cookies**.

1. Click **Sign in with Google** and approve read-only access. The access token
   lives in this page's memory only — it is never stored or sent anywhere but
   Google's own API.
2. Pick **👍 Liked videos** or any of your playlists, then **Load videos**.
3. Click **urls.txt** to save the URL list, and **Copy** the command. Run both
   in the same folder:

   ```
   yt-dlp -a urls.txt -x --audio-format mp3 --audio-quality 320K \
     -f bestaudio/best --embed-thumbnail --embed-metadata -o '%(title)s.%(ext)s'
   ```

No `--cookies` needed. Age-restricted or members-only items are the exception —
those still need real cookies; combine the **Private / sign-in cookies** option
with the loaded list for them.

**Limitations of the sign-in flow**

- In **Testing mode** (the default for a personal Google Cloud project),
  consent **expires every ~7 days**, so you'll re-sign-in roughly weekly until
  the app is verified. There's also a 100-user cap before verification.
- The access token lasts about an hour — fine, since we fetch immediately.
- Private/deleted entries in a list can't be downloaded cookie-free and are
  skipped (the status line reports how many). Expand **Skipped videos** to see
  their IDs or download `skipped.txt`; YouTube no longer exposes their titles,
  but the IDs can be looked up via an archive such as filmot.com.

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

By default the page contacts no server — it only builds a string from your
inputs. The URL you paste is not fetched, stored, or logged. Your cookies are
read by yt-dlp **on your own machine** (the browser or a `cookies.txt` you
supply); they never touch this site.

The **one exception is the optional "Sign in with Google"**: if you use it, the
page talks to Google's identity and YouTube Data APIs (read-only) to list your
playlists. The OAuth access token is held in memory for the session only —
never written to storage, never sent anywhere but Google. Don't sign in and
nothing leaves the page.

## Legal & responsible use

This tool only **builds a `yt-dlp` command** — it downloads nothing itself and
uploads nothing. You are solely responsible for how you use the command. Only
download content you own, created, or are licensed or permitted to use.
Downloading from YouTube may violate its
[Terms of Service](https://www.youtube.com/t/terms), and copying copyrighted
material without permission may be unlawful where you live. This is **not legal
advice**.

On first visit the tool asks you to acknowledge this once (stored locally in
your browser). See the site
[disclaimer](https://ranzlappen.com/disclaimer/) for the full terms.

## Developer guide

### File layout

- `index.html` — form: URL input, options panel (selects + chip toggles),
  the live command panel, and platform install snippets. One scoped
  `<style>` block (prefix `ytm-`).
- `tool.js` — `buildTokens()` assembles a typed token list, `shq()`
  shell-quotes values, `render()` paints both the copy string
  (`dataset.command`) and the highlighted HTML. Presets, visibility, and the
  optional account flow (sign-in → populate playlists → load videos →
  `urls.txt`) live alongside. When a list is loaded, the command targets
  `-a urls.txt` instead of the single URL.
- `yt-oauth.js` — the *only* networked module. Wraps Google Identity Services
  (OAuth token flow, no secret) and a few read-only YouTube Data API v3 calls.
  Holds the `CLIENT_ID` constant and keeps the access token in memory.

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
| `#yt-account` / `#yt-signin` / `#yt-playlist` / `#yt-load` | Optional account panel. |
| `#yt-using` / `#yt-download-urls` | "Using N videos" note + `urls.txt` download. |
| `[data-action]`     | `paste` / `clear` / `copy` / `yt-signin` / `yt-signout` / `yt-load` / `yt-download-urls` / `yt-clear-list`. |

### Dependencies

Vanilla JS only — no libraries, no bundler, no backend. String building plus
the Clipboard API. The optional account flow lazy-loads Google Identity
Services (`accounts.google.com/gsi/client`) on first use and calls the YouTube
Data API v3 (`www.googleapis.com`) read-only; both load only if you sign in.

### Owner setup (for the sign-in flow)

The Google sign-in needs a one-time OAuth client in **your** Google account; the
client ID is then pasted into `CLIENT_ID` in `yt-oauth.js` (it is a public
identifier — safe to commit; the authorized-origins list locks it to this
domain). If `CLIENT_ID` is left blank the tool still works — the Sign-in button
just shows a setup hint.

1. [Google Cloud Console](https://console.cloud.google.com/) → new project →
   enable **YouTube Data API v3**.
2. **OAuth consent screen** (External): add scope
   `.../auth/youtube.readonly`, then add the Google accounts that may sign in
   as **Test users**. (Testing mode needs no verification but expires consent
   every ~7 days; full verification lifts that and the 100-user cap.)
3. **Credentials → Create OAuth client ID → Web application**. Under
   **Authorized JavaScript origins** add `https://tools.ranzlappen.com` (and
   `http://localhost:8000` for local testing).
4. Paste the client ID into `CLIENT_ID` in `yt-oauth.js`.

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
