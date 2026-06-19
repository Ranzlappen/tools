/* MIUI Theme Studio — editor shell. Owns the state, the canvas render loop,
   the option panels, import/export, and all (delegated) event wiring.
   Heavy libs (JSZip + the exporters) load only on first build/import. */

import * as image from "./lib/image.js";
import * as xml from "./lib/xml.js";
import * as boot from "./lib/boot.js";
import * as packages from "./lib/packages.js";
import * as pc from "./lib/preview-canvas.js";
import { defaultState, validate, slugify, uid, normalizeColor } from "./lib/state.js";
import { DEVICE, KNOWN_PACKAGES, PRESET_APPS, DRAWABLE_DENSITIES } from "./lib/mtz-spec.js";
import { LOCKSCREEN_TYPES, FANCY_TYPES, makeElement, editableFields } from "./lib/maml.js";
import * as gfonts from "./lib/fonts.js";

// ── lazy CDN: JSZip (already pinned + SRI elsewhere in this repo) ──────────
const CDN = {
  jszip: {
    src: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
    sri: "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG",
  },
};
const libCache = new Map();
function loadScript({ src, sri }) {
  if (libCache.has(src)) return libCache.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.integrity = sri;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
  libCache.set(src, p);
  return p;
}
async function ensureJSZip() {
  if (window.JSZip) return window.JSZip;
  await loadScript(CDN.jszip);
  return window.JSZip;
}

// ── DOM helpers ────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const editor = $("#mt-editor");
const canvas = $("#mt-canvas");
const cctx = canvas.getContext("2d");
const inspector = $("#mt-inspector");

let state = defaultState();

// ── canvas image cache + render loop ────────────────────────────────────────
const imgCache = new Map(); // asset -> HTMLImageElement
function getImage(asset) {
  if (!asset || !asset.url) return null;
  let img = imgCache.get(asset);
  if (img === undefined) {
    img = new Image();
    img.onload = () => scheduleRender();
    img.src = asset.url;
    imgCache.set(asset, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    draw();
  });
}
function draw() {
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.clearRect(0, 0, canvas.width, canvas.height);
  cctx.setTransform(canvas.width / DEVICE.width, 0, 0, canvas.height / DEVICE.height, 0, 0);
  const env = {
    img: getImage,
    now: performance.now(),
    fontFamily: state.fonts[0] && state.fonts[0].family ? state.fonts[0].family : null,
    activePackage: state.ui.activePackage || (state.packages[0] && state.packages[0].name),
  };
  pc.render(cctx, state, env);
}

// ── boot playback ────────────────────────────────────────────────────────────
let bootRAF = 0;
let bootLast = 0;
let bootPlaying = true;
function totalFrames() {
  return state.boot.parts.reduce((n, p) => n + p.frames.length, 0);
}
function bootLoop(t) {
  if (state.ui.activeView !== "boot" || reducedMotion()) {
    bootRAF = 0;
    return;
  }
  const frames = totalFrames();
  if (bootPlaying && frames > 0 && t - bootLast > 1000 / (state.boot.fps || 30)) {
    state.ui.bootFrame = (state.ui.bootFrame + 1) % frames;
    bootLast = t;
    scheduleRender();
    const sc = $("#mt-boot-scrub");
    if (sc) sc.value = String(state.ui.bootFrame);
  }
  bootRAF = requestAnimationFrame(bootLoop);
}
function startBootMaybe() {
  if (state.ui.activeView === "boot" && !bootRAF && !reducedMotion()) {
    bootRAF = requestAnimationFrame(bootLoop);
  }
}

// ── status ────────────────────────────────────────────────────────────────
function setStatus(msg, kind = "") {
  const el = $("#mt-status");
  if (!el) return;
  el.textContent = msg;
  el.dataset.kind = kind;
}

