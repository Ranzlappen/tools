# Video Studio

> Reverse, boomerang, trim, and re-encode video — all in the browser,
> powered by ffmpeg.wasm.

## What it does

Drop a video file in, pick a mode (boomerang, reverse, palindrome),
optionally trim and adjust audio, then export as MP4 or WebM. Nothing
leaves your machine — the entire ffmpeg pipeline runs in WebAssembly.
The wasm core lazy-loads on first run so the dashboard's first-paint
budget is untouched.

## User guide

### Features

- **Modes** — *boomerang* (forward + reverse), *reverse-only*, or
  *palindrome* (held endpoints).
- **Trim** — start/end timestamps with dual range sliders.
- **Audio** — drop, keep forward (silence-padded for boomerang /
  palindrome), or reverse with the video.
- **Speed** — 0.25× to 4× via `setpts` plus chained `atempo` for the
  extremes.
- **Quality preset** — low / medium / high → CRF 30 / 23 / 18.
- **Output format** — MP4 (H.264 + AAC, faststart) or WebM (VP9 +
  Opus, row-mt).
- **Loop count** — 1× / 2× / 3× via filter-graph split + concat.
- **Drag-and-drop** with metadata preview (filename, size, duration,
  resolution, MIME).
- **Per-stage progress**, elapsed timer, ffmpeg log mirror, cancel.

### How to use it

1. **Drop a video file** onto the drop zone (or click to pick).
2. Pick a **mode**, a **format**, and optional **trim** points.
3. (Optional) Tune **audio**, **speed**, **quality**, and **loops**.
4. Click **Render**. Watch the per-stage progress.
5. **Download** the result, or **Reset** to start over.

### Privacy

100% local. ffmpeg.wasm runs in a worker; no upload, no telemetry.
The ffmpeg modules and wasm core are fetched from a version-pinned CDN
(unpkg) on first run — the CDN sees only those static file requests,
never your video.

## Developer guide

### File layout

- `index.html` — drop zone, metadata preview, controls panel, render
  log, export buttons.
- `tool.js` — file pickup, `buildArgs()` filter graph builder, ffmpeg
  worker lifecycle, progress wiring, export.

### Dependencies

Version-pinned and dynamically `import()`-ed from unpkg on first run.
These are ES modules loaded via `import()` (and the wasm core via
`util.toBlobURL`), so they carry **no SRI** — dynamic imports can't, the
same precedent as the pdf.js worker in the markdown tool. The version
constants live at the top of `tool.js` (`FF_VER`, `UTIL_VER`,
`CORE_VER`).

- `@ffmpeg/ffmpeg@0.12.10` — JS wrapper.
- `@ffmpeg/util@0.12.1` — helpers (`fetchFile`, `toBlobURL`).
- `@ffmpeg/core@0.12.6` — wasm core. Uses `core-mt` (multi-threaded)
  when the page is `crossOriginIsolated` and `SharedArrayBuffer` is
  available; falls back to single-threaded `core` otherwise.

A same-origin module-worker shim re-imports the cross-origin worker so
its relative imports resolve against unpkg (see the comments around the
worker setup in `tool.js`).

### Extending

- **New mode:** add a field to the state, a new switch arm in
  `buildArgs()`, and a control in `index.html`. The filter graph is
  centralized so additions only touch one function.
- **New codec:** swap the output codec block in `buildArgs()` (a
  single isolated section). When `core` ships av1/hevc, only that
  block needs updating.

### Limitations

- WebM with audio re-encoding can be slow on lower-end hardware.
- ffmpeg.wasm has no GPU access — large 4K files take real time.
- Output `URL.createObjectURL` results are revoked on reset / new file
  selection; if you keep your own reference, revoke it yourself.
