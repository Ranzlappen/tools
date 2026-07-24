/* Video Studio — trim / boomerang / reverse / palindrome, plus resize, crop,
   rotate, flip, colour presets, fade, fps and speed control. Exports video
   (mp4/webm), GIF, a single PNG frame, a PNG frame-sequence, or audio (m4a).
   Frame-perfect trim with a source-fps readout. Runs entirely in-browser via
   ffmpeg.wasm. */

// ─── pinned CDN versions ───────────────────────────────────────────────
const FF_VER = "0.12.10";
const UTIL_VER = "0.12.1";
const CORE_VER = "0.12.6";

const CDN = {
  ffmpegEsm: `https://unpkg.com/@ffmpeg/ffmpeg@${FF_VER}/dist/esm/index.js`,
  // The FFmpeg class's own orchestrator worker. Loaded via classWorkerURL
  // through classWorkerBlobURL() below — `new Worker()` rejects this
  // cross-origin unpkg URL directly even though fetch() of it succeeds.
  ffmpegWorker: `https://unpkg.com/@ffmpeg/ffmpeg@${FF_VER}/dist/esm/worker.js`,
  utilEsm: `https://unpkg.com/@ffmpeg/util@${UTIL_VER}/dist/esm/index.js`,
  // ESM core: the class worker runs as a module worker, so the core is pulled
  // in via `import(coreURL).default` (importScripts is unavailable there). That
  // needs the esm build's `export default`; the umd build has no default.
  coreSt: `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/esm`,
  coreMt: `https://unpkg.com/@ffmpeg/core-mt@${CORE_VER}/dist/esm`,
  // Lazy-loaded only when "Download all (.zip)" is clicked. Pinned ESM build.
  fflate: "https://unpkg.com/fflate@0.8.2/esm/browser.js",
};

// Quality presets map to a CRF starting point; the CRF slider can then be
// nudged from there. "tiny" leans on heavy frame loss, "lossless" is visually
// transparent (and large).
const QUALITY_CRF = { tiny: 36, low: 30, medium: 23, high: 18, lossless: 12 };
const CRF_MAX = { libx264: 51, "libvpx-vp9": 63, libvpx: 63 };
// libvpx (vp8/vp9) has no -preset; effort maps to -cpu-used (0 slow/best … 8 fast).
const VPX_CPU = {
  ultrafast: 8, superfast: 7, veryfast: 6, faster: 5, fast: 4,
  medium: 3, slow: 2, slower: 1, veryslow: 0,
};
// container + codec per format chip. h264 lives in mp4/mkv/mov; vp9/vp8 in webm.
const FORMATS = {
  mp4:        { ext: "mp4",  vcodec: "libx264",     acodec: "aac",     faststart: true },
  mkv:        { ext: "mkv",  vcodec: "libx264",     acodec: "aac",     faststart: false },
  mov:        { ext: "mov",  vcodec: "libx264",     acodec: "aac",     faststart: true },
  webm:       { ext: "webm", vcodec: "libvpx-vp9",  acodec: "libopus", faststart: false },
  "webm-vp8": { ext: "webm", vcodec: "libvpx",      acodec: "libopus", faststart: false },
};
// How many frames each "drop" mode keeps — keep 1 of every N (n % N === 0).
const FRAME_DROP_N = { d2: 2, d3: 3, d4: 4 };
const FRAME_CAP = 200; // most frames we read back / render from one sequence run
const MIME = {
  mp4: "video/mp4",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  webm: "video/webm",
  gif: "image/gif",
  png: "image/png",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
};

// ─── DOM ───────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const dropEl = $("#drop");
const fileEl = $("#file");
const metaEl = $("#meta");
const previewEl = $("#preview");
const engineTagEl = $("#engine-tag");
const stageLabelEl = $("#stage-label");
const stageTimeEl = $("#stage-time");
const progressFillEl = $("#progress-fill");
const logEl = $("#log");
const btnRun = $("#btn-run");
const btnCancel = $("#btn-cancel");
const outEl = $("#out");
const statusEl = $("#status");
const statusTextEl = $("#status-text");
const trimIn = $("#trim-in");
const trimOut = $("#trim-out");
const trimInR = $("#trim-in-r");
const trimOutR = $("#trim-out-r");
const trimWindow = $("#trim-window");
const optSpeed = $("#opt-speed");
const fpsSrcEl = $("#fps-src");
const fadeInEl = $("#fade-in");
const fadeOutEl = $("#fade-out");
const fadeHint = $("#fade-hint");
const mFpsEl = $("#m-fps");
const presetEl = $("#opt-preset");
const crfEl = $("#crf");
const crfHint = $("#crf-hint");
const bitrateEl = $("#bitrate");
const estSizeEl = $("#est-size");
// join mode: second source + transition controls
const secondSourceEl = $("#second-source");
const drop2El = $("#drop2");
const file2El = $("#file2");
const meta2El = $("#meta2");
const preview2El = $("#preview2");
const transitionSel = $("#opt-transition");
const transDurEl = $("#trans-dur");
const transDurRow = $("#trans-dur-row");
const transHint = $("#trans-hint");

// ─── state ─────────────────────────────────────────────────────────────
const state = {
  file: null,
  meta: null,             // { duration, width, height }
  fileB: null,            // second clip (join mode)
  metaB: null,            // { duration, width, height } for the second clip
  preview2URL: null,      // active object URL for the second-clip preview
  mode: "trim",           // trim | boomerang | reverse | palindrome | join
  transition: "none",     // join transition: none | xfade name (fade, wipeleft, …)
  transDur: 0.5,          // join transition duration in seconds
  output: "video",        // video | gif | frame | frames | audio
  loops: 1,               // 1 | 2 | 3
  audio: "drop",          // drop | keep | reverse
  speed: 1,
  quality: "medium",      // preset that seeds the CRF slider
  crf: 23,                // active CRF (quality-rate-control value)
  rateMode: "crf",        // crf | bitrate
  bitrate: 1000,          // target video bitrate in kbps (bitrate mode)
  twopass: "off",         // off | on — two-pass encode in bitrate mode
  preset: "veryfast",     // x264 -preset / mapped to vpx -cpu-used
  framedrop: "none",      // none | d2 | d3 | d4 — keep 1 of every N frames
  audioBitrate: "128k",   // encoded-audio bitrate
  format: "mp4",          // mp4 | mkv | mov | webm | webm-vp8 (video output only)
  scale: "orig",          // orig | 1080 | 720 | 480
  crop: "none",           // none | 1:1 | 9:16 | 16:9
  rotate: "none",         // none | cw | ccw | 180
  flip: "none",           // none | h | v
  fps: "orig",            // output fps: orig | 15 | 24 | 30 | 60
  color: "none",          // none | warm | cool | vivid | gray | sepia
  fadeIn: 0,              // seconds
  fadeOut: 0,             // seconds
  fpsSrc: 30,             // source frame rate (assumed until detected/typed)
  fpsAssumed: true,       // true while still using the default guess
  fpsUserSet: false,      // true once the user types/picks an fps
  frate: "all",           // frame-sequence rate: all | every2 | every5 | 1ps
  frameURLs: [],          // object URLs for the rendered frame gallery
  outURL: null,           // active object URL for the result blob
  ffmpeg: null,
  ffmpegUtil: null,
  isolated: false,
  running: false,
};

// ─── status / log helpers ──────────────────────────────────────────────
function setStatus(kind, msg) {
  statusEl.classList.remove("banner--info", "banner--warn", "banner--error", "is-hidden");
  statusEl.classList.add("banner--" + kind);
  statusTextEl.textContent = msg;
}
function clearStatus() {
  statusEl.classList.add("is-hidden");
  statusTextEl.textContent = "";
}
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  logEl.textContent += `\n[${ts}] ${msg}`;
  logEl.scrollTop = logEl.scrollHeight;
}
function resetLog(line = "ready.") {
  logEl.textContent = line;
}
function setStage(label, pct) {
  stageLabelEl.textContent = label;
  if (typeof pct === "number") setProgress(pct);
}
function setProgress(pct) {
  const v = Math.max(0, Math.min(100, pct));
  progressFillEl.style.width = `${v}%`;
}

// A same-origin module worker that re-imports the real (cross-origin) worker
// by its absolute URL. `new Worker(crossOriginURL)` is blocked, and a raw blob
// of worker.js breaks because its ./const.js / ./errors.js imports resolve
// against the opaque blob: URL. Importing the absolute URL makes worker.js's
// own relative imports resolve against unpkg (cross-origin module imports are
// allowed with CORS, which unpkg sends).
function classWorkerBlobURL(workerSrcURL) {
  const shim = `import ${JSON.stringify(workerSrcURL)};`;
  return URL.createObjectURL(new Blob([shim], { type: "text/javascript" }));
}