// ── files ────────────────────────────────────────────────────────────────
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function registerFonts() {
  for (const f of state.fonts) {
    if (f.family || !f.blob || typeof FontFace === "undefined") continue;
    const family = `mt-font-${slugify(f.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const url = URL.createObjectURL(f.blob);
    const face = new FontFace(family, `url(${url})`);
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        f.family = family;
        scheduleRender();
      })
      .catch(() => {})
      .finally(() => setTimeout(() => URL.revokeObjectURL(url), 5000));
  }
}

// ── pending-file targets (shared hidden inputs, no per-row listeners) ───────
let pendingIconId = null;
let pendingPartName = null;
let pendingDrawableIdx = null;
let pendingFancyIconId = null;

// ── section renderers ───────────────────────────────────────────────────────
function syncMeta() {
  for (const key of ["title", "designer", "author", "version", "uiVersion"]) {
    const el = editor.querySelector(`[data-meta="${key}"]`);
    if (el && document.activeElement !== el) el.value = state.meta[key] ?? "";
  }
}

function thumbHtml(asset, alt) {
  return asset
    ? `<img src="${asset.url}" alt="${alt}" class="mt-thumb" />`
    : `<div class="mt-thumb mt-thumb--empty">none</div>`;
}

function renderWallpaper() {
  $("#mt-wall-home-thumb").innerHTML = thumbHtml(state.wallpaper.home, "home wallpaper");
  $("#mt-wall-lock-thumb").innerHTML = thumbHtml(state.wallpaper.lock, "lock wallpaper");
}

function syncLockMode() {
  const isMaml = state.lockscreen.mode === "maml";
  editor.querySelectorAll('[data-action="lock-mode"]').forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.mode === state.lockscreen.mode));
  });
  $("#mt-maml-wrap").style.display = isMaml ? "flex" : "none";
  renderMaml();
}

function renderMaml() {
  const list = $("#mt-maml-list");
  const els = state.lockscreen.maml.elements;
  list.innerHTML = els.length
    ? els
        .map(
          (el) => `<div class="mt-row" data-el-row="${xml.esc(el.id)}">
            <button class="mt-row__name" data-action="el-select" data-id="${xml.esc(el.id)}">${xml.esc(el.type)}</button>
            <button class="btn btn--ghost btn--copy" data-action="el-remove" data-id="${xml.esc(el.id)}" aria-label="Remove">×</button>
          </div>`,
        )
        .join("")
    : `<p class="mt-hint">No overlays yet — add a clock, date or image.</p>`;
}

function iconThumb(ic) {
  if (ic.image) return `<img src="${xml.esc(ic.image.url)}" alt="" class="mt-icon-thumb" />`;
  return `<div class="mt-icon-thumb mt-thumb--empty">+</div>`;
}
function renderIcons() {
  const list = $("#mt-icons");
  list.innerHTML = state.icons.length
    ? state.icons
        .map(
          (ic) => `<div class="mt-row" data-icon-row="${xml.esc(ic.id)}">
            <button class="mt-row__thumb" data-action="icon-img" data-id="${xml.esc(ic.id)}">${iconThumb(ic)}</button>
            <input class="input input--single" data-icon-field="pkg" data-id="${xml.esc(ic.id)}" value="${xml.esc(ic.pkg || "")}" placeholder="com.example.app" />
            <button class="btn btn--copy${ic.fancy ? " is-active" : ""}" data-action="icon-fancy" data-id="${xml.esc(ic.id)}" title="Animated (MAML) icon">⚡</button>
            <button class="btn btn--ghost btn--copy" data-action="icon-remove" data-id="${xml.esc(ic.id)}" aria-label="Remove">×</button>
          </div>`,
        )
        .join("")
    : `<p class="mt-hint">No icons yet. Drop PNGs (named by package) or add a preset.</p>`;
}

function renderFonts() {
  const list = $("#mt-fonts");
  list.innerHTML = state.fonts.length
    ? state.fonts
        .map(
          (f) => `<div class="mt-row" data-font-row="${xml.esc(f.id)}">
            <span class="mt-row__name" style="font-family:${xml.esc(f.family || "inherit")}">${xml.esc(f.name)}</span>
            <button class="btn btn--ghost btn--copy" data-action="font-remove" data-id="${xml.esc(f.id)}" aria-label="Remove">×</button>
          </div>`,
        )
        .join("")
    : `<p class="mt-hint">No fonts. Upload a .ttf to theme the system font.</p>`;
}

function renderFontCatalog(query = "") {
  const cat = $("#mt-font-cat");
  if (!cat) return;
  const list = gfonts.searchCurated(query);
  let html = list
    .map(
      (f) =>
        `<button class="mt-font-btn" data-action="font-pick" data-slug="${xml.esc(f.slug)}" data-dir="${xml.esc(f.dir)}" data-file="${xml.esc(f.file)}" data-family="${xml.esc(f.family)}">${xml.esc(f.family)}</button>`,
    )
    .join("");
  const q = query.trim();
  if (q && !list.some((f) => f.family.toLowerCase() === q.toLowerCase())) {
    html += `<button class="mt-font-btn mt-font-btn--resolve" data-action="font-resolve" data-family="${xml.esc(q)}">Fetch “${xml.esc(q)}” from Google Fonts ↗</button>`;
  }
  cat.innerHTML = html || `<p class="mt-hint">No matches — type a family name to fetch it.</p>`;
}

function renderBoot() {
  for (const k of ["width", "height", "fps"]) {
    const el = editor.querySelector(`[data-boot="${k}"]`);
    if (el && document.activeElement !== el) el.value = state.boot[k];
  }
  const wrap = $("#mt-boot-parts");
  wrap.innerHTML = state.boot.parts.length
    ? state.boot.parts
        .map(
          (p) => `<div class="mt-part" data-part="${xml.esc(p.name)}">
            <div class="mt-part__head">
              <strong>${xml.esc(p.name)}</strong>
              <span class="mt-hint">${p.frames.length} frames</span>
              <button class="btn btn--ghost btn--copy" data-action="boot-part-remove" data-name="${xml.esc(p.name)}" aria-label="Remove part">×</button>
            </div>
            <div class="mt-part__row">
              <label>loop <input class="input input--single" type="number" min="0" data-boot-part="count" data-name="${xml.esc(p.name)}" value="${xml.esc(p.count)}" /></label>
              <label>pause <input class="input input--single" type="number" min="0" data-boot-part="pause" data-name="${xml.esc(p.name)}" value="${xml.esc(p.pause)}" /></label>
              <button class="btn btn--copy" data-action="boot-part-frames" data-name="${xml.esc(p.name)}">+ frames</button>
            </div>
            <div class="mt-frames">${p.frames
              .map(
                (f, fi) =>
                  `<span class="mt-frame"><img src="${xml.esc(f.url)}" alt="frame ${fi}" /><button data-action="boot-frame-remove" data-name="${xml.esc(p.name)}" data-idx="${fi}" aria-label="Remove frame ${fi}">×</button></span>`,
              )
              .join("")}</div>
          </div>`,
        )
        .join("")
    : `<p class="mt-hint">No parts. Add a part, then upload its PNG frames.</p>`;
  const scrub = $("#mt-boot-scrub");
  if (scrub) scrub.max = String(Math.max(0, totalFrames() - 1));
}

function renderPackages() {
  // active-package selector
  const sel = $("#mt-pkg-active");
  const active = state.ui.activePackage || (state.packages[0] && state.packages[0].name) || "";
  state.ui.activePackage = active;
  sel.innerHTML = state.packages.length
    ? state.packages.map((p) => `<option value="${xml.esc(p.name)}"${p.name === active ? " selected" : ""}>${xml.esc(p.name)}</option>`).join("")
    : `<option value="">— none —</option>`;

  const pkg = packages.findPackage(state, active);
  const ed = $("#mt-pkg-editor");
  if (!pkg) {
    ed.innerHTML = `<p class="mt-hint">Add a system package to override its colors or drawables.</p>`;
    return;
  }
  const colorRows = pkg.colors
    .map(
      (c, i) => `<div class="mt-row" data-color="${i}">
        <input class="input input--single" data-pkg-color="name" data-i="${i}" value="${xml.esc(c.name || "")}" placeholder="color_name" />
        <input type="color" class="mt-color" data-pkg-color="picker" data-i="${i}" value="${xml.esc(argbToHex6(c.value))}" />
        <input class="input input--single mt-hex" data-pkg-color="value" data-i="${i}" value="${xml.esc(c.value || "")}" placeholder="#AARRGGBB" />
        <button class="btn btn--ghost btn--copy" data-action="color-remove" data-i="${i}" aria-label="Remove">×</button>
      </div>`,
    )
    .join("");
  const drawRows = pkg.drawables
    .map(
      (d, i) => `<div class="mt-row" data-draw="${i}">
        <select class="input input--single" data-pkg-draw="density" data-i="${i}">
          ${DRAWABLE_DENSITIES.map((den) => `<option${den === d.density ? " selected" : ""}>${xml.esc(den)}</option>`).join("")}
        </select>
        <input class="input input--single" data-pkg-draw="name" data-i="${i}" value="${xml.esc(d.name || "")}" placeholder="drawable_name" />
        <button class="mt-row__thumb" data-action="drawable-img" data-i="${i}">${d.url ? `<img src="${xml.esc(d.url)}" class="mt-icon-thumb" alt=""/>` : "+"}</button>
        <button class="btn btn--ghost btn--copy" data-action="drawable-remove" data-i="${i}" aria-label="Remove">×</button>
      </div>`,
    )
    .join("");
  ed.innerHTML = `
    <div class="mt-subhead">Colors <button class="btn btn--copy" data-action="color-add">+ add</button>
      <button class="btn btn--ghost btn--copy" data-action="pkg-remove" data-name="${xml.esc(pkg.name)}">remove package</button></div>
    ${colorRows || '<p class="mt-hint">No colors.</p>'}
    <div class="mt-subhead">Drawable replacements <button class="btn btn--copy" data-action="drawable-add">+ add</button></div>
    ${drawRows || '<p class="mt-hint">No drawable overrides.</p>'}`;
}

function renderPreviews() {
  const wrap = $("#mt-previews");
  const imgs = [...(state.previews.thumbnail ? [state.previews.thumbnail] : []), ...state.previews.images];
  for (const p of imgs) if (!p.url && p.blob) p.url = URL.createObjectURL(p.blob);
  wrap.innerHTML = imgs.length
    ? imgs.map((p) => `<figure class="mt-prev"><img src="${xml.esc(p.url)}" alt="${xml.esc(p.name)}" /><figcaption>${xml.esc(p.name)}</figcaption></figure>`).join("")
    : `<p class="mt-hint">No previews yet. Generate them from the canvas.</p>`;
}

function renderInspector() {
  const sel = state.ui.selection;
  if (sel && sel.kind === "lockEl") {
    const el = state.lockscreen.maml.elements.find((e) => e.id === sel.id);
    if (el) return inspector.replaceChildren(elementEditor("lockEl", el, LOCKSCREEN_TYPES, { id: el.id }));
  }
  if (sel && sel.kind === "fancy") {
    const ic = state.icons.find((i) => i.id === sel.iconId);
    if (ic && ic.fancy) return inspector.replaceChildren(fancyEditor(ic));
  }
  inspector.innerHTML = `<p class="mt-inspector__empty">Select a lockscreen overlay or open an animated icon to edit it here.</p>`;
}

function fieldInput(scope, el, field, dataset) {
  const id = `f_${field.key}_${Math.random().toString(36).slice(2, 6)}`;
  const val = el[field.key] ?? "";
  const dataAttrs = `data-el-scope="${xml.esc(scope)}" data-el-key="${xml.esc(field.key)}" ${Object.entries(dataset).map(([k, v]) => `data-${xml.esc(k)}="${xml.esc(v)}"`).join(" ")}`;
  let control;
  if (field.kind === "select") {
    control = `<select class="input input--single" ${dataAttrs}>${field.options.map((o) => `<option${o === val ? " selected" : ""}>${xml.esc(o)}</option>`).join("")}</select>`;
  } else if (field.kind === "color") {
    control = `<input class="input input--single mt-hex" ${dataAttrs} value="${xml.esc(val)}" placeholder="#AARRGGBB" />`;
  } else {
    control = `<input class="input input--single" type="${field.kind === "number" ? "number" : "text"}" ${dataAttrs} value="${xml.esc(val)}" />`;
  }
  return `<label class="mt-field"><span>${xml.esc(field.label)}</span>${control}</label>`;
}

function elementEditor(scope, el, registry, dataset) {
  const wrap = document.createElement("div");
  wrap.innerHTML =
    `<div class="mt-subhead">${xml.esc(el.type)}</div>` +
    editableFields(registry, el.type).map((f) => fieldInput(scope, el, f, dataset)).join("");
  return wrap;
}

function fancyEditor(ic) {
  const wrap = document.createElement("div");
  const opts = Object.keys(FANCY_TYPES).map((t) => `<option>${xml.esc(t)}</option>`).join("");
  wrap.innerHTML =
    `<div class="mt-subhead">${xml.esc(ic.pkg || "icon")} · animated</div>
     <label class="mt-field"><span>Frame rate</span><input class="input input--single" type="number" data-fancy-id="${xml.esc(ic.id)}" data-fancy-key="frameRate" value="${xml.esc(ic.fancy.frameRate)}" /></label>
     <div class="mt-add-row"><select class="input input--single" id="mt-fancy-type">${opts}</select>
       <button class="btn btn--copy" data-action="fancy-add" data-id="${xml.esc(ic.id)}">+ element</button></div>` +
    ic.fancy.elements
      .map(
        (el) =>
          `<div class="mt-el-block"><div class="mt-subhead">${xml.esc(el.type)}<button class="btn btn--ghost btn--copy" data-action="fancy-el-remove" data-id="${xml.esc(ic.id)}" data-el="${xml.esc(el.id)}">×</button></div>` +
          editableFields(FANCY_TYPES, el.type).map((f) => fieldInput("fancyEl", el, f, { id: ic.id, el: el.id })).join("") +
          `</div>`,
      )
      .join("");
  return wrap;
}

function renderValidation() {
  const { errors, warnings } = validate(state);
  const box = $("#mt-validation");
  const parts = [];
  for (const e of errors) parts.push(`<div class="mt-val mt-val--err">${xml.esc(e.msg)}</div>`);
  for (const w of warnings) parts.push(`<div class="mt-val mt-val--warn">${xml.esc(w.msg)}</div>`);
  if (!parts.length) parts.push(`<div class="mt-val mt-val--ok">Ready to build.</div>`);
  box.innerHTML = parts.join("");
  const build = $("#mt-build");
  build.disabled = errors.length > 0;
}

function updateTabs() {
  editor.querySelectorAll("[data-view]").forEach((t) => {
    t.setAttribute("aria-selected", String(t.dataset.view === state.ui.activeView));
  });
  $("#mt-boot-controls").style.display = state.ui.activeView === "boot" ? "" : "none";
}

function renderAll() {
  syncMeta();
  renderWallpaper();
  syncLockMode();
  renderIcons();
  renderFonts();
  renderFontCatalog($("#mt-font-search") ? $("#mt-font-search").value : "");
  renderBoot();
  renderPackages();
  renderPreviews();
  renderInspector();
  renderValidation();
  updateTabs();
  scheduleRender();
}

// ── color helpers for the picker ↔ #AARRGGBB text pair ──────────────────────
function argbToHex6(v) {
  const s = String(v || "").trim();
  if (/^#[0-9a-fA-F]{8}$/.test(s)) return "#" + s.slice(3);
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return "#ffffff";
}
function combineAlpha(existing, hex6) {
  const alpha = /^#[0-9a-fA-F]{8}$/.test(existing || "") ? existing.slice(1, 3) : "FF";
  return ("#" + alpha + hex6.slice(1)).toUpperCase();
}

// ── async actions: build / import / previews ────────────────────────────────
async function buildAndDownload() {
  try {
    setStatus("Building .mtz…");
    const JSZip = await ensureJSZip();
    const { buildMtz } = await import("./exporters/build-mtz.js");
    const { blob } = await buildMtz(state, { JSZip, image, xml, boot, packages });
    downloadBlob(blob, slugify(state.meta.title) + ".mtz");
    setStatus(`Built ${slugify(state.meta.title)}.mtz (${(blob.size / 1024).toFixed(0)} KB).`, "ok");
  } catch (e) {
    setStatus("Build failed: " + e.message, "err");
  }
}

async function importFile(file) {
  try {
    setStatus("Importing…");
    const JSZip = await ensureJSZip();
    const { parseMtz } = await import("./exporters/parse-mtz.js");
    const fresh = defaultState();
    await parseMtz(file, { JSZip, image, xml, boot, state: fresh });
    state = fresh;
    imgCache.clear();
    registerFonts();
    state.ui.activePackage = state.packages[0] ? state.packages[0].name : "";
    renderAll();
    setStatus(`Imported "${state.meta.title}".`, "ok");
  } catch (e) {
    setStatus("Import failed: " + e.message, "err");
  }
}

async function generatePreviewsNow() {
  try {
    setStatus("Rendering previews…");
    const { generatePreviews } = await import("./exporters/previews.js");
    await generatePreviews(state);
    renderPreviews();
    renderValidation();
    setStatus("Previews generated.", "ok");
  } catch (e) {
    setStatus("Preview render failed: " + e.message, "err");
  }
}

async function addGoogleFont(entry) {
  try {
    setStatus(`Fetching ${entry.family}…`);
    const blob = await gfonts.fetchTtf(entry);
    state.fonts.push({ id: uid("ft"), name: gfonts.safeName(entry.family), blob, family: null });
    registerFonts();
    renderFonts();
    renderValidation();
    setStatus(`Added ${entry.family}.`, "ok");
  } catch (e) {
    setStatus(e.message, "err");
  }
}

async function resolveAndAddFont(name) {
  setStatus(`Looking up ${name}…`);
  let entry;
  try {
    entry = await gfonts.resolveFamily(name);
  } catch {
    entry = null;
  }
  if (!entry) {
    setStatus(`Couldn't find "${name}" in Google Fonts. Check the spelling or upload a .ttf.`, "err");
    return;
  }
  await addGoogleFont(entry);
}

