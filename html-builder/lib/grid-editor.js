/* grid-editor.js — visual editor for grid-template-columns / -rows and gap,
   shown in the inspector's Layout section when display:grid. Parses the track
   strings into rows of {value, unit}, lets the user add/remove tracks and pick
   per-track units, and serializes back to a CSS track list written to the
   active breakpoint layer (so responsive grid overrides work like any style).

   Owns its own scoped listeners and re-renders itself on structural changes
   (add/remove track, unit switch) without rebuilding the whole inspector — the
   same approach behaviors.js uses to avoid stealing input focus. */

import * as store from "./store.js";
import { findNode } from "./schema.js";
import { resolveStyle } from "./style-engine.js";

const UNITS = ["fr", "px", "%", "em", "auto", "min-content", "max-content", "raw"];
const SIZELESS = new Set(["auto", "min-content", "max-content"]); // no numeric value

let host = null;
let nodeId = null;
let layer = "base";

export function render(slot, node, lyr) {
  host = slot;
  nodeId = node.id;
  layer = lyr;
  draw();
  host.oninput = onInput;
  host.onchange = onChange;
  host.onclick = onClick;
}

/* ── track string <-> parts ────────────────────────────────────────────── */
// Split a track list on top-level whitespace, keeping parenthesised groups
// (minmax(), repeat()) intact.
function tokenize(str) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of String(str || "")) {
    if (ch === "(") { depth++; cur += ch; }
    else if (ch === ")") { depth = Math.max(0, depth - 1); cur += ch; }
    else if (/\s/.test(ch) && depth === 0) { if (cur) { out.push(cur); cur = ""; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function parseTracks(str) {
  const tokens = tokenize(str);
  const tracks = [];
  for (const tok of tokens) {
    // expand a simple repeat(<int>, <single-token>)
    const rep = /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/i.exec(tok);
    if (rep) {
      const n = Math.min(20, parseInt(rep[1], 10) || 0);
      for (let i = 0; i < n; i++) tracks.push(toPart(rep[2].trim()));
      continue;
    }
    tracks.push(toPart(tok));
  }
  return tracks;
}

function toPart(tok) {
  if (SIZELESS.has(tok)) return { value: "", unit: tok };
  const m = /^(-?[\d.]+)(fr|px|%|em|rem|vh|vw)$/.exec(tok);
  if (m) return { value: m[1], unit: m[2] === "rem" || m[2] === "vh" || m[2] === "vw" ? "raw" : m[2], raw: tok };
  if (/^(-?[\d.]+)(rem|vh|vw)$/.test(tok)) return { value: tok, unit: "raw" };
  return { value: tok, unit: "raw" }; // minmax(), fit-content(), named lines, etc.
}

function partToTrack(p) {
  if (p.unit === "raw") return (p.value || "").trim();
  if (SIZELESS.has(p.unit)) return p.unit;
  const v = (p.value || "").trim();
  return v === "" ? "" : v + p.unit;
}

function serialize(parts) {
  return parts.map(partToTrack).filter(Boolean).join(" ");
}

/* ── state access ──────────────────────────────────────────────────────── */
function resolved() {
  const d = store.get();
  const n = findNode(d.root, nodeId);
  return n ? resolveStyle(n, d.ui.device) : {};
}

function writeAxis(axis, parts) {
  const prop = axis === "col" ? "grid-template-columns" : "grid-template-rows";
  store.setStyle(nodeId, prop, serialize(parts), layer);
}

/* ── render ────────────────────────────────────────────────────────────── */
function draw() {
  const r = resolved();
  const cols = parseTracks(r["grid-template-columns"]);
  const rows = parseTracks(r["grid-template-rows"]);
  const gap = r["gap"] != null ? r["gap"] : "";
  host.innerHTML =
    axisSection("Columns", "col", cols) +
    axisSection("Rows", "row", rows) +
    `<div class="hb-ctrl"><label class="hb-ctrl__label">Gap</label>` +
    `<input type="text" class="input hb-input" data-grid-gap value="${esc(gap)}" placeholder="e.g. 16px" spellcheck="false"></div>`;
}

function axisSection(label, axis, parts) {
  let h = `<div class="hb-grid-ax"><div class="hb-grid-ax__head"><span class="hb-ctrl__label">${label} · ${parts.length}</span>` +
    `<span class="hb-grid-ax__btns"><button type="button" class="hb-tool-btn" data-grid-add="${axis}" title="Add ${label.toLowerCase().slice(0, -1)}">+</button>` +
    `<button type="button" class="hb-tool-btn" data-grid-del="${axis}" title="Remove last"${parts.length ? "" : " disabled"}>−</button></span></div>`;
  parts.forEach((p, i) => {
    h += `<div class="hb-grid-track" data-axis="${axis}" data-i="${i}">`;
    const sizeless = SIZELESS.has(p.unit);
    h += `<input type="text" class="input hb-input hb-grid-val" data-grid-val value="${esc(p.value)}" placeholder="${p.unit === "raw" ? "e.g. minmax(0,1fr)" : "1"}"${sizeless ? " disabled" : ""} spellcheck="false">`;
    h += `<select class="input hb-input hb-grid-unit" data-grid-unit>`;
    for (const u of UNITS) h += `<option value="${u}"${u === p.unit ? " selected" : ""}>${u}</option>`;
    h += `</select></div>`;
  });
  return h;
}

/* ── events ────────────────────────────────────────────────────────────── */
function axisParts(axis) {
  const r = resolved();
  return parseTracks(r[axis === "col" ? "grid-template-columns" : "grid-template-rows"]);
}
function rowIndex(elm) {
  const row = elm.closest("[data-axis]");
  return row ? { axis: row.getAttribute("data-axis"), i: Number(row.getAttribute("data-i")) } : null;
}

function onInput(e) {
  const t = e.target;
  if (t.hasAttribute("data-grid-gap")) { store.setStyle(nodeId, "gap", t.value, layer); return; }
  if (t.hasAttribute("data-grid-val")) {
    const loc = rowIndex(t);
    if (!loc) return;
    const parts = axisParts(loc.axis);
    if (!parts[loc.i]) return;
    parts[loc.i].value = t.value;
    writeAxis(loc.axis, parts); // no redraw — keep focus
  }
}

function onChange(e) {
  const t = e.target;
  if (!t.hasAttribute("data-grid-unit")) return;
  const loc = rowIndex(t);
  if (!loc) return;
  const parts = axisParts(loc.axis);
  if (!parts[loc.i]) return;
  const unit = t.value;
  // moving to/from a sizeless unit changes whether a value is needed
  if (SIZELESS.has(unit)) parts[loc.i] = { value: "", unit };
  else if (parts[loc.i].unit === "raw" || SIZELESS.has(parts[loc.i].unit)) parts[loc.i] = { value: parts[loc.i].value || "1", unit };
  else parts[loc.i].unit = unit;
  writeAxis(loc.axis, parts);
  draw(); // unit switch toggles the value field — safe to rebuild
}

function onClick(e) {
  const add = e.target.closest("[data-grid-add]");
  if (add) {
    const axis = add.getAttribute("data-grid-add");
    const parts = axisParts(axis);
    parts.push({ value: "1", unit: "fr" });
    writeAxis(axis, parts);
    draw();
    return;
  }
  const del = e.target.closest("[data-grid-del]");
  if (del) {
    const axis = del.getAttribute("data-grid-del");
    const parts = axisParts(axis);
    parts.pop();
    writeAxis(axis, parts);
    draw();
  }
}

function esc(s) { return String(s == null ? "" : s).replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c])); }