// ffmpeg.load() never rejects when its worker fails to init, so race it against
// a timeout to turn an otherwise-silent hang into a surfaced error.
function withTimeout(promise, ms, message) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// ─── ffmpeg loader (mt when crossOriginIsolated, st otherwise) ─────────
async function loadFFmpeg() {
  if (state.ffmpeg) return state.ffmpeg;

  state.isolated = !!(self.crossOriginIsolated && typeof SharedArrayBuffer === "function");
  const which = state.isolated ? "ffmpeg-mt" : "ffmpeg-st";
  engineTagEl.textContent = `engine: ${which} · loading…`;

  const [ff, util] = await Promise.all([
    import(/* @vite-ignore */ CDN.ffmpegEsm),
    import(/* @vite-ignore */ CDN.utilEsm),
  ]);

  const ffmpeg = new ff.FFmpeg();
  state.ffmpegUtil = util;

  ffmpeg.on("log", ({ message }) => {
    // Best-effort source-fps detection from ffmpeg's own input stream info.
    maybeDetectFps(message);
    // ffmpeg is chatty — keep the UI log compact, surface only useful lines.
    if (/^\s*$/.test(message)) return;
    if (/Stream mapping|encoder|Output #|Input #|frame=|size=/.test(message)) {
      log(message.replace(/\s+/g, " ").slice(0, 240));
    }
  });

  ffmpeg.on("progress", ({ progress }) => {
    if (Number.isFinite(progress)) setProgress(Math.round(progress * 100));
  });

  const base = state.isolated ? CDN.coreMt : CDN.coreSt;
  await withTimeout(
    ffmpeg.load({
      classWorkerURL: classWorkerBlobURL(CDN.ffmpegWorker),
      coreURL: await util.toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await util.toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      ...(state.isolated
        ? { workerURL: await util.toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript") }
        : {}),
    }),
    120_000,
    "Engine failed to load — check your connection and try again.",
  );

  engineTagEl.textContent = `engine: ${which} · ready`;
  state.ffmpeg = ffmpeg;
  return ffmpeg;
}

// Object URLs are always `blob:<origin>/<uuid>`, never javascript:.
// Parse via the URL constructor inside try/catch — this is the pattern
// CodeQL's js/xss-through-dom query recognizes as a URL-scheme sanitizer
// for .src / .href sinks.
// Only ever hand a `blob:` URL to a DOM sink (img/video/audio `src`,
// anchor `href`). The anchored scheme test is recognised by static
// analysers (e.g. CodeQL js/xss-through-dom) as a sanitizing barrier,
// so the returned value is treated as untainted.
function safeBlobUrl(url) {
  return typeof url === "string" && /^blob:[^"'<>\\\s]*$/i.test(url) ? url : "";
}

// ─── file probe via <video preload="metadata"> ─────────────────────────
function probeFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = safeBlobUrl(url);
    const cleanup = () => URL.revokeObjectURL(url);
    v.onloadedmetadata = () => {
      const meta = {
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        width: v.videoWidth || 0,
        height: v.videoHeight || 0,
      };
      cleanup();
      resolve(meta);
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("Could not read video metadata"));
    };
  });
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(2)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}
function fmtTime(s) {
  if (!Number.isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const sec = (s - m * 60).toFixed(2);
  return `${m}:${sec.padStart(5, "0")}`;
}
function fmtFps(f) {
  return Number.isInteger(f) ? String(f) : f.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

// ─── frame-perfect helpers ─────────────────────────────────────────────
function currentFps() {
  const f = parseFloat(state.fpsSrc);
  return Number.isFinite(f) && f > 0 ? f : 30;
}
function frameAt(sec) {
  return Math.round(sec * currentFps());
}
function totalFrames() {
  return Math.round((state.meta?.duration || 0) * currentFps());
}
function snapToFrame(sec) {
  const fps = currentFps();
  return Math.round(sec * fps) / fps;
}
function updateFrameInfo() {
  if (mFpsEl) {
    const dur = state.meta?.duration || 0;
    mFpsEl.textContent = dur
      ? `${fmtFps(currentFps())} fps · ${totalFrames()} frames${state.fpsAssumed ? " (assumed)" : ""}`
      : "—";
  }
  updateTrimWindow();
}
function syncFpsPickChips() {
  document.querySelectorAll('[data-opt="fpsSrcPick"]').forEach((c) => {
    const active = parseFloat(c.dataset.value) === currentFps();
    c.classList.toggle("is-active", active);
    c.setAttribute("aria-checked", active ? "true" : "false");
  });
}
// Parse the "…, 30 fps, 30 tbr, …" video-stream line ffmpeg prints for the
// input. Only used while the rate is still a guess (not user-set).
function maybeDetectFps(message) {
  if (state.fpsUserSet || !state.fpsAssumed) return;
  const m = message.match(/,\s*([\d.]+)\s*fps\b/);
  if (!m) return;
  const f = parseFloat(m[1]);
  if (!Number.isFinite(f) || f <= 0) return;
  const changed = Math.abs(f - currentFps()) > 0.01;
  state.fpsSrc = f;
  state.fpsAssumed = false;
  if (fpsSrcEl) fpsSrcEl.value = fmtFps(f);
  syncFpsPickChips();
  updateFrameInfo();
  if (changed) log(`detected source fps: ${fmtFps(f)}`);
}

// ─── file selection ────────────────────────────────────────────────────
async function acceptFile(file) {
  if (!file) return;
  if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|mkv|gif|m4v)$/i.test(file.name)) {
    setStatus("error", "Not a recognized video file.");
    return;
  }
  clearStatus();
  state.file = file;
  // Allow re-detection for the new file unless the user pinned an fps.
  if (!state.fpsUserSet) state.fpsAssumed = true;

  try {
    const meta = await probeFile(file);
    state.meta = meta;

    $("#m-name").textContent = file.name;
    $("#m-size").textContent = fmtBytes(file.size);
    $("#m-dur").textContent = fmtTime(meta.duration);
    $("#m-res").textContent = meta.width && meta.height ? `${meta.width} × ${meta.height}` : "unknown";
    $("#m-type").textContent = file.type || "unknown";
    metaEl.classList.remove("is-hidden");

    if (previewEl.src) URL.revokeObjectURL(previewEl.src);
    previewEl.src = safeBlobUrl(URL.createObjectURL(file));
    previewEl.classList.remove("is-hidden");

    // wire trim defaults
    const dur = meta.duration || 0;
    trimIn.value = "0";
    trimOut.value = dur.toFixed(3);
    trimIn.max = dur.toFixed(3);
    trimOut.max = dur.toFixed(3);
    trimInR.value = "0";
    trimOutR.value = "100";
    updateFrameInfo();

    updateRunEnabled();
    log(`selected ${file.name} · ${fmtBytes(file.size)} · ${fmtTime(meta.duration)} · ${meta.width}×${meta.height}`);
  } catch (err) {
    setStatus("error", err.message || String(err));
  }
}

// ─── second clip (join mode) ────────────────────────────────────────────
async function acceptFileB(file) {
  if (!file) return;
  if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|mkv|gif|m4v)$/i.test(file.name)) {
    setStatus("error", "Second clip isn't a recognized video file.");
    return;
  }
  try {
    const meta = await probeFile(file);
    state.fileB = file;
    state.metaB = meta;

    $("#m2-name").textContent = file.name;
    $("#m2-size").textContent = fmtBytes(file.size);
    $("#m2-dur").textContent = fmtTime(meta.duration);
    $("#m2-res").textContent = meta.width && meta.height ? `${meta.width} × ${meta.height}` : "unknown";
    if (meta2El) meta2El.classList.remove("is-hidden");

    // Track the object URL in state (like state.outURL) and never read the
    // element's own .src back, so the .src sink only ever receives the
    // safeBlobUrl()-sanitised value — matching the primary preview above.
    if (state.preview2URL) URL.revokeObjectURL(state.preview2URL);
    state.preview2URL = URL.createObjectURL(file);
    preview2El.src = safeBlobUrl(state.preview2URL);
    preview2El.classList.remove("is-hidden");

    clearStatus();
    updateRunEnabled();
    updateTransitionUI();
    updateEstimate();
    log(`second clip ${file.name} · ${fmtBytes(file.size)} · ${fmtTime(meta.duration)} · ${meta.width}×${meta.height}`);
  } catch (err) {
    setStatus("error", err.message || String(err));
  }
}

