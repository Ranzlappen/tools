/* overlay.js — draws the selection box, hover outline, resize handles, and
   drag-drop insertion marker in the PARENT document, positioned over the
   iframe. Owns the coordinate mapping between the iframe's internal layout
   (CSS px, device width) and the parent screen, accounting for zoom scale
   and the iframe's own scroll. */

import * as store from "./store.js";
import { findNode, DEVICES, findParent } from "./schema.js";
import { elFor } from "./renderer.js";

let layer = null;     // parent overlay element (position:absolute over stage)
let frame = null;     // the <iframe>
let iframeDoc = null;
let sel, selLabel, hov, marker;
let handles = [];
let resizing = null;

export function mount(els) {
  layer = els.layer;
  frame = els.frame;
  build();
}

function build() {
  layer.innerHTML = "";
  hov = div("hb-ov hb-ov--hover");
  sel = div("hb-ov hb-ov--sel");
  selLabel = div("hb-ov__label");
  sel.appendChild(selLabel);
  for (const dir of ["nw", "ne", "sw", "se", "e", "s"]) {
    const h = div("hb-ov__handle hb-ov__handle--" + dir);
    h.dataset.dir = dir;
    h.addEventListener("pointerdown", (e) => startResize(e, dir));
    sel.appendChild(h);
    handles.push(h);
  }
  marker = div("hb-ov__marker");
  layer.append(hov, sel, marker);
  hideAll();
}

function div(cls) { const d = document.createElement("div"); d.className = cls; return d; }
function hideAll() { hov.style.display = "none"; sel.style.display = "none"; marker.style.display = "none"; }

export function attach(doc) { iframeDoc = doc; }

/* scale = rendered width / unscaled layout width (= zoom). */
function metrics() {
  if (!frame) return null;
  const fr = frame.getBoundingClientRect();
  const lr = layer.getBoundingClientRect();
  const scale = frame.clientWidth ? fr.width / frame.clientWidth : 1;
  return { fr, lr, scale };
}

function boxFor(id) {
  if (!iframeDoc) return null;
  const el = elFor(iframeDoc, id);
  if (!el) return null;
  const m = metrics();
  if (!m) return null;
  const r = el.getBoundingClientRect();
  return {
    left: m.fr.left - m.lr.left + r.left * m.scale,
    top: m.fr.top - m.lr.top + r.top * m.scale,
    width: r.width * m.scale,
    height: r.height * m.scale,
  };
}

function place(el, b) {
  el.style.display = "block";
  el.style.left = b.left + "px";
  el.style.top = b.top + "px";
  el.style.width = b.width + "px";
  el.style.height = b.height + "px";
}

export function sync() {
  if (!layer || !iframeDoc) return;
  const d = store.get();
  // hover
  const hid = d.ui.hoverId;
  if (hid && hid !== d.ui.selectedId) {
    const b = boxFor(hid);
    if (b) place(hov, b); else hov.style.display = "none";
  } else hov.style.display = "none";
  // selection
  const sid = d.ui.selectedId;
  if (sid) {
    const b = boxFor(sid);
    if (b) {
      place(sel, b);
      const node = findNode(d.root, sid);
      selLabel.textContent = label(node);
    } else sel.style.display = "none";
  } else sel.style.display = "none";
}

function label(node) {
  if (!node) return "";
  if (node.id === "root") return "body";
  return node.name || node.tag + (node.classes && node.classes[0] ? "." + node.classes[0] : "");
}

/* ── insertion marker for drag-drop ────────────────────────────────────── */
export function showInsert(rect) {
  if (!rect) { marker.style.display = "none"; return; }
  marker.style.display = "block";
  Object.assign(marker.style, { left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", height: rect.height + "px" });
  marker.classList.toggle("hb-ov__marker--inside", !!rect.inside);
}

export function showInsertForNode(id, mode) {
  const b = boxFor(id);
  if (!b) { showInsert(null); return; }
  if (mode === "inside") {
    showInsert({ left: b.left, top: b.top, width: b.width, height: b.height, inside: true });
  } else if (mode === "before") {
    showInsert({ left: b.left, top: b.top - 1, width: b.width, height: 2 });
  } else {
    showInsert({ left: b.left, top: b.top + b.height - 1, width: b.width, height: 2 });
  }
}

/* ── resize handles ────────────────────────────────────────────────────── */
function startResize(e, dir) {
  e.preventDefault();
  e.stopPropagation();
  const d = store.get();
  const id = d.ui.selectedId;
  if (!id || id === "root") return;
  const el = elFor(iframeDoc, id);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const m = metrics();
  resizing = {
    id, dir,
    startX: e.clientX, startY: e.clientY,
    w0: r.width, h0: r.height,
    scale: m ? m.scale : 1,
    layerName: (DEVICES[d.ui.device] || DEVICES.desktop).layer,
  };
  window.addEventListener("pointermove", onResizeMove);
  window.addEventListener("pointerup", endResize, { once: true });
}

function onResizeMove(e) {
  if (!resizing) return;
  const dx = (e.clientX - resizing.startX) / resizing.scale;
  const dy = (e.clientY - resizing.startY) / resizing.scale;
  const patch = {};
  if (resizing.dir.includes("e")) patch.width = Math.max(8, Math.round(resizing.w0 + dx)) + "px";
  if (resizing.dir.includes("s")) patch.height = Math.max(8, Math.round(resizing.h0 + dy)) + "px";
  if (resizing.dir === "se" || resizing.dir === "e" || resizing.dir === "s") {
    store.setStyles(resizing.id, patch, resizing.layerName);
  } else {
    // nw/ne/sw: keep it simple — adjust width/height only (no reflow of position)
    if (resizing.dir.includes("e") || resizing.dir.includes("w")) patch.width = Math.max(8, Math.round(resizing.w0 + (resizing.dir.includes("w") ? -dx : dx))) + "px";
    if (resizing.dir.includes("s") || resizing.dir.includes("n")) patch.height = Math.max(8, Math.round(resizing.h0 + (resizing.dir.includes("n") ? -dy : dy))) + "px";
    store.setStyles(resizing.id, patch, resizing.layerName);
  }
}

function endResize() {
  resizing = null;
  window.removeEventListener("pointermove", onResizeMove);
}