function seekTo(video, t) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = t;
    } catch (e) {
      reject(e);
    }
  });
}

async function extractVideoFrames(file) {
  const count = Math.max(2, Math.min(240, Number($("#mt-boot-frame-count").value) || 24));
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    setStatus("Decoding video…");
    await new Promise((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error("Couldn't decode this video format."));
    });
    const dur = isFinite(video.duration) ? video.duration : 0;
    if (!dur) throw new Error("Video has no readable duration.");
    const W = state.boot.width;
    const H = state.boot.height;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d");
    const part = { name: `part${state.boot.parts.length}`, count: state.boot.parts.length ? 1 : 0, pause: 0, frames: [] };
    for (let i = 0; i < count; i += 1) {
      await seekTo(video, (i / (count - 1)) * Math.max(0, dur - 0.05));
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      image.drawFit(ctx, video, W, H, "contain");
      const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
      part.frames.push(await image.toAsset(blob, `${String(i).padStart(4, "0")}.png`));
      setStatus(`Extracting frame ${i + 1}/${count}…`);
    }
    state.boot.parts.push(part);
    renderBoot();
    renderValidation();
    scheduleRender();
    setStatus(`Extracted ${count} frames into ${part.name}.`, "ok");
  } catch (e) {
    setStatus(e.message, "err");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── event delegation ────────────────────────────────────────────────────────
async function setWallpaper(target, file) {
  const asset = await image.toAsset(file, target);
  asset.fit = state.wallpaper[target] ? state.wallpaper[target].fit : "cover";
  if (state.wallpaper[target]) image.revokeAsset(state.wallpaper[target]);
  state.wallpaper[target] = asset;
  renderWallpaper();
  scheduleRender();
}

async function addIconImage(ic, file) {
  const asset = await image.toAsset(file);
  if (ic.image) image.revokeAsset(ic.image);
  ic.image = asset;
  if (!ic.pkg) ic.pkg = file.name.replace(/\.[a-z0-9]+$/i, "");
  renderIcons();
  scheduleRender();
}

function onClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const a = btn.dataset.action;
  const id = btn.dataset.id;
  const name = btn.dataset.name;
  const i = btn.dataset.i != null ? Number(btn.dataset.i) : null;

  switch (a) {
    case "clear-wall": {
      const t = btn.dataset.target;
      if (state.wallpaper[t]) image.revokeAsset(state.wallpaper[t]);
      state.wallpaper[t] = null;
      renderWallpaper();
      renderValidation();
      scheduleRender();
      break;
    }
    case "wall-pick":
      pendingWallTarget = btn.dataset.target;
      $("#mt-wall-file").click();
      break;
    case "lock-mode":
      state.lockscreen.mode = btn.dataset.mode;
      syncLockMode();
      renderValidation();
      scheduleRender();
      break;
    case "lock-add": {
      const type = $("#mt-lock-type").value;
      const el = makeElement(LOCKSCREEN_TYPES, type);
      if (el) {
        state.lockscreen.maml.elements.push(el);
        state.ui.selection = { kind: "lockEl", id: el.id };
        renderMaml();
        renderInspector();
        scheduleRender();
      }
      break;
    }
    case "el-select":
      state.ui.selection = { kind: "lockEl", id };
      renderInspector();
      break;
    case "el-remove":
      state.lockscreen.maml.elements = state.lockscreen.maml.elements.filter((x) => x.id !== id);
      if (state.ui.selection && state.ui.selection.id === id) state.ui.selection = null;
      renderMaml();
      renderInspector();
      scheduleRender();
      break;
    case "icon-add-preset": {
      const pkg = $("#mt-icon-preset").value;
      state.icons.push({ id: uid("ic"), pkg, image: null, fancy: null });
      renderIcons();
      renderValidation();
      break;
    }
    case "icon-add-custom": {
      const input = $("#mt-icon-custom");
      state.icons.push({ id: uid("ic"), pkg: input.value.trim(), image: null, fancy: null });
      input.value = "";
      renderIcons();
      renderValidation();
      break;
    }
    case "icon-bulk":
      $("#mt-icon-bulk-file").click();
      break;
    case "icon-img":
      pendingIconId = id;
      $("#mt-icon-single-file").click();
      break;
    case "icon-fancy": {
      const ic = state.icons.find((x) => x.id === id);
      if (!ic) break;
      if (!ic.fancy) ic.fancy = { frameRate: 30, width: 136, height: 136, assets: [], elements: [] };
      else if (!ic.fancy.elements.length) ic.fancy = null;
      state.ui.selection = ic.fancy ? { kind: "fancy", iconId: id } : null;
      renderIcons();
      renderInspector();
      break;
    }
    case "icon-remove":
      state.icons = state.icons.filter((x) => x.id !== id);
      renderIcons();
      renderValidation();
      scheduleRender();
      break;
    case "fancy-add": {
      const ic = state.icons.find((x) => x.id === id);
      const type = $("#mt-fancy-type").value;
      const el = makeElement(FANCY_TYPES, type);
      if (ic && ic.fancy && el) {
        ic.fancy.elements.push(el);
        renderInspector();
      }
      break;
    }
    case "fancy-el-remove": {
      const ic = state.icons.find((x) => x.id === id);
      if (ic && ic.fancy) ic.fancy.elements = ic.fancy.elements.filter((x) => x.id !== btn.dataset.el);
      renderInspector();
      break;
    }
    case "font-add":
      $("#mt-font-file").click();
      break;
    case "font-pick":
      addGoogleFont({ slug: btn.dataset.slug, dir: btn.dataset.dir, file: btn.dataset.file, family: btn.dataset.family });
      break;
    case "font-resolve":
      resolveAndAddFont(btn.dataset.family);
      break;
    case "font-remove":
      state.fonts = state.fonts.filter((x) => x.id !== id);
      renderFonts();
      renderValidation();
      scheduleRender();
      break;
    case "boot-add-part": {
      const n = `part${state.boot.parts.length}`;
      state.boot.parts.push({ name: n, count: state.boot.parts.length === 0 ? 0 : 1, pause: 0, frames: [] });
      renderBoot();
      break;
    }
    case "boot-part-remove":
      for (const p of state.boot.parts.filter((p) => p.name === name)) p.frames.forEach(image.revokeAsset);
      state.boot.parts = state.boot.parts.filter((p) => p.name !== name);
      renderBoot();
      renderValidation();
      scheduleRender();
      break;
    case "boot-part-frames":
      pendingPartName = name;
      $("#mt-boot-frames-file").click();
      break;
    case "boot-from-video":
      $("#mt-boot-video-file").click();
      break;
    case "boot-frame-remove": {
      const p = state.boot.parts.find((p) => p.name === name);
      if (p) {
        const idx = Number(btn.dataset.idx);
        image.revokeAsset(p.frames[idx]);
        p.frames.splice(idx, 1);
      }
      renderBoot();
      renderValidation();
      scheduleRender();
      break;
    }
    case "pkg-add-known": {
      const v = $("#mt-pkg-known").value;
      if (v) {
        packages.ensurePackage(state, v);
        state.ui.activePackage = v;
        renderPackages();
        renderValidation();
      }
      break;
    }
    case "pkg-add-custom": {
      const input = $("#mt-pkg-custom");
      const v = input.value.trim();
      if (v) {
        packages.ensurePackage(state, v);
        state.ui.activePackage = v;
        input.value = "";
        renderPackages();
        renderValidation();
      }
      break;
    }
    case "pkg-remove":
      packages.removePackage(state, name);
      state.ui.activePackage = state.packages[0] ? state.packages[0].name : "";
      renderPackages();
      renderValidation();
      scheduleRender();
      break;
    case "color-add": {
      const pkg = packages.findPackage(state, state.ui.activePackage);
      if (pkg) {
        pkg.colors.push({ name: "", value: "#FFFFFFFF" });
        renderPackages();
      }
      break;
    }
    case "color-remove": {
      const pkg = packages.findPackage(state, state.ui.activePackage);
      if (pkg) {
        pkg.colors.splice(i, 1);
        renderPackages();
        scheduleRender();
      }
      break;
    }
    case "drawable-add": {
      const pkg = packages.findPackage(state, state.ui.activePackage);
      if (pkg) {
        pkg.drawables.push({ density: "drawable-xxhdpi", name: "", blob: null, url: null });
        renderPackages();
      }
      break;
    }
    case "drawable-remove": {
      const pkg = packages.findPackage(state, state.ui.activePackage);
      if (pkg) {
        pkg.drawables.splice(i, 1);
        renderPackages();
      }
      break;
    }
    case "drawable-img":
      pendingDrawableIdx = i;
      $("#mt-drawable-file").click();
      break;
    case "gen-previews":
      generatePreviewsNow();
      break;
    case "clear-previews":
      state.previews = { thumbnail: null, images: [] };
      renderPreviews();
      renderValidation();
      break;
    case "build":
      buildAndDownload();
      break;
    case "import":
      $("#mt-import-file").click();
      break;
    case "load-sample":
      loadSample();
      break;
    case "reset":
      state = defaultState();
      imgCache.clear();
      renderAll();
      setStatus("Reset.", "");
      break;
    case "boot-play":
      bootPlaying = !bootPlaying;
      btn.textContent = bootPlaying ? "⏸" : "▶";
      startBootMaybe();
      break;
    default:
      break;
  }
}