// Reflect an output choice both in state and on the (possibly hidden) chips.
function setOutput(val) {
  state.output = val;
  document.querySelectorAll('[data-opt="output"]').forEach((c) => {
    const active = c.dataset.value === val;
    c.classList.toggle("is-active", active);
    c.setAttribute("aria-checked", active ? "true" : "false");
  });
}

function syncSecondSource() {
  if (secondSourceEl) secondSourceEl.style.display = state.mode === "join" ? "" : "none";
  updateRunEnabled();
}

function updateRunEnabled() {
  btnRun.disabled =
    state.running || !state.file || (state.mode === "join" && !state.fileB);
}

function updateTransitionUI() {
  if (transDurRow) transDurRow.style.display = state.transition === "none" ? "none" : "";
  updateTransHint();
}
function updateTransHint() {
  if (!transHint) return;
  if (state.transition === "none") {
    transHint.textContent = "hard cut — clips joined end to end";
    return;
  }
  const requested = Number(state.transDur) || 0.5;
  const d = state.fileB ? joinTransDur() : requested;
  const capped = state.fileB && Math.abs(d - requested) > 0.001;
  transHint.textContent =
    `${TRANSITIONS[state.transition] || state.transition} · ${d.toFixed(1)}s overlap${capped ? " (capped to clip length)" : ""}`;
}

function updateTrimWindow() {
  const a = Math.max(0, parseFloat(trimIn.value) || 0);
  const b = Math.max(a, parseFloat(trimOut.value) || 0);
  const fa = frameAt(a);
  const fb = frameAt(b);
  trimWindow.textContent =
    `window: ${fmtTime(a)} → ${fmtTime(b)} · ${(b - a).toFixed(2)} s · frame ${fa} → ${fb} (${fb - fa} f)`;
  updateEstimate();
}

// ─── filter pieces (linear, comma-joined) ──────────────────────────────
function cropFilter(c) {
  switch (c) {
    case "1:1": return "crop='min(iw,ih)':'min(iw,ih)'";
    case "9:16": return "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'";
    case "16:9": return "crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'";
    default: return "";
  }
}
function scaleFilter(s) {
  return s === "orig" ? "" : `scale=-2:${s}`;
}
function rotateFilter(r) {
  switch (r) {
    case "cw": return "transpose=1";
    case "ccw": return "transpose=2";
    case "180": return "transpose=1,transpose=1";
    default: return "";
  }
}
function flipFilter(f) {
  if (f === "h") return "hflip";
  if (f === "v") return "vflip";
  return "";
}
function colorFilter(c) {
  switch (c) {
    case "warm": return "eq=saturation=1.1,colorbalance=rs=0.06:bs=-0.06";
    case "cool": return "eq=saturation=1.05,colorbalance=rs=-0.06:bs=0.06";
    case "vivid": return "eq=saturation=1.4:contrast=1.1";
    case "gray": return "hue=s=0";
    case "sepia": return "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131";
    default: return "";
  }
}
// crop → scale → rotate → flip → colour. Geometry first, then the look.
function geometryColorSegment() {
  return [
    cropFilter(state.crop),
    scaleFilter(state.scale),
    rotateFilter(state.rotate),
    flipFilter(state.flip),
    colorFilter(state.color),
  ].filter(Boolean);
}
function frateFilter(fr) {
  switch (fr) {
    // escape the expression comma so the filtergraph parser doesn't split on it
    case "every2": return "select=not(mod(n\\,2))";
    case "every5": return "select=not(mod(n\\,5))";
    case "1ps": return "fps=1";
    default: return "";
  }
}
// Decimation as a compression strategy: physically drop frames (keep 1 of every
// N) rather than resample. Paired with `-fps_mode vfr` at encode so the kept
// frames retain their original timestamps — the clip stays the same length but
// carries fewer frames, which the encoder turns into real bytes saved.
function frameDropFilter(fd) {
  const n = FRAME_DROP_N[fd];
  return n ? `select=not(mod(n\\,${n}))` : "";
}

// Final clip duration after mode + speed — used to place the fade-out.
function outputDuration(tIn, tOut, speed) {
  let d = tOut - tIn;
  if (state.mode === "boomerang") d *= 2;
  else if (state.mode === "palindrome") d = d * 2 + 0.4;
  return d / (Number(speed) || 1);
}

// Reverse-family stage: builds [0:v] → [v0] (graph where needed).
function videoModeStage() {
  if (state.mode === "reverse") return `[0:v]reverse[v0]`;
  if (state.mode === "boomerang") return `[0:v]split=2[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v0]`;
  if (state.mode === "palindrome") {
    // hold endpoints briefly so the bounce reads
    return `[0:v]split=2[a][b];[b]reverse[r];[a]tpad=stop_mode=clone:stop_duration=0.2[ap];[r]tpad=stop_mode=clone:stop_duration=0.2[rp];[ap][rp]concat=n=2:v=1[v0]`;
  }
  return `[0:v]null[v0]`; // trim — passthrough
}

// ─── argv builder ──────────────────────────────────────────────────────
function buildArgs(inputName, outputName, opts = {}) {
  const dur = state.meta?.duration || 0;
  const tIn = Math.max(0, parseFloat(trimIn.value) || 0);
  const tOut = Math.max(tIn + 0.01, parseFloat(trimOut.value) || dur);
  const speed = Number(state.speed) || 1;

  // ── output-type early branches ──
  if (state.output === "frame") return buildFrameArgs(inputName, outputName, tIn);
  if (state.output === "frames") return buildFramesArgs(inputName, tIn, tOut);
  if (state.output === "audio") return buildAudioArgs(inputName, outputName, tIn, tOut, speed);

  // ── video / gif ──
  // opts.pass: 0 single-pass, or 1/2 for a two-pass bitrate encode. Pass 1
  // analyses only — no audio, output muxed to the null sink.
  const passOne = opts.pass === 1;
  const isGif = state.output === "gif";
  const hasAudio = state.output === "video" && state.audio !== "drop" && !passOne;
  const hasAudioMatch = state.mode === "boomerang" || state.mode === "palindrome";
  const outDur = outputDuration(tIn, tOut, speed);

  const args = ["-ss", tIn.toFixed(3), "-to", tOut.toFixed(3), "-i", inputName];

  // mode stage → [v0]
  let v = videoModeStage();

  // linear segment → [v1]
  const lin = geometryColorSegment();
  // frame decimation runs first so downstream filters touch fewer frames
  const dropF = isGif ? "" : frameDropFilter(state.framedrop);
  if (dropF) lin.unshift(dropF);
  if (isGif) lin.push(`fps=${state.fps === "orig" ? "15" : state.fps}`);
  else if (state.fps !== "orig") lin.push(`fps=${state.fps}`);
  if (speed !== 1) lin.push(`setpts=PTS/${speed}`);
  if (state.fadeIn > 0) lin.push(`fade=t=in:st=0:d=${state.fadeIn.toFixed(2)}`);
  if (state.fadeOut > 0 && state.fadeOut < outDur) {
    lin.push(`fade=t=out:st=${(outDur - state.fadeOut).toFixed(3)}:d=${state.fadeOut.toFixed(2)}`);
  }
  v += `;[v0]${lin.length ? lin.join(",") : "null"}[v1]`;

  // tail stage → [vout]
  if (isGif) {
    // single-pass palette: split, generate, apply. GIF playback loops anyway,
    // so loop count is not applied here.
    v += `;[v1]split[gs0][gs1];[gs0]palettegen=stats_mode=diff[gp];[gs1][gp]paletteuse=dither=bayer:bayer_scale=3[vout]`;
  } else if (state.loops > 1) {
    const tags = Array.from({ length: state.loops }, (_, i) => `[v1_${i}]`).join("");
    v += `;[v1]split=${state.loops}${tags};${tags}concat=n=${state.loops}:v=1[vout]`;
  } else {
    v += `;[v1]null[vout]`;
  }
  const vTail = "[vout]";

  // ── audio chain (video output only) ──
  let a = "";
  let aTail = "";
  if (hasAudio) {
    // mode → [a0]
    if (state.audio === "reverse" && hasAudioMatch) {
      a = `[0:a]asplit=2[aa][ab];[ab]areverse[ar];[aa][ar]concat=n=2:v=0:a=1[a0]`;
    } else if (state.audio === "reverse" && state.mode === "reverse") {
      a = `[0:a]areverse[a0]`;
    } else if (state.mode === "palindrome") {
      a = `[0:a]apad=whole_dur=${((tOut - tIn) * 2 + 0.4).toFixed(3)}[a0]`;
    } else if (state.mode === "boomerang") {
      a = `[0:a]apad=whole_dur=${((tOut - tIn) * 2).toFixed(3)}[a0]`;
    } else {
      a = `[0:a]anull[a0]`;
    }
    // atempo → [a1]
    a += speed !== 1 ? `;[a0]${atempoChain(speed)}[a1]` : `;[a0]anull[a1]`;
    // fade → [a2]
    const af = [];
    if (state.fadeIn > 0) af.push(`afade=t=in:st=0:d=${state.fadeIn.toFixed(2)}`);
    if (state.fadeOut > 0 && state.fadeOut < outDur) {
      af.push(`afade=t=out:st=${(outDur - state.fadeOut).toFixed(3)}:d=${state.fadeOut.toFixed(2)}`);
    }
    a += `;[a1]${af.length ? af.join(",") : "anull"}[a2]`;
    // loops → [aout]
    if (state.loops > 1) {
      const tags = Array.from({ length: state.loops }, (_, i) => `[a2_${i}]`).join("");
      a += `;[a2]asplit=${state.loops}${tags};${tags}concat=n=${state.loops}:v=0:a=1[aout]`;
    } else {
      a += `;[a2]anull[aout]`;
    }
    aTail = "[aout]";
  }

  const filter = hasAudio ? `${v};${a}` : v;
  args.push("-filter_complex", filter, "-map", vTail);
  if (hasAudio) args.push("-map", aTail);
  else args.push("-an");

  // ── codec / container ──
  if (isGif) {
    args.push("-loop", "0", outputName);
    return args;
  }

  appendVideoCodec(args, { hasAudio, passOne });

  // two-pass: -pass + shared log file (bitrate mode only)
  if (opts.pass) args.push("-pass", String(opts.pass), "-passlogfile", opts.passlog || "ff2pass");

  // Honour the dropped-frame timestamps instead of padding back to CFR, so the
  // decimation actually removes frames (and bytes) from the output.
  if (state.framedrop !== "none") args.push("-fps_mode", "vfr");

  // pass 1 discards output via the null muxer (no seekable file needed; -an
  // is already set above by the no-audio map branch). The encoder still
  // writes the rate-control log the second pass reads.
  if (passOne) args.push("-f", "null", "/dev/null");
  else args.push(outputName);
  return args;
}

