/* tool.js — HTML Builder shell. Owns the toolbar, keyboard map, code modal,
   and export; wires the store's change stream to the canvas, overlay, layers
   tree, and inspector. Heavy libs (JSZip) and the exporters load only on first
   code-view / export. */

import * as store from "./lib/store.js";
import * as schema from "./lib/schema.js";
import * as canvas from "./lib/canvas.js";
import * as overlay from "./lib/overlay.js";
import * as layers from "./lib/layers.js";
import * as inspector from "./lib/inspector.js";
import * as palette from "./lib/palette.js";
import * as persistence from "./lib/persistence.js";
import { PRESETS } from "./lib/palette.js";
import { downloadFile } from "./lib/download.js";

const $ = (s) => document.querySelector(s);

/* ── lazy JSZip (pinned + SRI, same as siblings) ───────────────────────── */
const JSZIP_CDN = {
  src: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  sri: "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG",
};
let jszipPromise = null;
function ensureJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jszipPromise) {
    jszipPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = JSZIP_CDN.src; s.integrity = JSZIP_CDN.sri;
      s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer";
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => reject(new Error("Failed to load JSZip"));
      document.head.appendChild(s);
    });
  }
  return jszipPromise;
}

/* ── DOM ───────────────────────────────────────────────────────────────── */
const els = {};
function cacheEls() {
  els.palette = $("#hb-palette");
  els.layers = $("#hb-layers");
  els.inspector = $("#hb-inspector");
  els.frame = $("#hb-frame");
  els.stage = $("#hb-stage");
  els.wrap = $("#hb-frame-wrap");
  els.overlay = $("#hb-overlay");
  els.undo = $("#hb-undo");
  els.redo = $("#hb-redo");
  els.test = $("#hb-test");
  els.zoomLabel = $("#hb-zoom-label");
  els.status = $("#hb-status");
  els.statusText = $("#hb-status-text");
  els.codeModal = $("#hb-code-modal");
  els.codeOut = $("#hb-code-out");
}

/* ── status banner ─────────────────────────────────────────────────────── */
let statusTimer = 0;
function status(msg) {
  els.status.hidden = false;
  els.statusText.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { els.status.hidden = true; }, 2600);
}
// modules (inspector, etc.) surface user-facing messages via this event
window.addEventListener("hb:notify", (e) => status(e.detail));

/* ── toolbar state ─────────────────────────────────────────────────────── */
function updateToolbar() {
  const d = store.get();
  els.undo.disabled = !store.canUndo();
  els.redo.disabled = !store.canRedo();
  els.zoomLabel.textContent = Math.round(d.ui.zoom * 100) + "%";
  document.querySelectorAll("[data-device]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.getAttribute("data-device") === d.ui.device)));
  els.test.classList.toggle("is-active", canvas.isInteractive());
}

/* ── code modal ────────────────────────────────────────────────────────── */
let codeSources = { html: "", css: "", js: "" };
let codeTab = "html";
async function openCode() {
  try {
    const ex = await import("./exporters/index.js");
    codeSources = ex.splitSources(store.get());
    showCode("html");
    els.codeModal.showModal();
  } catch (e) { status("Could not generate code."); console.error(e); }
}
function showCode(tab) {
  codeTab = tab;
  els.codeOut.textContent = codeSources[tab] || "";
  document.querySelectorAll("[data-code-tab]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.getAttribute("data-code-tab") === tab)));
}

/* ── exports ───────────────────────────────────────────────────────────── */
async function exportHtml() {
  try {
    const { buildHtml } = await import("./exporters/index.js");
    downloadFile(buildHtml(store.get()), filename("html"), "text/html");
    status("Exported index.html");
  } catch (e) { status("Export failed."); console.error(e); }
}
async function exportZip() {
  try {
    status("Building ZIP…");
    const JSZip = await ensureJSZip();
    const { buildZip } = await import("./exporters/index.js");
    const blob = await buildZip(store.get(), { JSZip });
    downloadFile(blob, filename("zip"), "application/zip");
    status("Exported ZIP");
  } catch (e) { status("ZIP export failed."); console.error(e); }
}
function filename(ext) {
  const t = (store.get().meta.title || "page").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
  return `${t}.${ext === "zip" ? "zip" : "html"}`;
}

function share() {
  const { hash, droppedAssets } = persistence.toHash(store.get());
  const url = location.origin + location.pathname + "#" + hash;
  location.hash = hash;
  const msg = droppedAssets ? "Link copied — uploaded images aren't included; export a file to keep them" : "Share link copied";
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => status(msg)).catch(() => status("Share link in address bar"));
  else status("Share link in address bar");
}

/* ── starter document ──────────────────────────────────────────────────── */
function starterDoc() {
  const d = schema.defaultDoc();
  const hero = PRESETS.hero();
  d.root.children.push(hero);
  d.ui.selectedId = hero.id;
  d.ui.expandedIds = ["root", hero.id];
  return d;
}

/* ── left tabs ─────────────────────────────────────────────────────────── */
function setLeftTab(tab) {
  document.querySelectorAll("[data-left-tab]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.getAttribute("data-left-tab") === tab)));
  document.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.getAttribute("data-pane") !== tab; });
}

