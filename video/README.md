# Video Studio

> Trim, reverse, resize, crop, rotate, colour-grade and re-encode video —
> export video, GIF, PNG frames or audio, all in the browser, powered by
> ffmpeg.wasm.

## What it does

Drop a video file in, pick what to make — a trimmed/converted clip, a
boomerang, a GIF, a single PNG frame, a whole PNG frame-sequence, just
the audio, or **two clips joined** into one (with an optional transition) —
then layer on resize, crop, rotate/flip, a colour preset, a fade and
frame-rate changes. A deep **Compress** section lets you change
container/codec, pick CRF or target-bitrate rate control, dial the encoder
effort, cap the audio bitrate, and even **drop frames** (keep every 2nd,
every 3rd, every 4th) as a brute-force size reduction. A live **estimated
output size** updates as you change settings, an optional **two-pass**
encode hits a target bitrate accurately, and after each run a
**before/after** panel shows exactly how much you saved. A frame-perfect
trim shows exact frame numbers and snaps to frame boundaries. Nothing
leaves your machine — the entire ffmpeg pipeline runs in WebAssembly. The
wasm core lazy-loads on first run so the dashboard's first-paint budget is
untouched.

## User guide

### Features

- **Modes** — *trim & convert* (default, no reversing), *boomerang*
  (forward + reverse), *reverse-only*, *palindrome* (held endpoints), or
  *join two clips* (append a second video, with an optional transition).
- **Join two clips** — pick *Join two clips* as the mode, drop a **second
  video** into the panel that appears, and the second clip is appended after
  the first into one file. Choose a **transition** — hard cut (default), a
  crossfade, fade through black/white, dissolve, wipe (4 directions), slide,
  circle open/close, radial, pixelize or smooth — and its **length** (0.1–3 s,
  auto-capped to the shorter clip). The two clips are normalised onto a shared
  canvas (from the **Scale** chip, or clip A's size) so mismatched
  resolutions, aspect ratios and frame rates join cleanly; the whole result is
  re-encoded with the usual **format / quality / compress** controls. Set
  **Audio** to *Keep* to carry both clips' sound (crossfaded when a transition
  is used) — if a clip has no audio track, use *Drop*.
- **Output type** — Video (MP4/WebM), **GIF**, a single **Frame · PNG**, a
  **PNG frame-sequence**, or **Audio · m4a**.
- **Scale** — keep original or resize to 1080p / 720p / 480p / 360p / 240p
  (`scale=-2:<h>`, aspect-preserving, even dimensions). Smaller scales are
  one of the biggest single wins for file size.
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
- **Output format · codec** — MP4 (H.264 + AAC, faststart), MKV (H.264 +
  AAC), MOV (H.264 + AAC, faststart), WebM (VP9 + Opus), or WebM (VP8 +
  Opus). The container's extension drives the muxer.

#### Compress

- **Quality preset** — tiny / low / medium / high / near-lossless seed the
  CRF slider (CRF 36 / 30 / 23 / 18 / 12).
- **Rate control** — *Quality · CRF* (constant-quality, variable size) or
  *Target bitrate* (you set the kbps; CRF is ignored). For VP9, CRF mode is
  true constant-quality (`-b:v 0`); for VP8 the bitrate field acts as a
  ceiling alongside the CRF.
- **CRF slider** — 0–51 fine control (lower = better quality, bigger file).
  Hand-setting it drops the preset highlight. Clamped per codec (H.264 ≤ 51,
  VP8/VP9 ≤ 63).
- **Encoder effort** — H.264 `-preset` (ultrafast … veryslow); for VP8/VP9
  it maps to `-cpu-used` 8…0. Slower = smaller for the same quality.
- **Frame drop** — keep every 2nd / 1-of-3 / 1-of-4 frame
  (`select=not(mod(n\,N))`) with `-fps_mode vfr`, so frames are physically
  removed (same clip length, fewer frames, real bytes saved) rather than
  resampled. Video output only.
- **Two-pass** — in *Target bitrate* mode, run a real two-pass encode
  (analyse, then encode) so the output lands much closer to the requested
  bitrate. Costs ~2× the encode time; off by default.
- **Audio bitrate** — 64k / 96k / 128k / 192k / 256k for the encoded audio
  track (AAC or Opus) and for audio-only m4a export.
- **Estimated output size** — a live `≈ size` readout in the Run panel,
  recomputed on every change from resolution, rate control, frame rate,
  frame drop and duration. *Target bitrate* is labelled `(target)` — it's the
  size implied by the requested bitrate (single-pass ABR lands near it,
  two-pass closer); CRF is a `(rough estimate)` from a bits-per-pixel model.
- **Before / after** — the result panel reports original vs output size and
  the percent saved (or gained), so the win is visible at a glance.
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
- **Shrink for sharing:** scale *480p* + *Quality · CRF* ~28 + encoder
  effort *slow* + audio *128k* → a much smaller MP4 that still looks fine.
- **Aggressive size cut:** scale *360p* + frame drop *Every 2nd* + quality
  *tiny* → tiny file, choppier motion (the brute-force route).
- **Hit a size target:** *Target bitrate* mode + e.g. *800* kbps → output
  tracks roughly that video bitrate regardless of content.
- **Stitch two clips:** mode *Join two clips* → drop clip B → transition
  *Crossfade* at *0.5 s* → one MP4 with a smooth blend between them.
- **Simple append:** mode *Join two clips* → transition *None* → the two
  clips play back to back, no blend.

### Privacy

100% local. ffmpeg.wasm runs in a worker; no upload, no telemetry.
The ffmpeg modules and wasm core (and the optional zip helper) are fetched
from a version-pinned CDN (unpkg) on first use — the CDN sees only those
static file requests, never your video.