function clampCrf(v, vcodec) {
  const max = CRF_MAX[vcodec] ?? 51;
  const n = Math.round(Number(v));
  return Math.max(0, Math.min(max, Number.isFinite(n) ? n : 23));
}
function clampBitrate(v) {
  const n = Math.round(Number(v));
  return Math.max(50, Math.min(50000, Number.isFinite(n) ? n : 1000));
}

// Shared codec/rate-control tail for the video path. Emits the same
// -c:v / -crf|-b:v / -c:a arguments the single-file and join builders both
// need, driven by the FORMATS map and state.rateMode. passOne skips the
// mp4 faststart flag (the null-muxed analysis pass writes no real file).
function appendVideoCodec(args, { hasAudio, passOne = false } = {}) {
  const fmt = FORMATS[state.format] || FORMATS.mp4;
  const useBitrate = state.rateMode === "bitrate";
  const vbr = `${clampBitrate(state.bitrate)}k`;
  const crf = clampCrf(state.crf, fmt.vcodec);

  if (fmt.vcodec === "libx264") {
    args.push("-c:v", "libx264", "-preset", state.preset, "-pix_fmt", "yuv420p");
    if (useBitrate) args.push("-b:v", vbr);
    else args.push("-crf", String(crf));
    if (fmt.faststart && !passOne) args.push("-movflags", "+faststart");
    if (hasAudio) args.push("-c:a", "aac", "-b:a", state.audioBitrate);
  } else {
    // libvpx-vp9 / libvpx (vp8): -cpu-used stands in for -preset
    args.push("-c:v", fmt.vcodec, "-row-mt", "1", "-deadline", "good",
      "-cpu-used", String(VPX_CPU[state.preset] ?? 4));
    if (useBitrate) {
      args.push("-b:v", vbr);
    } else if (fmt.vcodec === "libvpx-vp9") {
      // VP9 constant quality: crf with no target bitrate
      args.push("-b:v", "0", "-crf", String(crf));
    } else {
      // VP8 constrained quality needs a bitrate ceiling alongside crf
      args.push("-crf", String(crf), "-b:v", vbr);
    }
    if (hasAudio) args.push("-c:a", "libopus", "-b:a", state.audioBitrate);
  }
  return fmt;
}

// ─── output-size estimate ───────────────────────────────────────────────
// Rough bits-per-pixel-per-frame for a CRF, anchored at x264 CRF 23 and
// halving every +6 CRF, nudged for codec efficiency. Deliberately
// approximate — true size depends on motion and detail.
function bppForCrf(crf, vcodec) {
  let bpp = 0.075 * Math.pow(2, (23 - crf) / 6);
  if (vcodec === "libvpx-vp9") bpp *= 0.8;
  else if (vcodec === "libvpx") bpp *= 1.15;
  return bpp;
}
function estimateBytes() {
  if (!state.meta) return null;
  if (state.mode === "join") return estimateJoinBytes();
  const o = state.output;
  if (o !== "video" && o !== "audio") return null; // gif/png are too unpredictable
  const dur = state.meta.duration || 0;
  const tIn = Math.max(0, parseFloat(trimIn.value) || 0);
  const tOut = Math.max(tIn + 0.01, parseFloat(trimOut.value) || dur);
  const speed = Number(state.speed) || 1;

  const aKbps = (o === "audio" || (o === "video" && state.audio !== "drop"))
    ? parseInt(state.audioBitrate, 10) || 0
    : 0;
  // audio export ignores mode (no boomerang/palindrome) — plain trimmed span
  if (o === "audio") {
    const aDur = (tOut - tIn) / speed;
    return aDur > 0 ? (aKbps * 1000 * aDur) / 8 : null;
  }

  const outDur = outputDuration(tIn, tOut, speed);
  if (!(outDur > 0)) return null;

  // effective resolution after scale
  let w = state.meta.width || 1280;
  let h = state.meta.height || 720;
  if (state.scale !== "orig" && h) {
    const nh = parseInt(state.scale, 10);
    w = Math.round((w * nh) / h);
    h = nh;
  }
  // Effective frame rate after output-fps + frame drop. File size tracks the
  // frame COUNT, not wall-clock: setpts speed keeps every frame, so when fps is
  // "original" the effective rate scales with speed (cancelling the /speed in
  // outDur). With an explicit output fps the fps filter already fixes the count.
  let fps = state.fps !== "orig" ? parseFloat(state.fps) : currentFps() * (Number(state.speed) || 1);
  const dropN = FRAME_DROP_N[state.framedrop];
  if (dropN) fps = fps / dropN;

  let vKbps;
  if (state.rateMode === "bitrate") {
    vKbps = clampBitrate(state.bitrate);
  } else {
    const fmt = FORMATS[state.format] || FORMATS.mp4;
    vKbps = (w * h * fps * bppForCrf(clampCrf(state.crf, fmt.vcodec), fmt.vcodec)) / 1000;
  }
  return ((vKbps + aKbps) * 1000 * outDur) / 8;
}
// Join estimate: the two clips share one encode over the combined (overlap-
// adjusted) duration, on the common canvas at the target fps.
function estimateJoinBytes() {
  if (!state.fileB || !state.metaB) return null;
  const outDur = joinOutputDuration();
  if (!(outDur > 0)) return null;
  const { w, h, fps } = joinCanvas();
  const aKbps = state.audio !== "drop" ? parseInt(state.audioBitrate, 10) || 0 : 0;
  let vKbps;
  if (state.rateMode === "bitrate") {
    vKbps = clampBitrate(state.bitrate);
  } else {
    const fmt = FORMATS[state.format] || FORMATS.mp4;
    vKbps = (w * h * fps * bppForCrf(clampCrf(state.crf, fmt.vcodec), fmt.vcodec)) / 1000;
  }
  return ((vKbps + aKbps) * 1000 * outDur) / 8;
}
function updateEstimate() {
  if (!estSizeEl) return;
  const bytes = estimateBytes();
  if (bytes == null || !Number.isFinite(bytes)) {
    estSizeEl.textContent = state.meta ? "—" : "load a file";
    return;
  }
  const exact = state.rateMode === "bitrate" && state.output === "video";
  estSizeEl.textContent = `≈ ${fmtBytes(Math.round(bytes))} (${exact ? "target" : "rough estimate"})`;
}