function onInput(e) {
  const t = e.target;
  if (t.id === "mt-pkg-active") {
    state.ui.activePackage = t.value;
    renderPackages();
    scheduleRender();
    return;
  }
  if (t.id === "mt-font-search") {
    renderFontCatalog(t.value);
    return;
  }
  if (t.dataset.meta) {
    state.meta[t.dataset.meta] = t.type === "number" ? Number(t.value) : t.value;
    renderValidation();
    scheduleRender();
    return;
  }
  if (t.dataset.boot) {
    state.boot[t.dataset.boot] = Number(t.value) || 0;
    scheduleRender();
    return;
  }
  if (t.dataset.bootPart) {
    const p = state.boot.parts.find((p) => p.name === t.dataset.name);
    if (p) p[t.dataset.bootPart] = Number(t.value) || 0;
    return;
  }
  if (t.dataset.iconField === "pkg") {
    const ic = state.icons.find((x) => x.id === t.dataset.id);
    if (ic) ic.pkg = t.value.trim();
    renderValidation();
    scheduleRender();
    return;
  }
  if (t.dataset.pkgColor) {
    const pkg = packages.findPackage(state, state.ui.activePackage);
    if (!pkg) return;
    const c = pkg.colors[Number(t.dataset.i)];
    if (!c) return;
    if (t.dataset.pkgColor === "name") c.name = t.value;
    else if (t.dataset.pkgColor === "value") c.value = t.value;
    else if (t.dataset.pkgColor === "picker") c.value = combineAlpha(c.value, t.value);
    if (t.dataset.pkgColor === "picker") {
      const hex = t.closest(".mt-row").querySelector('[data-pkg-color="value"]');
      if (hex) hex.value = c.value;
    }
    renderValidation();
    scheduleRender();
    return;
  }
  if (t.dataset.pkgDraw) {
    const pkg = packages.findPackage(state, state.ui.activePackage);
    if (!pkg) return;
    const d = pkg.drawables[Number(t.dataset.i)];
    if (d) d[t.dataset.pkgDraw] = t.value;
    return;
  }
  if (t.dataset.elScope) {
    applyElField(t);
    return;
  }
  if (t.dataset.fancyId) {
    const ic = state.icons.find((x) => x.id === t.dataset.fancyId);
    if (ic && ic.fancy) ic.fancy[t.dataset.fancyKey] = Number(t.value) || t.value;
    return;
  }
  if (t.dataset.wallFit) {
    const w = state.wallpaper[t.dataset.wallFit];
    if (w) w.fit = t.value;
    scheduleRender();
  }
}

