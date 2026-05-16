/* Video Studio — reverse / boomerang / palindrome, trim, audio, speed,
   quality and format. Runs entirely in-browser via ffmpeg.wasm. */

// ─── pinned CDN versions ───────────────────────────────────────────────
const FF_VER = "0.12.10";
const UTIL_VER = "0.12.1";
const CORE_VER = "0.12.6";

const CDN = {
  ffmpegEsm: `https://unpkg.com/@ffmpeg/ffmpeg@${FF_VER}/dist/esm/index.js`,
  utilEsm: `https://unpkg.com/@ffmpeg/util@${UTIL_VER}/dist/esm/index.js`,
  coreSt: `https://unpkg.com/@ffmpeg/core@${CORE_VER}/dist/umd`,
  coreMt: `https://unpkg.com/@ffmpeg/core-mt@${CORE_VER}/dist/umd`,
};

const QUALITY_CRF = { low: 30, medium: 23, high: 18 };

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

// ─── state ─────────────────────────────────────────────────────────────
const state = {
  file: null,
  meta: null,             // { duration, width, height }
  mode: "boomerang",      // boomerang | reverse | palindrome
  loops: 1,               // 1 | 2 | 3
  audio: "drop",          // drop | keep | reverse
  speed: 1,
  quality: "medium",
  format: "mp4",
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
  await ffmpeg.load({
    coreURL: await util.toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await util.toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    ...(state.isolated
      ? { workerURL: await util.toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript") }
      : {}),
  });

  engineTagEl.textContent = `engine: ${which} · ready`;
  state.ffmpeg = ffmpeg;
  return ffmpeg;
}

// ─── file probe via <video preload="metadata"> ─────────────────────────
function probeFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
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

// ─── file selection ────────────────────────────────────────────────────
async function acceptFile(file) {
  if (!file) return;
  if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|mkv|gif|m4v)$/i.test(file.name)) {
    setStatus("error", "Not a recognized video file.");
    return;
  }
  clearStatus();
  state.file = file;

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
    previewEl.src = URL.createObjectURL(file);
    previewEl.classList.remove("is-hidden");

    // wire trim defaults
    const dur = meta.duration || 0;
    trimIn.value = "0";
    trimOut.value = dur.toFixed(2);
    trimIn.max = dur.toFixed(2);
    trimOut.max = dur.toFixed(2);
    trimInR.value = "0";
    trimOutR.value = "100";
    updateTrimWindow();

    btnRun.disabled = false;
    log(`selected ${file.name} · ${fmtBytes(file.size)} · ${fmtTime(meta.duration)} · ${meta.width}×${meta.height}`);
  } catch (err) {
    setStatus("error", err.message || String(err));
  }
}

function updateTrimWindow() {
  const a = Math.max(0, parseFloat(trimIn.value) || 0);
  const b = Math.max(a, parseFloat(trimOut.value) || 0);
  trimWindow.textContent = `window: ${fmtTime(a)} → ${fmtTime(b)} · ${(b - a).toFixed(2)} s`;
}