// Single PNG still. Accurate input seek lands on the frame-snapped timestamp
// (frame N = round(tIn * fps), already enforced by the trim snap).
function buildFrameArgs(inputName, outputName, tIn) {
  const args = ["-ss", tIn.toFixed(3), "-i", inputName, "-frames:v", "1"];
  const seg = geometryColorSegment();
  if (seg.length) args.push("-vf", seg.join(","));
  args.push("-update", "1", outputName);
  return args;
}

// PNG frame sequence across the trim window, written to the virtual FS as
// f_0001.png … and read back afterwards. -vsync 0 keeps `select` drops honest.
function buildFramesArgs(inputName, tIn, tOut) {
  const args = ["-ss", tIn.toFixed(3), "-to", tOut.toFixed(3), "-i", inputName];
  const vf = [frateFilter(state.frate), ...geometryColorSegment()].filter(Boolean);
  if (vf.length) args.push("-vf", vf.join(","));
  args.push("-vsync", "0", "f_%04d.png");
  return args;
}

// Audio-only export. AAC/m4a is the reliable default (libmp3lame is usually
// absent from @ffmpeg/core).
function buildAudioArgs(inputName, outputName, tIn, tOut, speed) {
  const args = ["-ss", tIn.toFixed(3), "-to", tOut.toFixed(3), "-i", inputName, "-vn"];
  if (speed !== 1) args.push("-filter:a", atempoChain(speed));
  args.push("-c:a", "aac", "-b:a", state.audioBitrate, outputName);
  return args;
}

// ─── join / concatenate two clips ──────────────────────────────────────
// Curated xfade transitions (plus "none" = hard cut). Values are ffmpeg
// xfade `transition=` names; audio crossfades via `acrossfade` when a
// transition is picked, otherwise both streams are `concat`-joined.
const TRANSITIONS = {
  none: "hard cut",
  fade: "crossfade",
  fadeblack: "fade through black",
  fadewhite: "fade through white",
  dissolve: "dissolve",
  wipeleft: "wipe left",
  wiperight: "wipe right",
  wipeup: "wipe up",
  wipedown: "wipe down",
  slideleft: "slide left",
  slideright: "slide right",
  circleopen: "circle open",
  circleclose: "circle close",
  radial: "radial",
  pixelize: "pixelize",
  smoothleft: "smooth left",
};

// Target canvas both clips are normalised to before joining. Height follows
// the Scale chip (or clip A's height); width tracks clip A's aspect. Both are
// forced even for yuv420p.
function joinCanvas() {
  const w0 = state.meta?.width || 1280;
  const h0 = state.meta?.height || 720;
  const h = state.scale === "orig" ? h0 : parseInt(state.scale, 10);
  const w = state.scale === "orig" ? w0 : Math.round((w0 * h) / h0);
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  const fps = state.fps !== "orig" ? parseFloat(state.fps) : currentFps();
  return { w: even(w), h: even(h), fps: Number.isFinite(fps) && fps > 0 ? fps : 30 };
}

// Clamp the transition duration so it never exceeds the shorter clip (xfade
// and acrossfade both need the overlap to fit inside both inputs).
function joinTransDur() {
  const durA = state.meta?.duration || 0;
  const durB = state.metaB?.duration || 0;
  const cap = Math.max(0.1, Math.min(durA || Infinity, durB || Infinity) - 0.05);
  const d = Number(state.transDur) || 0.5;
  return Math.min(Math.max(0.1, d), Number.isFinite(cap) ? cap : d);
}

// Final duration of a join, used by the size estimate. Hard cut is durA+durB;
// a transition overlaps the two clips by the transition duration.
function joinOutputDuration() {
  const durA = state.meta?.duration || 0;
  const durB = state.metaB?.duration || 0;
  const overlap = state.transition !== "none" ? joinTransDur() : 0;
  return Math.max(0, durA + durB - overlap);
}

// Build the two-input filtergraph. Each clip runs through the shared
// crop/rotate/flip/colour look, then is scaled+padded onto the common canvas
// (setsar=1, fixed fps, yuv420p) so concat/xfade see identical frames. With a
// transition, video uses xfade and kept audio uses acrossfade; a hard cut uses
// concat for both.
function buildJoinArgs(in0, in1, outputName) {
  const { w, h, fps } = joinCanvas();
  const useX = state.transition !== "none" && TRANSITIONS[state.transition];
  const hasAudio = state.audio !== "drop";
  const durA = state.meta?.duration || 0;

  const look = [
    cropFilter(state.crop),
    rotateFilter(state.rotate),
    flipFilter(state.flip),
    colorFilter(state.color),
  ].filter(Boolean);
  const norm = (i) => {
    const chain = [
      "setpts=PTS-STARTPTS", // rebase each clip's timeline to 0 for clean xfade/concat
      ...look,
      `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`,
      "setsar=1",
      `fps=${fps}`,
      "format=yuv420p",
    ];
    return `[${i}:v]${chain.join(",")}[jv${i}]`;
  };

  let d = 0;
  let v = `${norm(0)};${norm(1)};`;
  if (useX) {
    d = joinTransDur();
    const offset = Math.max(0, durA - d);
    v += `[jv0][jv1]xfade=transition=${state.transition}:duration=${d.toFixed(3)}:offset=${offset.toFixed(3)}[vout]`;
  } else {
    v += "[jv0][jv1]concat=n=2:v=1[vout]";
  }

  let a = "";
  if (hasAudio) {
    // Normalise both audio streams to a common format so concat/crossfade
    // accept them regardless of the sources' sample rate or layout.
    const af = "aresample=async=1:first_pts=0,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
    a = `[0:a]${af}[ja0];[1:a]${af}[ja1];`;
    a += useX
      ? `[ja0][ja1]acrossfade=d=${d.toFixed(3)}[aout]`
      : "[ja0][ja1]concat=n=2:v=0:a=1[aout]";
  }

  const filter = hasAudio ? `${v};${a}` : v;
  const args = ["-i", in0, "-i", in1, "-filter_complex", filter, "-map", "[vout]"];
  if (hasAudio) args.push("-map", "[aout]");
  else args.push("-an");
  appendVideoCodec(args, { hasAudio });
  args.push(outputName);
  return args;
}

function atempoChain(speed) {
  // atempo accepts 0.5..2.0; chain multiple filters for ratios outside.
  let s = speed;
  const filters = [];
  while (s > 2.0) { filters.push("atempo=2.0"); s /= 2.0; }
  while (s < 0.5) { filters.push("atempo=0.5"); s /= 0.5; }
  filters.push(`atempo=${s.toFixed(4)}`);
  return filters.join(",");
}

// ─── output naming ─────────────────────────────────────────────────────
function outExt() {
  if (state.mode === "join") return (FORMATS[state.format] || FORMATS.mp4).ext;
  switch (state.output) {
    case "gif": return "gif";
    case "frame": return "png";
    case "frames": return "png";
    case "audio": return "m4a";
    default: return (FORMATS[state.format] || FORMATS.mp4).ext; // mp4 | mkv | mov | webm
  }
}
function outputSuffix() {
  switch (state.output) {
    case "gif": return "gif";
    case "frame": return "frame";
    case "audio": return "audio";
    default:
      if (state.mode === "reverse") return "reversed";
      if (state.mode === "trim") return "clip";
      if (state.mode === "join") return "joined";
      return state.mode;
  }
}