function applyElField(t) {
  const scope = t.dataset.elScope;
  const key = t.dataset.elKey;
  let val = t.value;
  if (t.type === "number") val = Number(val);
  if (scope === "lockEl") {
    const el = state.lockscreen.maml.elements.find((x) => x.id === t.dataset.id);
    if (el) el[key] = val;
  } else if (scope === "fancyEl") {
    const ic = state.icons.find((x) => x.id === t.dataset.id);
    const el = ic && ic.fancy && ic.fancy.elements.find((x) => x.id === t.dataset.el);
    if (el) el[key] = val;
  }
  scheduleRender();
}

// ── hidden-input change handlers ────────────────────────────────────────────
let pendingWallTarget = null;
function wireFileInputs() {
  $("#mt-wall-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (f && pendingWallTarget) await setWallpaper(pendingWallTarget, f);
    e.target.value = "";
  });
  $("#mt-icon-bulk-file").addEventListener("change", async (e) => {
    for (const f of e.target.files) {
      const pkg = f.name.replace(/\.[a-z0-9]+$/i, "");
      const asset = await image.toAsset(f);
      state.icons.push({ id: uid("ic"), pkg, image: asset, fancy: null });
    }
    e.target.value = "";
    renderIcons();
    renderValidation();
    scheduleRender();
  });
  $("#mt-icon-single-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    const ic = state.icons.find((x) => x.id === pendingIconId);
    if (f && ic) await addIconImage(ic, f);
    e.target.value = "";
  });
  $("#mt-font-file").addEventListener("change", async (e) => {
    for (const f of e.target.files) {
      state.fonts.push({ id: uid("ft"), name: f.name, blob: f, family: null });
    }
    e.target.value = "";
    registerFonts();
    renderFonts();
    renderValidation();
  });
  $("#mt-boot-frames-file").addEventListener("change", async (e) => {
    const p = state.boot.parts.find((p) => p.name === pendingPartName);
    if (p) {
      const files = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      for (const f of files) p.frames.push(await image.toAsset(f));
    }
    e.target.value = "";
    renderBoot();
    renderValidation();
    scheduleRender();
  });
  $("#mt-drawable-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    const pkg = packages.findPackage(state, state.ui.activePackage);
    if (f && pkg && pendingDrawableIdx != null) {
      const a = await image.toAsset(f);
      const d = pkg.drawables[pendingDrawableIdx];
      if (d) {
        d.blob = a.blob;
        d.url = a.url;
        if (!d.name) d.name = f.name.replace(/\.[a-z0-9]+$/i, "");
      }
      renderPackages();
    }
    e.target.value = "";
  });
  $("#mt-boot-video-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (f) await extractVideoFrames(f);
    e.target.value = "";
  });
  $("#mt-import-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (f) await importFile(f);
    e.target.value = "";
  });
}