// ─── filter graph + argv builder ───────────────────────────────────────
function buildArgs(inputName, outputName) {
  const dur = state.meta?.duration || 0;
  const tIn = Math.max(0, parseFloat(trimIn.value) || 0);
  const tOut = Math.max(tIn + 0.01, parseFloat(trimOut.value) || dur);
  const hasAudio = state.audio !== "drop";
  const hasAudioMatch = (state.mode === "boomerang" || state.mode === "palindrome");
  const speed = Number(state.speed) || 1;

  const args = ["-ss", tIn.toFixed(3), "-to", tOut.toFixed(3), "-i", inputName];

  // ── video chain per mode ──
  let v = "";
  if (state.mode === "reverse") {
    v = `[0:v]reverse[v0]`;
  } else if (state.mode === "boomerang") {
    v = `[0:v]split=2[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v0]`;
  } else {
    // palindrome — hold endpoints briefly so the bounce reads
    v = `[0:v]split=2[a][b];[b]reverse[r];[a]tpad=stop_mode=clone:stop_duration=0.2[ap];[r]tpad=stop_mode=clone:stop_duration=0.2[rp];[ap][rp]concat=n=2:v=1[v0]`;
  }

  // speed via setpts (null = pass-through for speed === 1)
  if (speed !== 1) {
    v += `;[v0]setpts=PTS/${speed}[v1]`;
  } else {
    v += `;[v0]null[v1]`;
  }

  // loop count via split + concat
  if (state.loops > 1) {
    const tags = Array.from({ length: state.loops }, (_, i) => `[v1_${i}]`).join("");
    v += `;[v1]split=${state.loops}${tags};${tags}concat=n=${state.loops}:v=1[vout]`;
  } else {
    v += `;[v1]null[vout]`;
  }
  const vTail = "[vout]";

  // ── audio chain ──
  let a = "";
  let aTail = "";
  if (hasAudio) {
    if (state.audio === "reverse" && hasAudioMatch) {
      a = `[0:a]asplit=2[aa][ab];[ab]areverse[ar];[aa][ar]concat=n=2:v=0:a=1[a0]`;
    } else if (state.audio === "reverse" && state.mode === "reverse") {
      a = `[0:a]areverse[a0]`;
    } else {
      // "keep" — forward audio padded with silence to match the doubled
      // video length (palindrome adds 0.4 s of held endpoints).
      if (state.mode === "palindrome") {
        a = `[0:a]apad=whole_dur=${((tOut - tIn) * 2 + 0.4).toFixed(3)}[a0]`;
      } else if (state.mode === "boomerang") {
        a = `[0:a]apad=whole_dur=${((tOut - tIn) * 2).toFixed(3)}[a0]`;
      } else {
        a = `[0:a]anull[a0]`;
      }
    }
    // atempo accepts 0.5–2.0; chain for extremes.
    if (speed !== 1) {
      const chain = atempoChain(speed);
      a += `;[a0]${chain}[a1]`;
    } else {
      a += `;[a0]anull[a1]`;
    }
    if (state.loops > 1) {
      const tags = Array.from({ length: state.loops }, (_, i) => `[a1_${i}]`).join("");
      a += `;[a1]asplit=${state.loops}${tags};${tags}concat=n=${state.loops}:v=0:a=1[aout]`;
    } else {
      a += `;[a1]anull[aout]`;
    }
    aTail = "[aout]";
  }

  const filter = hasAudio ? `${v};${a}` : v;
  args.push("-filter_complex", filter);
  args.push("-map", vTail);
  if (hasAudio) {
    args.push("-map", aTail);
  } else {
    args.push("-an");
  }

  // ── codec / container ──
  const crf = QUALITY_CRF[state.quality] ?? 23;
  if (state.format === "mp4") {
    args.push(
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", String(crf),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
    );
    if (hasAudio) args.push("-c:a", "aac", "-b:a", "128k");
  } else {
    args.push(
      "-c:v", "libvpx-vp9",
      "-b:v", "0",
      "-crf", String(Math.min(crf + 5, 40)),
      "-row-mt", "1",
    );
    if (hasAudio) args.push("-c:a", "libopus", "-b:a", "128k");
  }

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

// ─── run pipeline ──────────────────────────────────────────────────────
async function run() {
  if (!state.file || state.running) return;
  state.running = true;
  btnRun.disabled = true;
  btnCancel.disabled = false;
  if (state.outURL) {
    URL.revokeObjectURL(state.outURL);
    state.outURL = null;
  }
  outEl.innerHTML = "";
  resetLog("starting…");
  setProgress(0);
  clearStatus();

  const startedAt = performance.now();
  const tick = setInterval(() => {
    const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
    stageTimeEl.textContent = `${elapsed}s`;
  }, 200);

  const inExt = (state.file.name.match(/\.[^.]+$/) || [".mp4"])[0].toLowerCase();
  const inName = `in${inExt}`;
  const outName = `out.${state.format}`;

  try {
    setStage("loading engine…", 0);
    const ff = await loadFFmpeg();

    setStage("reading file…", 0);
    await ff.writeFile(inName, await state.ffmpegUtil.fetchFile(state.file));

    setStage("processing…", 0);
    const argv = buildArgs(inName, outName);
    log(`ffmpeg ${argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);

    const code = await ff.exec(argv);
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);

    setStage("finalizing…", 100);
    const data = await ff.readFile(outName);
    const mime = state.format === "mp4" ? "video/mp4" : "video/webm";
    const blob = new Blob([data.buffer], { type: mime });
    state.outURL = URL.createObjectURL(blob);

    renderOutput(blob);

    setStage("done", 100);
    log(`output ${fmtBytes(blob.size)}`);
    setStatus("info", `Done. Output ${fmtBytes(blob.size)}.`);
  } catch (err) {
    console.error(err);
    setStage("error", 0);
    setStatus("error", err?.message || String(err));
    log(`error: ${err?.message || err}`);
  } finally {
    clearInterval(tick);
    try { await state.ffmpeg?.deleteFile(inName); } catch (_) {}
    try { await state.ffmpeg?.deleteFile(outName); } catch (_) {}
    state.running = false;
    btnRun.disabled = false;
    btnCancel.disabled = true;
  }
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
  const base = (state.file.name.replace(/\.[^.]+$/, "")) || "output";
  const suffix = state.mode === "reverse" ? "reversed" : state.mode;
  const ext = state.format;
  const name = `${base}_${suffix}.${ext}`;

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
  dl.href = state.outURL;
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

  const v = document.createElement("video");
  v.src = state.outURL;
  v.controls = true;
  v.loop = true;
  v.playsInline = true;
  v.className = "preview";
  wrap.appendChild(v);
  outEl.appendChild(wrap);
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
    state[opt] = opt === "loops" ? parseInt(val, 10) : val;
    return;
  }
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "reset-opts") resetOptions();
  if (action === "another") resetForAnother();
});

optSpeed.addEventListener("change", () => {
  state.speed = parseFloat(optSpeed.value) || 1;
});

function syncTrimFromNumber(which) {
  const dur = state.meta?.duration || 0;
  if (!dur) return;
  if (which === "in") {
    const v = Math.max(0, Math.min(dur, parseFloat(trimIn.value) || 0));
    trimIn.value = v.toFixed(2);
    trimInR.value = ((v / dur) * 100).toFixed(2);
  } else {
    const v = Math.max(0, Math.min(dur, parseFloat(trimOut.value) || dur));
    trimOut.value = v.toFixed(2);
    trimOutR.value = ((v / dur) * 100).toFixed(2);
  }
  updateTrimWindow();
}
function syncTrimFromRange(which) {
  const dur = state.meta?.duration || 0;
  if (!dur) return;
  if (which === "in") {
    const v = (parseFloat(trimInR.value) / 100) * dur;
    trimIn.value = v.toFixed(2);
  } else {
    const v = (parseFloat(trimOutR.value) / 100) * dur;
    trimOut.value = v.toFixed(2);
  }
  // enforce in < out
  if (parseFloat(trimIn.value) >= parseFloat(trimOut.value)) {
    if (which === "in") {
      trimIn.value = (parseFloat(trimOut.value) - 0.1).toFixed(2);
      trimInR.value = ((parseFloat(trimIn.value) / dur) * 100).toFixed(2);
    } else {
      trimOut.value = (parseFloat(trimIn.value) + 0.1).toFixed(2);
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
  state.mode = "boomerang";
  state.loops = 1;
  state.audio = "drop";
  state.speed = 1;
  state.quality = "medium";
  state.format = "mp4";
  document.querySelectorAll("[data-opt]").forEach((c) => {
    const opt = c.dataset.opt;
    const val = c.dataset.value;
    const active = String(state[opt]) === val;
    c.classList.toggle("is-active", active);
    c.setAttribute("aria-checked", active ? "true" : "false");
  });
  optSpeed.value = "1";
  setStatus("info", "Defaults restored.");
}

function resetForAnother() {
  if (state.outURL) {
    URL.revokeObjectURL(state.outURL);
    state.outURL = null;
  }
  outEl.innerHTML = "";
  resetLog("ready.");
  setProgress(0);
  setStage("idle");
  stageTimeEl.textContent = "";
  clearStatus();
}

// ─── boot ──────────────────────────────────────────────────────────────
setStage("idle");
log(
  self.crossOriginIsolated && typeof SharedArrayBuffer === "function"
    ? "multi-thread ffmpeg available."
    : "single-thread ffmpeg (page is not cross-origin isolated).",
);