// ─── run pipeline ──────────────────────────────────────────────────────
async function run() {
  if (!state.file || state.running) return;
  if (state.mode === "join" && !state.fileB) {
    setStatus("warn", "Add a second clip to join.");
    return;
  }
  state.running = true;
  btnRun.disabled = true;
  btnCancel.disabled = false;
  if (state.outURL) {
    URL.revokeObjectURL(state.outURL);
    state.outURL = null;
  }
  revokeFrames();
  outEl.innerHTML = "";
  resetLog("starting…");
  setProgress(0);
  clearStatus();

  const startedAt = performance.now();
  const tick = setInterval(() => {
    const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
    stageTimeEl.textContent = `${elapsed}s`;
  }, 200);

  const isJoin = state.mode === "join";
  const inExt = (state.file.name.match(/\.[^.]+$/) || [".mp4"])[0].toLowerCase();
  const inName = `in${inExt}`;
  const inNameB = isJoin
    ? `inb${(state.fileB.name.match(/\.[^.]+$/) || [".mp4"])[0].toLowerCase()}`
    : null;
  const isFrames = state.output === "frames";
  const ext = outExt();
  const outName = isFrames ? null : `out.${ext}`;

  try {
    setStage("loading engine…", 0);
    const ff = await loadFFmpeg();

    const logArgv = (argv) =>
      log(`ffmpeg ${argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
    const twoPass = !isJoin && state.output === "video" && state.rateMode === "bitrate" && state.twopass === "on";

    if (isJoin) {
      setStage("reading files…", 0);
      await ff.writeFile(inName, await state.ffmpegUtil.fetchFile(state.file));
      await ff.writeFile(inNameB, await state.ffmpegUtil.fetchFile(state.fileB));

      setStage("processing…", 0);
      const argv = buildJoinArgs(inName, inNameB, outName);
      logArgv(argv);
      const code = await ff.exec(argv);
      if (code !== 0) {
        throw new Error(
          state.audio !== "drop"
            ? `ffmpeg exited with code ${code} — if a clip has no audio track, set Audio to Drop.`
            : `ffmpeg exited with code ${code}`,
        );
      }
    } else {
      setStage("reading file…", 0);
      await ff.writeFile(inName, await state.ffmpegUtil.fetchFile(state.file));

      if (twoPass) {
        setStage("processing · pass 1/2…", 0);
        const a1 = buildArgs(inName, outName, { pass: 1, passlog: "ff2pass" });
        logArgv(a1);
        const c1 = await ff.exec(a1);
        if (c1 !== 0) throw new Error(`ffmpeg pass 1 exited with code ${c1}`);

        setStage("processing · pass 2/2…", 0);
        const a2 = buildArgs(inName, outName, { pass: 2, passlog: "ff2pass" });
        logArgv(a2);
        const c2 = await ff.exec(a2);
        if (c2 !== 0) throw new Error(`ffmpeg pass 2 exited with code ${c2}`);
      } else {
        setStage("processing…", 0);
        const argv = buildArgs(inName, outName);
        logArgv(argv);
        const code = await ff.exec(argv);
        if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
      }
    }

    setStage("finalizing…", 100);

    if (isFrames) {
      const files = await collectFrames(ff);
      if (!files.length) throw new Error("No frames were produced.");
      renderFrames(files);
      setStage("done", 100);
      log(`extracted ${files.length} frame(s)`);
      setStatus("info", `Done. ${files.length} frame(s) extracted.`);
    } else {
      const data = await ff.readFile(outName);
      const blob = new Blob([data.buffer], { type: MIME[ext] || "application/octet-stream" });
      state.outURL = URL.createObjectURL(blob);
      renderOutput(blob);
      setStage("done", 100);
      log(`output ${fmtBytes(blob.size)}`);
      setStatus("info", `Done. Output ${fmtBytes(blob.size)}.`);
    }
  } catch (err) {
    console.error(err);
    setStage("error", 0);
    setStatus("error", err?.message || String(err));
    log(`error: ${err?.message || err}`);
  } finally {
    clearInterval(tick);
    try { await state.ffmpeg?.deleteFile(inName); } catch (_) {}
    if (inNameB) { try { await state.ffmpeg?.deleteFile(inNameB); } catch (_) {} }
    if (outName) { try { await state.ffmpeg?.deleteFile(outName); } catch (_) {} }
    // two-pass leaves its rate-control log behind in the virtual FS
    for (const f of ["ff2pass-0.log", "ff2pass-0.log.mbtree"]) {
      try { await state.ffmpeg?.deleteFile(f); } catch (_) {}
    }
    state.running = false;
    btnRun.disabled = false;
    btnCancel.disabled = true;
  }
}

// List the virtual FS for the f_NNNN.png sequence, read each back into a blob
// URL, then clean the FS. Capped to protect memory on the single-thread core.
async function collectFrames(ff) {
  let names = [];
  try {
    const dir = await ff.listDir("/");
    names = dir
      .filter((e) => !e.isDir && /^f_\d+\.png$/.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch (_) {
    // listDir unavailable — probe sequential names instead.
    for (let i = 1; i <= FRAME_CAP + 1; i++) {
      const nm = `f_${String(i).padStart(4, "0")}.png`;
      try { await ff.readFile(nm); names.push(nm); } catch (_) { break; }
    }
  }

  const shown = names.slice(0, FRAME_CAP);
  if (names.length > FRAME_CAP) {
    setStatus("warn", `Showing first ${FRAME_CAP} of ${names.length} frames (memory guard).`);
    log(`frame cap: ${names.length} produced, showing ${FRAME_CAP}`);
  }

  const out = [];
  for (const name of shown) {
    const data = await ff.readFile(name);
    const blob = new Blob([data.buffer], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    state.frameURLs.push(url);
    const m = name.match(/(\d+)/);
    out.push({ name, blob, url, n: m ? parseInt(m[1], 10) : out.length + 1 });
  }
  for (const name of names) { try { await ff.deleteFile(name); } catch (_) {} }
  return out;
}

function revokeFrames() {
  state.frameURLs.forEach((u) => URL.revokeObjectURL(u));
  state.frameURLs = [];
}

function cancel() {
  if (!state.running || !state.ffmpeg) return;
  try {
    state.ffmpeg.terminate();
  } catch (_) {}
  state.ffmpeg = null;
  state.running = false;
  btnRun.disabled = false;
  btnCancel.disabled = true;
  engineTagEl.textContent = "engine: idle";
  setStage("cancelled", 0);
  log("cancelled by user");
  setStatus("warn", "Cancelled. The engine will reload on the next run.");
}

function renderOutput(blob) {
  const base = state.file.name.replace(/\.[^.]+$/, "") || "output";
  const ext = outExt();
  const name = `${base}_${outputSuffix()}.${ext}`;

  const wrap = document.createElement("section");
  wrap.className = "panel stack-md";

  const head = document.createElement("div");
  head.className = "panel__head";
  const title = document.createElement("span");
  title.className = "panel__title";
  title.textContent = "Output";
  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";

  const dl = document.createElement("a");
  dl.className = "btn btn--primary";
  dl.id = "dl";
  dl.download = name;
  dl.href = safeBlobUrl(state.outURL);
  dl.textContent = `↓ download ${name}`;

  const another = document.createElement("button");
  another.type = "button";
  another.className = "btn btn--ghost";
  another.dataset.action = "another";
  another.textContent = "Process another";

  btnRow.appendChild(dl);
  btnRow.appendChild(another);
  head.appendChild(title);
  head.appendChild(btnRow);
  wrap.appendChild(head);

  // before/after size comparison
  const orig = state.file?.size || 0;
  if (orig > 0) {
    const out = blob.size;
    const delta = orig - out;
    const pct = Math.round((Math.abs(delta) / orig) * 100);
    const verb = delta >= 0 ? "smaller" : "larger";
    const cmp = document.createElement("div");
    cmp.className = "meta-grid";
    [
      ["Original", fmtBytes(orig)],
      ["Output", fmtBytes(out)],
      [delta >= 0 ? "Saved" : "Increase", `${fmtBytes(Math.abs(delta))} · ${pct}% ${verb}`],
    ].forEach(([k, v]) => {
      const row = document.createElement("div");
      row.className = "kv-row";
      const ks = document.createElement("span"); ks.className = "k"; ks.textContent = k;
      const vs = document.createElement("span"); vs.className = "v"; vs.textContent = v;
      row.appendChild(ks); row.appendChild(vs);
      cmp.appendChild(row);
    });
    wrap.appendChild(cmp);
  }

  let el;
  if (ext === "gif" || ext === "png") {
    el = document.createElement("img");
    el.alt = "result";
    el.loading = "lazy";
  } else if (ext === "m4a" || ext === "mp3") {
    el = document.createElement("audio");
    el.controls = true;
  } else {
    el = document.createElement("video");
    el.controls = true;
    el.loop = true;
    el.playsInline = true;
  }
  el.src = safeBlobUrl(state.outURL);
  el.className = "preview";
  wrap.appendChild(el);
  outEl.appendChild(wrap);
}

function renderFrames(files) {
  const base = state.file.name.replace(/\.[^.]+$/, "") || "output";

  const wrap = document.createElement("section");
  wrap.className = "panel stack-md";

  const head = document.createElement("div");
  head.className = "panel__head";
  const title = document.createElement("span");
  title.className = "panel__title";
  title.textContent = `Frames · ${files.length}`;
  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";

  const zipBtn = document.createElement("button");
  zipBtn.type = "button";
  zipBtn.className = "btn btn--primary";
  zipBtn.textContent = "↓ download all (.zip)";
  zipBtn.addEventListener("click", () => downloadFramesZip(files, base, zipBtn));

  const another = document.createElement("button");
  another.type = "button";
  another.className = "btn btn--ghost";
  another.dataset.action = "another";
  another.textContent = "Process another";

  btnRow.appendChild(zipBtn);
  btnRow.appendChild(another);
  head.appendChild(title);
  head.appendChild(btnRow);
  wrap.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "opt-grid";
  files.forEach((f) => {
    const cell = document.createElement("div");
    cell.className = "opt";

    const a = document.createElement("a");
    a.href = safeBlobUrl(f.url);
    a.download = frameName(base, f.n);
    const img = document.createElement("img");
    img.src = safeBlobUrl(f.url);
    img.alt = `frame ${f.n}`;
    img.loading = "lazy";
    img.className = "preview";
    a.appendChild(img);

    const cap = document.createElement("span");
    cap.className = "field-label";
    cap.textContent = `frame ${f.n}`;

    cell.appendChild(a);
    cell.appendChild(cap);
    grid.appendChild(cell);
  });
  wrap.appendChild(grid);
  outEl.appendChild(wrap);
}

function frameName(base, n) {
  return `${base}_frame_${String(n).padStart(4, "0")}.png`;
}

function triggerDownload(href, name) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Lazy-load fflate only on click; fall back to per-frame downloads if it fails.
async function downloadFramesZip(files, base, btn) {
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "zipping…";
  try {
    const fflate = await import(/* @vite-ignore */ CDN.fflate);
    const entries = {};
    for (const f of files) {
      entries[frameName(base, f.n)] = new Uint8Array(await f.blob.arrayBuffer());
    }
    const zipped = fflate.zipSync(entries, { level: 0 }); // PNGs are already compressed
    const url = URL.createObjectURL(new Blob([zipped.buffer], { type: "application/zip" }));
    triggerDownload(url, `${base}_frames.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    log(`zipped ${files.length} frame(s)`);
  } catch (err) {
    log(`zip unavailable (${err?.message || err}); downloading individually`);
    setStatus("warn", "Zip library unavailable — downloading frames individually.");
    files.forEach((f) => triggerDownload(safeBlobUrl(f.url), frameName(base, f.n)));
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

// ─── output-type visibility ────────────────────────────────────────────
function showBlock(id, on) {
  const el = $("#" + id);
  // .opt { display:flex } beats the `hidden` attribute, so toggle inline.
  if (el) el.style.display = on ? "" : "none";
}
// Only one of CRF / bitrate is relevant at a time; the other (and the
// bitrate-only two-pass toggle) hides.
function updateRateVisibility() {
  if (state.output !== "video") return; // all already hidden for non-video
  showBlock("opt-crf-block", state.rateMode === "crf");
  showBlock("opt-bitrate-block", state.rateMode === "bitrate");
  showBlock("opt-twopass-block", state.rateMode === "bitrate");
}

// compression controls that only make sense for the re-encoded video path
const COMPRESS_BLOCKS = [
  "opt-rate-block", "opt-crf-block", "opt-bitrate-block", "opt-twopass-block",
  "opt-preset-block", "opt-framedrop-block", "opt-abr-block",
];

// All toggleable option blocks, shared by the output- and join-visibility paths.
const ALL_OPT_BLOCKS = [
  "opt-mode-block", "opt-output-block", "opt-join-block", "opt-loops-block",
  "opt-speed-block", "opt-scale-block", "opt-crop-block", "opt-rotate-block",
  "opt-flip-block", "opt-color-block", "opt-fps-block", "opt-frate-block",
  "opt-fade-block", "opt-format-block", "opt-quality-block", "opt-audio-block",
  "opt-fpssrc-block", "opt-trim-block", ...COMPRESS_BLOCKS,
];

// Join mode is a two-input encode, so the single-clip controls (output type,
// trim, loops, speed, fade, per-clip modes, frame-drop, two-pass) don't apply.
// It keeps the shared look + canvas + encode controls and adds the transition.
const JOIN_BLOCKS = new Set([
  "opt-mode-block", "opt-join-block", "opt-scale-block", "opt-crop-block",
  "opt-rotate-block", "opt-flip-block", "opt-color-block", "opt-fps-block",
  "opt-format-block", "opt-quality-block", "opt-audio-block", "opt-fpssrc-block",
  "opt-rate-block", "opt-crf-block", "opt-bitrate-block", "opt-preset-block",
  "opt-abr-block",
]);

function applyJoinVisibility() {
  ALL_OPT_BLOCKS.forEach((id) => showBlock(id, JOIN_BLOCKS.has(id)));
  // rate-control controls follow the CRF/bitrate chip; two-pass stays hidden.
  showBlock("opt-crf-block", state.rateMode === "crf");
  showBlock("opt-bitrate-block", state.rateMode === "bitrate");
  showBlock("opt-twopass-block", false);
}

function applyOutputVisibility() {
  // Join is selected via the Mode chips but reshapes the whole panel.
  if (state.mode === "join") {
    applyJoinVisibility();
    return;
  }
  showBlock("opt-join-block", false);
  const o = state.output;
  const all = ALL_OPT_BLOCKS.filter((id) => id !== "opt-join-block");

  const hide = {
    // frame export rate is only meaningful for the frame sequence; compress
    // controls all apply to video
    video: ["opt-frate-block"],
    // gif quality is palette/fps driven, not codec/CRF driven
    gif: ["opt-frate-block", "opt-format-block", "opt-audio-block", ...COMPRESS_BLOCKS],
    frame: [
      "opt-frate-block", "opt-format-block", "opt-quality-block", "opt-audio-block",
      "opt-loops-block", "opt-speed-block", "opt-fps-block", "opt-fade-block", "opt-mode-block",
      ...COMPRESS_BLOCKS,
    ],
    frames: [
      "opt-format-block", "opt-quality-block", "opt-audio-block",
      "opt-loops-block", "opt-speed-block", "opt-fps-block", "opt-fade-block", "opt-mode-block",
      ...COMPRESS_BLOCKS,
    ],
    // audio export keeps only the audio-bitrate control from the compress group
    audio: [
      "opt-frate-block", "opt-scale-block", "opt-crop-block", "opt-rotate-block",
      "opt-flip-block", "opt-color-block", "opt-fps-block", "opt-fade-block",
      "opt-loops-block", "opt-mode-block", "opt-format-block", "opt-quality-block",
      "opt-fpssrc-block",
      "opt-rate-block", "opt-crf-block", "opt-bitrate-block", "opt-twopass-block",
      "opt-preset-block", "opt-framedrop-block",
    ],
  }[o] || [];

  all.forEach((id) => showBlock(id, !hide.includes(id)));
  updateRateVisibility();
}

// ─── UI wiring ─────────────────────────────────────────────────────────
dropEl.addEventListener("click", () => fileEl.click());
dropEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileEl.click();
  }
});
["dragenter", "dragover"].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => {
    e.preventDefault();
    dropEl.classList.add("is-hover");
  }),
);
["dragleave", "drop"].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => {
    e.preventDefault();
    dropEl.classList.remove("is-hover");
  }),
);
dropEl.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) acceptFile(f);
});
fileEl.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (f) acceptFile(f);
});

