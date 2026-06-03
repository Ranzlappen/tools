# Video Studio

> Trim, reverse, resize, crop, rotate, colour-grade and re-encode video —
> export video, GIF, PNG frames or audio, all in the browser, powered by
> ffmpeg.wasm.

## What it does

Drop a video file in, pick what to make — a trimmed/converted clip, a
boomerang, a GIF, a single PNG frame, a whole PNG frame-sequence, or just
the audio — then layer on resize, crop, rotate/flip, a colour preset, a
fade and frame-rate changes. A frame-perfect trim shows exact frame
numbers and snaps to frame boundaries. Nothing leaves your machine — the
entire ffmpeg pipeline runs in WebAssembly. The wasm core lazy-loads on
first run so the dashboard's first-paint budget is untouched.

## User guide

### Features

- **Modes** — *trim & convert* (default, no reversing), *boomerang*
  (forward + reverse), *reverse-only*, or *palindrome* (held endpoints).
- **Output type** — Video (MP4/WebM), **GIF**, a single **Frame · PNG**, a
  **PNG frame-sequence**, or **Audio · m4a**.
- **Scale** — keep original or resize to 1080p / 720p / 480p
  (`scale=-2:<h>`, aspect-preserving, even dimensions).
- **Crop aspect** — centred 1:1 / 9:16 / 16:9 via `crop='min(…)':'…'`.
- **Rotate / Flip** — 90° CW/CCW or 180° (`transpose`), horizontal or
  vertical (`hflip` / `vflip`).
- **Colour preset** — warm / cool / vivid (`eq` + `colorbalance`),
  grayscale (`hue=s=0`), sepia (`colorchannelmixer`).
- **Fade** — in and out, 0–3 s, on both video (`fade`) and kept audio
  (`afade`), placed against the final retimed duration.
- **Output FPS** — keep original or resample to 15 / 24 / 30 / 60
  (`fps`).