## Developer guide

### File layout

- `index.html` — drop zone, metadata preview, a second drop zone +
  transition controls (shown only in *Join* mode), the Options panel
  (Transform / Join / Frame / Look / Encode / Compress / Trim sub-sections),
  render log, export area.
- `tool.js` — file pickup (primary + second clip), frame-perfect helpers,
  `buildArgs()` and its per-output builders, `buildJoinArgs()` for the
  two-clip path, the ffmpeg worker lifecycle, frame-sequence
  collection/gallery, progress wiring, export.

### DOM hooks

- Option chips carry `data-opt`/`data-value`; one delegated click handler
  sets `state[opt]`, so new chip groups need no new wiring. `loops` and
  `fpsSrcPick` are special-cased; `output` also triggers
  `applyOutputVisibility()`.
- Each option block has a stable id (`opt-<name>-block`) so
  `applyOutputVisibility()` can show/hide whole groups per output type.
  Note: `.opt { display:flex }` overrides the `hidden` attribute, so
  visibility is toggled via inline `style.display` (`showBlock()`).
- The compress group (`COMPRESS_BLOCKS`) shows only for video output
  (audio output keeps just the audio-bitrate chip). Within video,
  `updateRateVisibility()` shows the CRF slider or the bitrate field
  depending on the **Rate control** chip.
- CRF/bitrate/effort hooks: `#crf` (range, mirrored to `#crf-hint`),
  `#bitrate` (number), `#opt-preset` (select). A `quality` chip seeds
  `state.crf` and the slider; dragging the slider clears the preset chips.
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
pipeline. **Join** is a separate two-input path (`buildJoinArgs()`): each clip
runs the shared crop/rotate/flip/colour look, then
`setpts=PTS-STARTPTS,scale,pad,setsar=1,fps,format=yuv420p` normalises both
onto one canvas (`joinCanvas()`), and the two are combined with either
`concat` (hard cut) or `xfade`/`acrossfade` (transition, offset =
`durationA − length`, clamped by `joinTransDur()`). It reuses the shared
`appendVideoCodec()` tail — the same codec/rate-control block `buildArgs()`
emits — so the join output honours every format/quality/compress control.
`run()` writes both inputs (`in…`/`inb…`) and dispatches to the join path when
`state.mode === "join"`. The codec block at the end is driven by the `FORMATS` map
(`{ ext, vcodec, acodec, faststart }`) — to add a container/codec, add an
entry and a `format` chip; H.264 uses `-preset`, libvpx uses `-cpu-used`
(via `VPX_CPU`). Rate control reads `state.rateMode` (`-crf` vs `-b:v`),
clamped by `clampCrf()` / `clampBitrate()`. **Frame drop** is a linear
`select` filter (`frameDropFilter()`) unshifted to the front of the linear
segment, paired with `-fps_mode vfr` so the dropped frames are not padded
back to CFR.

**Two-pass** (bitrate mode only) is driven by an `opts.pass` argument to
`buildArgs()`: pass 1 drops audio and discards output through the null
muxer (`-f null /dev/null`, which needs no seekable file — unlike the MP4
muxer), both passes share `-passlogfile ff2pass`, and `run()` executes the
two argvs back to back, deleting the `ff2pass-0.log*` files afterwards. The **size estimate** (`estimateBytes()`
/ `updateEstimate()`, with `bppForCrf()` for the CRF path) is pure UI — it
never touches ffmpeg — and is refreshed from `updateTrimWindow()` plus the
chip/slider handlers. The **before/after** panel is built in
`renderOutput()` from `state.file.size` vs the result blob size.

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
  `@ffmpeg/core`, so MP3 is not offered. The format list is limited to the
  codecs the core ships (H.264, VP8, VP9); H.265/AV1 are not built in.
- **VP8 CRF needs a ceiling** — libvpx VP8 has no pure constant-quality
  mode, so in CRF mode the *Target bitrate* value is used as an upper
  bound. For predictable VP8 sizing, use *Target bitrate* mode.
- **Frame drop + Output FPS conflict** — setting a non-original Output FPS
  resamples after the drop, which re-fills frames and negates the saving.
  Use one or the other.
- **MKV/MOV may not preview in-page** — some browsers can't play the MKV
  container inline; the result still downloads correctly.
- **Join re-encodes and normalises** — the two clips are always scaled/padded
  onto a shared canvas and fully re-encoded, so joining is not a lossless
  stream-copy; a portrait clip joined onto a landscape canvas is letterboxed
  (and vice versa). Transition length is capped to the shorter clip, and
  **Keep audio** needs both clips to have an audio track (otherwise use
  *Drop*). Trim, speed, loops, fade and the per-clip reverse modes don't apply
  in join mode.
- **Size estimate is approximate** — the CRF estimate uses a generic
  bits-per-pixel model and ignores scene complexity, so it can be off by a
  fair margin on very flat or very busy footage. The *Target bitrate* figure
  reflects the requested bitrate (single-pass ABR can still overshoot or
  undershoot it; two-pass tracks it more closely). It also folds in the audio
  bitrate whenever audio is kept, even if the source has no audio track. GIF /
  PNG outputs aren't estimated.
- **Two-pass is bitrate-only** — it has no effect in CRF mode and roughly
  doubles encode time; it writes a transient rate-control log to the
  in-memory FS that is cleaned up after the run.
- WebM with audio re-encoding can be slow on lower-end hardware; ffmpeg.wasm
  has no GPU access, so large 4K files take real time.
- Output / frame `URL.createObjectURL` results are revoked on reset / new
  file selection; if you keep your own reference, revoke it yourself.