// second drop zone (join mode) — mirrors the primary one
if (drop2El && file2El) {
  drop2El.addEventListener("click", () => file2El.click());
  drop2El.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      file2El.click();
    }
  });
  ["dragenter", "dragover"].forEach((ev) =>
    drop2El.addEventListener(ev, (e) => {
      e.preventDefault();
      drop2El.classList.add("is-hover");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop2El.addEventListener(ev, (e) => {
      e.preventDefault();
      drop2El.classList.remove("is-hover");
    }),
  );
  drop2El.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) acceptFileB(f);
  });
  file2El.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) acceptFileB(f);
  });
}

// transition select + duration (join mode)
if (transitionSel) {
  transitionSel.addEventListener("change", () => {
    state.transition = transitionSel.value;
    updateTransitionUI();
    updateEstimate();
  });
}
if (transDurEl) {
  transDurEl.addEventListener("input", () => {
    state.transDur = parseFloat(transDurEl.value) || 0.5;
    updateTransHint();
    updateEstimate();
  });
}

document.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-opt]");
  if (chip) {
    const opt = chip.dataset.opt;
    const val = chip.dataset.value;
    const siblings = chip.parentElement.querySelectorAll("[data-opt]");
    siblings.forEach((s) => {
      s.classList.toggle("is-active", s === chip);
      s.setAttribute("aria-checked", s === chip ? "true" : "false");
    });
    if (opt === "loops") {
      state.loops = parseInt(val, 10);
    } else if (opt === "fpsSrcPick") {
      state.fpsSrc = parseFloat(val);
      state.fpsUserSet = true;
      state.fpsAssumed = false;
      if (fpsSrcEl) fpsSrcEl.value = val;
      updateFrameInfo();
    } else {
      state[opt] = val;
    }
    // a quality preset seeds the CRF slider
    if (opt === "quality") {
      state.crf = QUALITY_CRF[val] ?? state.crf;
      syncCrfUI();
    }
    if (opt === "rateMode") {
      if (state.mode === "join") applyJoinVisibility();
      else updateRateVisibility();
    }
    if (opt === "mode") {
      // Join produces a joined video regardless of the (hidden) output chip.
      if (val === "join") setOutput("video");
      syncSecondSource();
      applyOutputVisibility();
    }
    if (opt === "output") applyOutputVisibility();
    updateEstimate();
    return;
  }
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "reset-opts") resetOptions();
  if (action === "another") resetForAnother();
});