- **Frame-perfect trim** — set the **source FPS** (or let it be detected
  from ffmpeg's input log) and the trim window shows
  `frame A → B (N f)`. Trim snaps to frame boundaries, and ◀/▶ buttons
  nudge each endpoint by exactly one frame.
- **Frame export** — *Frame · PNG* grabs the still at the trim-in point;
  *Frames · PNG set* extracts a sequence across the trim window at a chosen
  rate (every frame / every 2nd / every 5th / 1 per second), shown as a
  thumbnail gallery with per-frame download and **Download all (.zip)**.
- **Audio** — drop, keep forward (silence-padded for boomerang /
  palindrome), or reverse with the video. Audio-only export is AAC/m4a.
- **Speed** — 0.25× to 4× via `setpts` plus chained `atempo` for the
  extremes.
- **Quality preset** — low / medium / high → CRF 30 / 23 / 18.
- **Output format** — MP4 (H.264 + AAC, faststart) or WebM (VP9 +
  Opus, row-mt).
- **Loop count** — 1× / 2× / 3× via filter-graph split + concat (GIF
  loops on playback instead).
- **Drag-and-drop** with metadata preview (filename, size, duration,
  resolution, frame rate, MIME).
- **Per-stage progress**, elapsed timer, ffmpeg log mirror, cancel.

### How to use it

1. **Drop a video file** onto the drop zone (or click to pick).
2. Choose a **mode** and an **output type**. The controls that don't
   apply to that output hide themselves.
3. (Optional) Set **scale / crop / rotate / flip**, a **colour preset**,
   **fade**, **output FPS**, **speed**, **quality**, **format**, **audio**
   and **loops**.
4. For frame-accurate work, set the **Source FPS** (or run once and let it
   be detected), then use the ◀/▶ buttons or type frame-snapped trim
   points. Watch the `frame A → B` readout.
5. Click **Process**. Watch the per-stage progress.
6. **Download** the result (or per-frame / zip for a sequence), or
   **Reset** to start over.

### Examples

- **Quick clip:** *Trim & convert* + MP4 + trim points → a re-encoded cut,
  no reversing.
- **Square social GIF:** output *GIF* + crop *1:1* + scale *720p* +
  colour *vivid*.
- **Thumbnail:** output *Frame · PNG* — grabs the still at trim-in.
- **Contact sheet:** output *Frames · PNG set* + rate *1 / sec* → a gallery
  you can zip.
- **Strip the audio:** output *Audio · m4a*.

### Privacy

100% local. ffmpeg.wasm runs in a worker; no upload, no telemetry.
The ffmpeg modules and wasm core (and the optional zip helper) are fetched
from a version-pinned CDN (unpkg) on first use — the CDN sees only those
static file requests, never your video.

## Developer guide

### File layout

- `index.html` — drop zone, metadata preview, the Options panel
  (Transform / Frame / Look / Encode sub-sections), render log, export
  area.
- `tool.js` — file pickup, frame-perfect helpers, `buildArgs()` and its
  per-output builders, the ffmpeg worker lifecycle, frame-sequence
  collection/gallery, progress wiring, export.

### DOM hooks

- Option chips carry `data-opt`/`data-value`; one delegated click handler
  sets `state[opt]`, so new chip groups need no new wiring. `loops` and
  `fpsSrcPick` are special-cased; `output` also triggers
  `applyOutputVisibility()`.
- Each option block has a stable id (`opt-<name>-block`) so
  `applyOutputVisibility()` can show/hide whole groups per output type.
  Note: `.opt { display:flex }` overrides the `hidden` attribute, so
  visibility is toggled via inline `style.display`.
- Trim: `#trim-in/-out` (numbers), `#trim-in-r/-out-r` (ranges),
  `#trim-window` (frame readout), `#trim-*-prev/next` (frame nudge).
- Frame rate: `#fps-src` (number) + `data-opt="fpsSrcPick"` presets;
  `#m-fps` shows `fps · frames`.

### Dependencies

Version-pinned and dynamically `import()`-ed from unpkg on first use.
These are ES modules loaded via `import()` (and the wasm core via
`util.toBlobURL`), so they carry **no SRI** — dynamic imports can't, the
same precedent as the pdf.js worker in the markdown tool. The version
constants live at the top of `tool.js` (`FF_VER`, `UTIL_VER`,
`CORE_VER`, and the `CDN.fflate` URL).

- `@ffmpeg/ffmpeg@0.12.10` — JS wrapper.
- `@ffmpeg/util@0.12.1` — helpers (`fetchFile`, `toBlobURL`).
- `@ffmpeg/core@0.12.6` — wasm core. Uses `core-mt` (multi-threaded)
  when the page is `crossOriginIsolated` and `SharedArrayBuffer` is
  available; falls back to single-threaded `core` otherwise.
- `fflate@0.8.2` — tiny zip helper, lazy-loaded **only** when
  *Download all (.zip)* is clicked; falls back to per-frame downloads if
  it can't load.

A same-origin module-worker shim re-imports the cross-origin worker so
its relative imports resolve against unpkg (see the comments around the
worker setup in `tool.js`).

### Extending

The filter model is a **hybrid**:

- **Mode and loop** stages are a labelled-pad graph (`split`/`reverse`/
  `concat`) — they genuinely need a graph.
- **Everything else** (crop → scale → rotate → flip → colour → fps →
  setpts → fade) is a **linear, comma-joined segment** built by
  `geometryColorSegment()` and spliced between the mode and loop stages.
  To add a linear filter, push one string into that array — order is
  geometry first, then look.

`buildArgs()` branches early per output type into `buildFrameArgs()`,
`buildFramesArgs()` and `buildAudioArgs()`; GIF reuses the video graph but
terminates into a single-pass `split,palettegen,paletteuse` palette
pipeline. New codecs swap only the codec block at the end of `buildArgs()`.

**Source FPS** is user-set (with quick-picks) because HTML5 video metadata
exposes no frame rate, and eagerly probing via ffmpeg.wasm would defeat the
lazy-load budget. It is best-effort auto-corrected by parsing the
`…, NN fps, …` line from ffmpeg's input log on the first run
(`maybeDetectFps`).

### Limitations

- **No speed-ramp mode yet** — gradual `setpts` time-expressions are
  fragile in the wasm core and don't retime audio cleanly.
- **Frame counts are derived** from `round(duration × fps)`, so they're
  exact only when the source FPS is correct; variable-frame-rate sources
  can drift.
- **GIF and heavy colour ops are slow** on the single-thread core
  (production is not cross-origin isolated). GIF defaults to 15 fps when
  *Output FPS* is *Original* and drops audio.
- **Frame-sequence memory** is capped — at most 200 frames are read back
  and shown from one run (the warning tells you how many were produced).
- **Audio export is AAC/m4a** — `libmp3lame` is usually absent from
  `@ffmpeg/core`, so MP3 is not offered.
- WebM with audio re-encoding can be slow on lower-end hardware; ffmpeg.wasm
  has no GPU access, so large 4K files take real time.
- Output / frame `URL.createObjectURL` results are revoked on reset / new
  file selection; if you keep your own reference, revoke it yourself.
