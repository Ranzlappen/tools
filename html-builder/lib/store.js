/* store.js — the state spine. Holds the live Doc, exposes mutation helpers,
   undo/redo, and a subscriber list. No DOM. Every panel reads from here and
   writes back through mutate(); nothing else owns state.

   Undo model mirrors flipper-gui: snapshot the whole doc *before* a change.
   Rapid same-target edits (e.g. dragging a slider) coalesce into one history
   entry via a coalesce key + time window. */

import { cloneDoc, migrate, defaultDoc, findNode, findParent, isAncestor, acceptsChildren, cloneNode } from "./schema.js";

const UNDO_MAX = 60;
const COALESCE_MS = 600;

let doc = defaultDoc();
const subs = new Set();
const undoStack = [];
const redoStack = [];
let lastCoalesceKey = null;
let lastPushAt = 0;

/* ── subscriptions ─────────────────────────────────────────────────────── */
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function emit(meta) {
  for (const fn of subs) {
    try { fn(doc, meta); } catch (e) { console.error("[html-builder] subscriber error", e); }
  }
}

export const get = () => doc;

export function load(next) {
  doc = migrate(next);
  undoStack.length = 0;
  redoStack.length = 0;
  lastCoalesceKey = null;
  emit({ kind: "full" });
}

export function reset() {
  load(defaultDoc());
}

/* ── core mutation ─────────────────────────────────────────────────────────
   opts: { kind, nodeId, coalesce, label }
   kind drives the render strategy in the shell: "structural" => full re-render,
   "style"/"text"/"attr" => targeted patch, "ui" => no history, panels only. */
export function mutate(fn, opts = {}) {
  const kind = opts.kind || "structural";

  if (kind === "ui") {
    fn(doc);
    emit({ kind: "ui", nodeId: opts.nodeId });
    return;
  }

  const now = Date.now();
  const coalesce = opts.coalesce || null;
  const canCoalesce = coalesce && coalesce === lastCoalesceKey && now - lastPushAt < COALESCE_MS && undoStack.length > 0;

  if (!canCoalesce) {
    undoStack.push(cloneDoc(doc));
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack.length = 0;
    lastPushAt = now;
    lastCoalesceKey = coalesce; // null for non-coalescing edits => next edit always pushes
  } else {
    lastPushAt = now;
  }

  fn(doc);
  emit({ kind, nodeId: opts.nodeId });
}

/* UI-only state (selection, hover, device, zoom, expanded) — never undoable. */
export function ui(fn, nodeId) {
  mutate(fn, { kind: "ui", nodeId });
}

/* ── history ───────────────────────────────────────────────────────────── */
export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(cloneDoc(doc));
  doc = undoStack.pop();
  lastCoalesceKey = null;
  emit({ kind: "full" });
}
export function redo() {
  if (!redoStack.length) return;
  undoStack.push(cloneDoc(doc));
  doc = redoStack.pop();
  lastCoalesceKey = null;
  emit({ kind: "full" });
}

/* ── selection / hover / device (UI) ───────────────────────────────────── */
export function select(id) {
  ui((d) => { d.ui.selectedId = id; }, id);
}
export function hover(id) {
  if (doc.ui.hoverId === id) return;
  doc.ui.hoverId = id;
  emit({ kind: "hover", nodeId: id }); // lightweight: overlay only, no panel rebuilds
}
export function setDevice(device) {
  ui((d) => { d.ui.device = device; });
}
export function setZoom(zoom) {
  ui((d) => { d.ui.zoom = Math.max(0.25, Math.min(2, zoom)); });
}
export function toggleExpand(id, force) {
  ui((d) => {
    const set = new Set(d.ui.expandedIds);
    const open = force == null ? !set.has(id) : force;
    if (open) set.add(id); else set.delete(id);
    d.ui.expandedIds = [...set];
  });
}

/* ── structural helpers ────────────────────────────────────────────────── */

/* Resolve a drop into a concrete (parentId, index). If the chosen parent
   can't hold children, fall back to inserting next to it under its parent. */
function resolveTarget(d, parentId, index) {
  let parent = parentId ? findNode(d.root, parentId) : d.root;
  if (!parent) parent = d.root;
  if (!acceptsChildren(parent.tag)) {
    const gp = findParent(d.root, parent.id) || d.root;
    const at = gp.children.findIndex((c) => c.id === parent.id);
    return { parent: gp, index: at + 1 };
  }
  const at = index == null ? parent.children.length : Math.max(0, Math.min(index, parent.children.length));
  return { parent, index: at };
}