// ── sample ──────────────────────────────────────────────────────────────────
function loadSample() {
  state = defaultState();
  state.meta = { title: "Neon Grid", designer: "ranzlappen", author: "you", version: 1, uiVersion: 14 };
  state.lockscreen.mode = "maml";
  state.lockscreen.maml.elements = [
    makeElement(LOCKSCREEN_TYPES, "Time"),
    makeElement(LOCKSCREEN_TYPES, "DateTime"),
  ];
  const sysui = packages.ensurePackage(state, "com.android.systemui");
  sysui.colors[0].value = "#FF4ADE80";
  state.icons = PRESET_APPS.slice(0, 8).map((a) => ({ id: uid("ic"), pkg: a.pkg, image: null, fancy: null }));
  state.ui.activePackage = "com.android.systemui";
  imgCache.clear();
  renderAll();
  setStatus("Loaded sample theme. Add wallpapers and icons, then Build.", "");
}

// ── view tabs / zoom ──────────────────────────────────────────────────────────
function wireViewControls() {
  editor.querySelectorAll("[data-view]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.ui.activeView = tab.dataset.view;
      updateTabs();
      scheduleRender();
      startBootMaybe();
    });
  });
  const zoom = $("#mt-zoom");
  zoom.addEventListener("input", () => {
    state.ui.zoom = Number(zoom.value);
    $("#mt-phone").style.setProperty("--mt-zoom", String(state.ui.zoom));
    $("#mt-zoom-val").textContent = `${state.ui.zoom.toFixed(1)}×`;
  });
  const scrub = $("#mt-boot-scrub");
  scrub.addEventListener("input", () => {
    bootPlaying = false;
    const pb = $('[data-action="boot-play"]');
    if (pb) pb.textContent = "▶";
    state.ui.bootFrame = Number(scrub.value) || 0;
    scheduleRender();
  });
}

// ── boot ──────────────────────────────────────────────────────────────────
function populateStaticSelects() {
  $("#mt-icon-preset").innerHTML = PRESET_APPS.map(
    (a) => `<option value="${a.pkg}">${a.label} — ${a.pkg}</option>`,
  ).join("");
  $("#mt-pkg-known").innerHTML = KNOWN_PACKAGES.map((p) => `<option value="${p}">${p}</option>`).join("");
}

function init() {
  // canvas backing store: half device resolution for perf, CSS scales it.
  canvas.width = Math.round(DEVICE.width / 2);
  canvas.height = Math.round(DEVICE.height / 2);

  populateStaticSelects();

  // The inspector lives inside #mt-editor, so a single delegated set of
  // listeners on the root covers every panel including the inspector.
  editor.addEventListener("click", onClick);
  editor.addEventListener("input", onInput);
  editor.addEventListener("change", onInput);
  wireFileInputs();
  wireViewControls();

  renderAll();
}

init();
