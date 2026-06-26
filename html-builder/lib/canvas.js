/* canvas.js — owns the preview iframe. Renders the model into it (full swap
   on structural change, targeted patch on style/text/attr), frames it to the
   active device width, and wires the in-iframe bridge: click→select,
   mousemove→hover, and palette drag-drop→insert. Same-origin srcdoc so the
   parent can read the iframe DOM for the overlay. */

import * as store from "./store.js";
import { DEVICES, findNode, acceptsChildren } from "./schema.js";
import { buildSrcdoc, applyStylesheet, patchText, patchAttrs, elFor } from "./renderer.js";
import * as overlay from "./overlay.js";
import { nodeFromDrag } from "./palette.js";

let frame = null;     // the <iframe>
let stage = null;     // scroll container
let wrap = null;      // zoom wrapper around the iframe
let iframeDoc = null;
let interactive = false; // "test interactions" mode
let hoverRaf = 0;
let dropInfo = null;  // { parentId, index } resolved during dragover

export function mount(els) {
  frame = els.frame;
  stage = els.stage;
  wrap = els.wrap;
  frame.addEventListener("load", onFrameLoad);
  window.addEventListener("resize", () => overlay.sync());
  stage.addEventListener("scroll", () => overlay.sync(), { passive: true });
  fullRender();
  applyDeviceFrame();
}

export function getDoc() { return iframeDoc; }
export function getFrame() { return frame; }
export function isInteractive() { return interactive; }

export function setInteractive(on) {
  interactive = on;
  fullRender();
}

function fullRender() {
  if (!frame) return;
  frame.srcdoc = buildSrcdoc(store.get(), { interactive });
}

function onFrameLoad() {
  iframeDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
  if (!iframeDoc) return;
  if (!interactive) attachEditorListeners();
  overlay.attach(iframeDoc);
  overlay.sync();
}

function attachEditorListeners() {
  const d = iframeDoc;
  d.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const host = e.target.closest && e.target.closest("[data-hb-id]");
    store.select(host ? host.getAttribute("data-hb-id") : "root");
  }, true);
  d.addEventListener("submit", (e) => e.preventDefault(), true);
  d.addEventListener("mousemove", (e) => {
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const host = e.target.closest && e.target.closest("[data-hb-id]");
      store.hover(host ? host.getAttribute("data-hb-id") : null);
    });
  });
  d.addEventListener("mouseleave", () => store.hover(null));

  // ── palette drag-drop into the canvas ──
  d.addEventListener("dragover", onDragOver);
  d.addEventListener("dragleave", () => { dropInfo = null; overlay.showInsert(null); });
  d.addEventListener("drop", onDrop);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  const target = iframeDoc.elementFromPoint(e.clientX, e.clientY);
  const host = target && target.closest ? target.closest("[data-hb-id]") : null;
  const node = store.get().root;
  if (!host) {
    dropInfo = { parentId: "root", index: node.children.length };
    overlay.showInsertForNode("root", "inside");
    return;
  }
  const id = host.getAttribute("data-hb-id");
  const model = findNode(store.get().root, id);
  const rect = host.getBoundingClientRect();
  const third = rect.height / 3;
  const y = e.clientY - rect.top;
  let mode;
  if (model && acceptsChildren(model.tag) && y > third && y < rect.height - third) {
    dropInfo = { parentId: id, index: (model.children || []).length };
    mode = "inside";
  } else {
    const parent = parentOf(id);
    const idx = parent.children.findIndex((c) => c.id === id);
    const after = y >= rect.height / 2;
    dropInfo = { parentId: parent.id, index: after ? idx + 1 : idx };
    mode = after ? "after" : "before";
  }
  overlay.showInsertForNode(id, mode);
}

function parentOf(id) {
  const root = store.get().root;
  let p = root;
  const walk = (n) => { for (const c of n.children) { if (c.id === id) p = n; else walk(c); } };
  walk(root);
  return p;
}

function onDrop(e) {
  e.preventDefault();
  overlay.showInsert(null);
  const node = nodeFromDrag(e.dataTransfer);
  if (node && dropInfo) store.insert(node, dropInfo);
  dropInfo = null;
}

/* ── device framing & zoom ─────────────────────────────────────────────── */
function applyDeviceFrame() {
  const d = store.get();
  const dev = DEVICES[d.ui.device] || DEVICES.desktop;
  if (wrap) {
    wrap.style.width = dev.width + "px";
    wrap.style.transform = `scale(${d.ui.zoom})`;
    wrap.style.transformOrigin = "top center";
  }
  overlay.sync();
}

/* ── store subscription: decide render strategy ────────────────────────── */
export function onChange(doc, meta) {
  switch (meta.kind) {
    case "full":
    case "structural":
      fullRender(); // onFrameLoad → overlay.sync
      break;
    case "style":
      applyStylesheet(iframeDoc, doc);
      overlay.sync();
      break;
    case "text": {
      const n = meta.nodeId && findNode(doc.root, meta.nodeId);
      if (n) patchText(iframeDoc, n);
      overlay.sync();
      break;
    }
    case "attr": {
      const n = meta.nodeId && findNode(doc.root, meta.nodeId);
      if (n) patchAttrs(iframeDoc, n, doc.assets);
      overlay.sync();
      break;
    }
    case "ui":
      applyDeviceFrame();
      overlay.sync();
      break;
    case "hover":
      overlay.sync();
      break;
  }
}