export function insert(node, { parentId = null, index = null } = {}) {
  mutate((d) => {
    const { parent, index: at } = resolveTarget(d, parentId, index);
    parent.children.splice(at, 0, node);
    d.ui.selectedId = node.id;
    if (!d.ui.expandedIds.includes(parent.id)) d.ui.expandedIds.push(parent.id);
  }, { kind: "structural", nodeId: node.id });
}

export function move(id, { parentId = null, index = null } = {}) {
  if (id === "root") return;
  // block dropping into own subtree
  if (parentId && isAncestor(doc.root, id, parentId)) return;
  mutate((d) => {
    const cur = findParent(d.root, id);
    if (!cur) return;
    const fromIdx = cur.children.findIndex((c) => c.id === id);
    const node = cur.children[fromIdx];
    const { parent, index: at } = resolveTarget(d, parentId, index);
    // adjust index when moving within the same parent below the original slot
    let target = at;
    if (parent.id === cur.id && fromIdx < at) target -= 1;
    cur.children.splice(fromIdx, 1);
    parent.children.splice(target, 0, node);
    if (!d.ui.expandedIds.includes(parent.id)) d.ui.expandedIds.push(parent.id);
  }, { kind: "structural", nodeId: id });
}

export function remove(id) {
  if (id === "root") return;
  mutate((d) => {
    const parent = findParent(d.root, id);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === id);
    parent.children.splice(idx, 1);
    if (d.ui.selectedId === id) d.ui.selectedId = parent.id === "root" ? null : parent.id;
  }, { kind: "structural", nodeId: id });
}

export function duplicate(id) {
  if (id === "root") return;
  mutate((d) => {
    const parent = findParent(d.root, id);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === id);
    const copy = cloneNode(parent.children[idx]);
    parent.children.splice(idx + 1, 0, copy);
    d.ui.selectedId = copy.id;
  }, { kind: "structural", nodeId: id });
}

/* ── property helpers ──────────────────────────────────────────────────── */
export function setStyle(id, prop, value, layer = "base") {
  mutate((d) => {
    const n = findNode(d.root, id);
    if (!n) return;
    if (value === "" || value == null) delete n.styles[layer][prop];
    else n.styles[layer][prop] = value;
  }, { kind: "style", nodeId: id, coalesce: `style:${id}:${layer}:${prop}` });
}

export function setStyles(id, obj, layer = "base") {
  mutate((d) => {
    const n = findNode(d.root, id);
    if (!n) return;
    for (const [prop, value] of Object.entries(obj)) {
      if (value === "" || value == null) delete n.styles[layer][prop];
      else n.styles[layer][prop] = value;
    }
  }, { kind: "style", nodeId: id });
}

export function setText(id, text) {
  mutate((d) => {
    const n = findNode(d.root, id);
    if (n) n.text = text;
  }, { kind: "text", nodeId: id, coalesce: `text:${id}` });
}

export function setAttr(id, name, value) {
  mutate((d) => {
    const n = findNode(d.root, id);
    if (!n) return;
    if (value === "" || value == null || value === false) delete n.attrs[name];
    else n.attrs[name] = value;
  }, { kind: "attr", nodeId: id, coalesce: `attr:${id}:${name}` });
}

export function setClasses(id, classes) {
  mutate((d) => {
    const n = findNode(d.root, id);
    if (n) n.classes = classes;
  }, { kind: "attr", nodeId: id });
}

export function setBehaviors(id, behaviors) {
  mutate((d) => {
    const n = findNode(d.root, id);
    if (n) n.behaviors = behaviors;
  }, { kind: "attr", nodeId: id });
}

export function setName(id, name) {
  mutate((d) => {
    const n = findNode(d.root, id);
    if (n) n.name = name;
  }, { kind: "ui", nodeId: id });
}

export function setMeta(patch) {
  mutate((d) => { Object.assign(d.meta, patch); }, { kind: "attr" });
}

export function setGlobalCss(css) {
  mutate((d) => { d.globals.customCss = css; }, { kind: "style" });
}

/* ── asset registry ────────────────────────────────────────────────────── */
export function addAsset(asset) {
  // registry change only; the referencing setAttr() drives the re-render.
  // kind "ui" keeps it out of the undo history (the orphan, if any, is pruned
  // on export) while autosave still persists it.
  mutate((d) => {
    if (!Array.isArray(d.assets)) d.assets = [];
    if (!d.assets.some((a) => a.id === asset.id)) d.assets.push(asset);
  }, { kind: "ui" });
}

export function removeAsset(id) {
  mutate((d) => {
    d.assets = (d.assets || []).filter((a) => a.id !== id);
  }, { kind: "ui" });
}