optSpeed.addEventListener("change", () => {
  state.speed = parseFloat(optSpeed.value) || 1;
  updateEstimate();
});

if (fpsSrcEl) {
  fpsSrcEl.addEventListener("change", () => {
    const v = parseFloat(fpsSrcEl.value);
    state.fpsSrc = Number.isFinite(v) && v > 0 ? v : 30;
    fpsSrcEl.value = fmtFps(state.fpsSrc);
    state.fpsUserSet = true;
    state.fpsAssumed = false;
    syncFpsPickChips();
    updateFrameInfo();
  });
}
if (fadeInEl) {
  fadeInEl.addEventListener("input", () => {
    state.fadeIn = parseFloat(fadeInEl.value) || 0;
    updateFadeHint();
  });
}
if (fadeOutEl) {
  fadeOutEl.addEventListener("input", () => {
    state.fadeOut = parseFloat(fadeOutEl.value) || 0;
    updateFadeHint();
  });
}

// ─── compression controls ──────────────────────────────────────────────
function syncCrfUI() {
  if (crfEl) crfEl.value = String(state.crf);
  if (crfHint) crfHint.textContent = String(state.crf);
}
if (crfEl) {
  crfEl.addEventListener("input", () => {
    state.crf = clampCrf(crfEl.value, (FORMATS[state.format] || FORMATS.mp4).vcodec);
    if (crfHint) crfHint.textContent = String(state.crf);
    // a hand-set CRF no longer matches a named preset — drop the highlight
    state.quality = "custom";
    document.querySelectorAll('[data-opt="quality"]').forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-checked", "false");
    });
    updateEstimate();
  });
}
if (presetEl) {
  presetEl.addEventListener("change", () => { state.preset = presetEl.value; });
}
if (bitrateEl) {
  bitrateEl.addEventListener("change", () => {
    state.bitrate = clampBitrate(bitrateEl.value);
    bitrateEl.value = String(state.bitrate);
    updateEstimate();
  });
}

function updateFadeHint() {
  if (!fadeHint) return;
  fadeHint.textContent = (state.fadeIn > 0 || state.fadeOut > 0)
    ? `in ${state.fadeIn.toFixed(1)}s · out ${state.fadeOut.toFixed(1)}s`
    : "no fade";
}

// frame-nudge buttons step trim by exactly one frame
function nudgeTrim(which, dir) {
  const dur = state.meta?.duration || 0;
  if (!dur) return;
  const el = which === "in" ? trimIn : trimOut;
  const v = (parseFloat(el.value) || 0) + dir / currentFps();
  el.value = Math.max(0, Math.min(dur, v)).toFixed(3);
  syncTrimFromNumber(which);
}
[
  ["trim-in-prev", "in", -1],
  ["trim-in-next", "in", 1],
  ["trim-out-prev", "out", -1],
  ["trim-out-next", "out", 1],
].forEach(([id, which, dir]) => {
  const b = $("#" + id);
  if (b) b.addEventListener("click", () => nudgeTrim(which, dir));
});

function syncTrimFromNumber(which) {
  const dur = state.meta?.duration || 0;
  if (!dur) return;
  if (which === "in") {
    const v = snapToFrame(Math.max(0, Math.min(dur, parseFloat(trimIn.value) || 0)));
    trimIn.value = v.toFixed(3);
    trimInR.value = ((v / dur) * 100).toFixed(2);
  } else {
    const v = snapToFrame(Math.max(0, Math.min(dur, parseFloat(trimOut.value) || dur)));
    trimOut.value = v.toFixed(3);
    trimOutR.value = ((v / dur) * 100).toFixed(2);
  }
  updateTrimWindow();
}
function syncTrimFromRange(which) {
  const dur = state.meta?.duration || 0;
  if (!dur) return;
  if (which === "in") {
    const v = snapToFrame((parseFloat(trimInR.value) / 100) * dur);
    trimIn.value = v.toFixed(3);
  } else {
    const v = snapToFrame((parseFloat(trimOutR.value) / 100) * dur);
    trimOut.value = v.toFixed(3);
  }
  // enforce in < out
  if (parseFloat(trimIn.value) >= parseFloat(trimOut.value)) {
    if (which === "in") {
      trimIn.value = (parseFloat(trimOut.value) - 0.1).toFixed(3);
      trimInR.value = ((parseFloat(trimIn.value) / dur) * 100).toFixed(2);
    } else {
      trimOut.value = (parseFloat(trimIn.value) + 0.1).toFixed(3);
      trimOutR.value = ((parseFloat(trimOut.value) / dur) * 100).toFixed(2);
    }
  }
  updateTrimWindow();
}
trimIn.addEventListener("change", () => syncTrimFromNumber("in"));
trimOut.addEventListener("change", () => syncTrimFromNumber("out"));
trimInR.addEventListener("input", () => syncTrimFromRange("in"));
trimOutR.addEventListener("input", () => syncTrimFromRange("out"));

btnRun.addEventListener("click", run);
btnCancel.addEventListener("click", cancel);

function resetOptions() {
  state.mode = "trim";
  state.output = "video";
  state.loops = 1;
  state.audio = "drop";
  state.speed = 1;
  state.quality = "medium";
  state.crf = QUALITY_CRF.medium;
  state.rateMode = "crf";
  state.bitrate = 1000;
  state.twopass = "off";
  state.preset = "veryfast";
  state.framedrop = "none";
  state.audioBitrate = "128k";
  state.format = "mp4";
  state.scale = "orig";
  state.crop = "none";
  state.rotate = "none";
  state.flip = "none";
  state.fps = "orig";
  state.color = "none";
  state.fadeIn = 0;
  state.fadeOut = 0;
  state.frate = "all";
  state.transition = "none";
  state.transDur = 0.5;
  document.querySelectorAll("[data-opt]").forEach((c) => {
    const opt = c.dataset.opt;
    if (opt === "fpsSrcPick") return; // source fps is not reset (it tracks the file)
    const active = String(state[opt]) === c.dataset.value;
    c.classList.toggle("is-active", active);
    c.setAttribute("aria-checked", active ? "true" : "false");
  });
  optSpeed.value = "1";
  if (presetEl) presetEl.value = state.preset;
  if (bitrateEl) bitrateEl.value = String(state.bitrate);
  syncCrfUI();
  if (fadeInEl) fadeInEl.value = "0";
  if (fadeOutEl) fadeOutEl.value = "0";
  if (transitionSel) transitionSel.value = "none";
  if (transDurEl) transDurEl.value = "0.5";
  updateFadeHint();
  updateTransitionUI();
  syncSecondSource();
  applyOutputVisibility();
  updateFrameInfo();
  setStatus("info", "Defaults restored.");
}

function resetForAnother() {
  if (state.outURL) {
    URL.revokeObjectURL(state.outURL);
    state.outURL = null;
  }
  revokeFrames();
  outEl.innerHTML = "";
  resetLog("ready.");
  setProgress(0);
  setStage("idle");
  stageTimeEl.textContent = "";
  clearStatus();
}

// ─── boot ──────────────────────────────────────────────────────────────
setStage("idle");
applyOutputVisibility();
syncSecondSource();
updateTransitionUI();
syncFpsPickChips();
updateFadeHint();
syncCrfUI();
updateFrameInfo();
log(
  self.crossOriginIsolated && typeof SharedArrayBuffer === "function"
    ? "multi-thread ffmpeg available."
    : "single-thread ffmpeg (page is not cross-origin isolated).",
);
