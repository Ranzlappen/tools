/* layers.js — the hierarchical tree panel. Renders the node tree, syncs
   selection, expand/collapse, and supports drag-to-reparent/reorder plus
   palette drops. All structural edits go through the store's move/insert. */

import * as store from "./store.js";
import { tagInfo, acceptsChildren, isAncestor } from "./schema.js";
import { nodeFromDrag } from "./palette.js";

let el = null;
let dragId = null;

export function mount(container) {
  el = container;
  el.addEventListener("click", onClick);
  el.addEventListener("dragstart", onDragStart);
  el.addEventListener("dragover", onDragOver);
  el.addEventListener("dragleave", onDragLeave);
  el.addEventListener("drop", onDrop);
  el.addEventListener("dragend", clearMarks);
  render();
}

function label(node) {
  if (node.id === "root") return "body";
  const info = tagInfo(node.tag);
  const cls = node.classes && node.classes[0] ? "." + node.classes[0] : "";
  return node.name || `${node.tag}${cls}`;
}

export function render() {
  if (!el) return;
  const d = store.get();
  const expanded = new Set(d.ui.expandedIds);
  const sel = d.ui.selectedId;
  const rows = [];
  const walk = (node, depth) => {
    const hasKids = node.children && node.children.length;
    const isOpen = expanded.has(node.id);
    const selCls = node.id === sel ? " is-selected" : "";
    rows.push(
      `<div class="hb-tree__row${selCls}" data-id="${node.id}" draggable="${node.id !== "root"}" style="padding-left:${4 + depth * 14}px">` +
      `<span class="hb-tree__tog" data-tog="${node.id}">${hasKids ? (isOpen ? "▾" : "▸") : ""}</span>` +
      `<span class="hb-tree__icon">${acceptsChildren(node.tag) ? "▢" : "—"}</span>` +
      `<span class="hb-tree__label">${escape(label(node))}</span>` +
      `</div>`
    );
    if (hasKids && isOpen) node.children.forEach((c) => walk(c, depth + 1));
  };
  walk(d.root, 0);
  el.innerHTML = `<div class="hb-tree">${rows.join("")}</div>`;
}

function escape(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

function onClick(e) {
  const tog = e.target.closest("[data-tog]");
  if (tog) { store.toggleExpand(tog.getAttribute("data-tog")); return; }
  const row = e.target.closest("[data-id]");
  if (row) store.select(row.getAttribute("data-id"));
}

/* ── drag & drop ───────────────────────────────────────────────────────── */
function onDragStart(e) {
  const row = e.target.closest("[data-id]");
  if (!row || row.getAttribute("data-id") === "root") { e.preventDefault(); return; }
  dragId = row.getAttribute("data-id");
  e.dataTransfer.setData("text/hb-move", dragId);
  e.dataTransfer.effectAllowed = "move";
}

function onDragOver(e) {
  const row = e.target.closest("[data-id]");
  if (!row) return;
  e.preventDefault();
  clearMarks();
  const id = row.getAttribute("data-id");
  const node = nodeAt(id);
  const r = row.getBoundingClientRect();
  const y = e.clientY - r.top;
  const third = r.height / 3;
  if (node && acceptsChildren(node.tag) && y > third && y < r.height - third) row.classList.add("drop-inside");
  else if (y < r.height / 2) row.classList.add("drop-before");
  else row.classList.add("drop-after");
}

function onDragLeave(e) {
  const row = e.target.closest("[data-id]");
  if (row) row.classList.remove("drop-before", "drop-after", "drop-inside");
}

function onDrop(e) {
  const row = e.target.closest("[data-id]");
  if (!row) { clearMarks(); return; }
  e.preventDefault();
  const targetId = row.getAttribute("data-id");
  const r = row.getBoundingClientRect();
  const y = e.clientY - r.top;
  const third = r.height / 3;
  const node = nodeAt(targetId);
  const d = store.get();

  let dest;
  if (node && acceptsChildren(node.tag) && y > third && y < r.height - third) {
    dest = { parentId: targetId, index: (node.children || []).length };
  } else {
    const parent = parentOf(targetId);
    const idx = parent.children.findIndex((c) => c.id === targetId);
    dest = { parentId: parent.id, index: y < r.height / 2 ? idx : idx + 1 };
  }

  const moveId = e.dataTransfer.getData("text/hb-move");
  if (moveId) {
    if (moveId !== targetId && !isAncestor(d.root, moveId, dest.parentId)) store.move(moveId, dest);
  } else {
    const newNode = nodeFromDrag(e.dataTransfer);
    if (newNode) store.insert(newNode, dest);
  }
  clearMarks();
  dragId = null;
}

function clearMarks() {
  if (!el) return;
  el.querySelectorAll(".drop-before,.drop-after,.drop-inside").forEach((n) => n.classList.remove("drop-before", "drop-after", "drop-inside"));
}

function nodeAt(id) {
  let found = null;
  const walk = (n) => { if (n.id === id) found = n; else n.children.forEach(walk); };
  walk(store.get().root);
  return found;
}
function parentOf(id) {
  const root = store.get().root;
  let p = root;
  const walk = (n) => { for (const c of n.children) { if (c.id === id) p = n; else walk(c); } };
  walk(root);
  return p;
}