/* ── wiring ────────────────────────────────────────────────────────────── */
function wireToolbar() {
  document.addEventListener("click", (e) => {
    const lt = e.target.closest("[data-left-tab]");
    if (lt) { setLeftTab(lt.getAttribute("data-left-tab")); return; }
    const dev = e.target.closest("[data-device]");
    if (dev) { store.setDevice(dev.getAttribute("data-device")); return; }
    const zoom = e.target.closest("[data-zoom]");
    if (zoom) { store.setZoom(store.get().ui.zoom + Number(zoom.getAttribute("data-zoom")) * 0.1); return; }
    const ct = e.target.closest("[data-code-tab]");
    if (ct) { showCode(ct.getAttribute("data-code-tab")); return; }
  });

  els.undo.addEventListener("click", () => store.undo());
  els.redo.addEventListener("click", () => store.redo());
  els.test.addEventListener("click", () => {
    canvas.setInteractive(!canvas.isInteractive());
    updateToolbar();
    status(canvas.isInteractive() ? "Test mode — interactions live. Click ▶ Test to exit." : "Editing mode");
  });
  $("#hb-code").addEventListener("click", openCode);
  $("#hb-share").addEventListener("click", share);
  $("#hb-export-html").addEventListener("click", exportHtml);
  $("#hb-export-zip").addEventListener("click", exportZip);
  $("#hb-reset").addEventListener("click", () => {
    if (confirm("Clear the canvas and start over? This cannot be undone.")) {
      persistence.clearLocal();
      history.replaceState(null, "", location.pathname);
      store.load(schema.defaultDoc());
    }
  });
  $("#hb-code-copy").addEventListener("click", () => {
    if (navigator.clipboard) navigator.clipboard.writeText(codeSources[codeTab] || "").then(() => status("Copied"));
  });
  $("#hb-code-close").addEventListener("click", () => els.codeModal.close());
}

function wireKeyboard() {
  document.addEventListener("keydown", (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) store.redo(); else store.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); store.redo(); return; }
    if (mod && e.key.toLowerCase() === "d") {
      const id = store.get().ui.selectedId;
      if (id && id !== "root") { e.preventDefault(); store.duplicate(id); }
      return;
    }
    if (!inField && (e.key === "Delete" || e.key === "Backspace")) {
      const id = store.get().ui.selectedId;
      if (id && id !== "root") { e.preventDefault(); store.remove(id); }
      return;
    }
    if (e.key === "Escape") {
      if (canvas.isInteractive()) { canvas.setInteractive(false); updateToolbar(); }
      else store.select(null);
    }
  });
}

/* ── boot ──────────────────────────────────────────────────────────────── */
function init() {
  cacheEls();

  palette.mount(els.palette);
  layers.mount(els.layers);
  inspector.mount(els.inspector);
  overlay.mount({ layer: els.overlay, frame: els.frame });
  canvas.mount({ frame: els.frame, stage: els.stage, wrap: els.wrap });

  store.subscribe((doc, meta) => {
    canvas.onChange(doc, meta);
    if (meta.kind === "hover") return; // overlay already synced by canvas
    layers.render();
    inspector.onChange(doc, meta);
    updateToolbar();
    persistence.save(doc);
  });

  wireToolbar();
  wireKeyboard();

  // initial document: share hash > local autosave > starter
  const fromHash = persistence.fromHash(location.hash);
  const local = fromHash ? null : persistence.loadLocal();
  store.load(fromHash || local || starterDoc());

  setLeftTab("palette");
  updateToolbar();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
