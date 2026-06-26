/* inspector.js — the right pane. Three tabs: Style (a full, breakpoint-aware
   property editor), Attributes (whitelisted per-tag attrs + text + classes),
   and Behaviors (delegated to behaviors.js).

   Style writes go to the layer for the active device (base/tablet/mobile) so
   responsive overrides are authored simply by switching the breakpoint. Each
   control shows the resolved (inherited) value and badges a property that is
   overridden in the active layer. */

import * as store from "./store.js";
import { findNode, tagInfo, canHaveText, GLOBAL_ATTRS, DEVICES } from "./schema.js";
import { resolveStyle } from "./style-engine.js";
import * as behaviors from "./behaviors.js";
import * as gridEditor from "./grid-editor.js";
import * as assets from "./assets.js";

let el = null;
let tab = "style";
let lastSel = undefined;
let lastDevice = undefined;

export function mount(container) {
  el = container;
  el.addEventListener("click", onClick);
  el.addEventListener("input", onInput);
  el.addEventListener("change", onInput);
  render();
}

export function onChange(doc, meta) {
  // Rebuild only when the selection or device changes — never on the user's own
  // style/text edits, which would steal input focus.
  if (meta.kind === "full" || meta.kind === "structural") { render(); return; }
  const d = store.get();
  if (d.ui.selectedId !== lastSel || d.ui.device !== lastDevice) render();
}

function activeLayer() {
  const d = store.get();
  return (DEVICES[d.ui.device] || DEVICES.desktop).layer;
}

/* ── style control spec ────────────────────────────────────────────────── */
const WEIGHTS = ["", "normal", "500", "600", "700", "bold"];
function styleSections(display, position) {
  const layout = [
    sel("display", "Display", ["", "block", "flex", "grid", "inline-block", "inline", "none"]),
  ];
  if (display === "flex") {
    layout.push(
      sel("flex-direction", "Direction", ["", "row", "column", "row-reverse", "column-reverse"]),
      sel("flex-wrap", "Wrap", ["", "nowrap", "wrap"]),
      sel("justify-content", "Justify", ["", "flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"]),
      sel("align-items", "Align", ["", "stretch", "flex-start", "center", "flex-end", "baseline"]),
      txt("gap", "Gap", "e.g. 16px"),
    );
  } else if (display === "grid") {
    layout.push({ kind: "grid" });
  }

  const sections = [
    { title: "Layout", controls: layout },
    { title: "Spacing", controls: [sides("margin", "Margin"), sides("padding", "Padding")] },
    { title: "Size", controls: [txt("width", "Width", "auto"), txt("height", "Height", "auto"), txt("max-width", "Max width", "none"), txt("min-height", "Min height", "0")] },
    { title: "Typography", controls: [
      color("color", "Text color"),
      txt("font-size", "Font size", "16px"),
      sel("font-weight", "Weight", WEIGHTS),
      txt("line-height", "Line height", "1.5"),
      txt("letter-spacing", "Letter spacing", "normal"),
      segment("text-align", "Align", ["left", "center", "right", "justify"]),
      txt("font-family", "Font family", "system-ui, sans-serif"),
    ] },
    { title: "Background", controls: [color("background", "Background"), txt("background-image", "Image (url(...))", "")] },
    { title: "Border", controls: [txt("border", "Border", "1px solid #ccc"), txt("border-radius", "Radius", "0"), txt("box-shadow", "Shadow", "0 2px 8px rgba(0,0,0,.1)")] },
    { title: "Effects", controls: [txt("opacity", "Opacity", "1"), txt("transform", "Transform", ""), txt("transition", "Transition", "")] },
    { title: "Position", controls: positionControls(position) },
  ];
  return sections;
}

function positionControls(position) {
  const base = [sel("position", "Position", ["", "static", "relative", "absolute", "fixed", "sticky"])];
  if (position && position !== "static" && position !== "") {
    base.push(txt("top", "Top", ""), txt("right", "Right", ""), txt("bottom", "Bottom", ""), txt("left", "Left", ""), txt("z-index", "Z-index", ""));
  }
  return base;
}

const sel = (prop, label, options) => ({ kind: "select", prop, label, options });
const txt = (prop, label, ph) => ({ kind: "text", prop, label, ph });
const color = (prop, label) => ({ kind: "color", prop, label });
const segment = (prop, label, options) => ({ kind: "segment", prop, label, options });
const sides = (prop, label) => ({ kind: "sides", prop, label });

/* ── render ────────────────────────────────────────────────────────────── */
export function render() {
  if (!el) return;
  const d = store.get();
  lastSel = d.ui.selectedId;
  lastDevice = d.ui.device;
  const node = findNode(d.root, d.ui.selectedId);

  if (!node) {
    el.innerHTML = `<div class="hb-insp__empty">Select an element on the canvas or in the layers tree to edit it.</div>`;
    return;
  }

  const info = tagInfo(node.tag);
  const layer = activeLayer();
  const devLabel = (DEVICES[d.ui.device] || DEVICES.desktop).label;

  let html = `<div class="hb-insp">`;
  html += `<div class="hb-insp__head">`;
  html += `<div class="hb-insp__title">${node.id === "root" ? "body" : escape(info.label)}<span class="hb-insp__tag">${escape(node.tag)}</span></div>`;
  if (layer !== "base") html += `<div class="hb-insp__layer">editing <strong>${escape(devLabel)}</strong> overrides</div>`;
  html += `</div>`;

  // tabs
  html += `<div class="hb-tabs" role="tablist">`;
  for (const t of ["style", "attributes", "behaviors"]) {
    html += `<button type="button" class="chip hb-tab" data-tab="${t}" aria-pressed="${tab === t}">${t}</button>`;
  }
  html += `</div>`;

  html += `<div class="hb-insp__body">`;
  if (tab === "style") html += styleTab(node, layer);
  else if (tab === "attributes") html += attrTab(node);
  else html += `<div data-behaviors-slot></div>`;
  html += `</div></div>`;

  el.innerHTML = html;

  if (tab === "behaviors") behaviors.render(el.querySelector("[data-behaviors-slot]"), node);
  if (tab === "style") {
    const gs = el.querySelector("[data-grid-slot]");
    if (gs) gridEditor.render(gs, node, layer);
  }
}

function styleTab(node, layer) {
  const d = store.get();
  const resolved = resolveStyle(node, d.ui.device);
  const own = node.styles[layer] || {};
  const display = resolved.display || "";
  const position = resolved.position || "";
  let html = "";
  for (const section of styleSections(display, position)) {
    html += `<details class="hb-sec" open><summary>${section.title}</summary><div class="hb-sec__body">`;
    for (const c of section.controls) html += controlHtml(c, resolved, own);
    html += `</div></details>`;
  }
  return html;
}

function controlHtml(c, resolved, own) {
  const v = resolved[c.prop] != null ? resolved[c.prop] : "";
  const overridden = own[c.prop] != null;
  const badge = overridden ? `<span class="hb-ov-badge" title="Overridden at this breakpoint"></span>` : "";
  if (c.kind === "grid") return `<div class="hb-grid-ed" data-grid-slot></div>`;

  const lab = `<label class="hb-ctrl__label">${c.label}${badge}</label>`;

  if (c.kind === "select") {
    const opts = c.options.map((o) => `<option value="${o}"${o === v ? " selected" : ""}>${o || "—"}</option>`).join("");
    return `<div class="hb-ctrl">${lab}<select class="input hb-input" data-prop="${c.prop}">${opts}</select></div>`;
  }
  if (c.kind === "segment") {
    const btns = c.options.map((o) => `<button type="button" class="chip hb-seg" data-prop="${c.prop}" data-val="${o}" aria-pressed="${o === v}">${o}</button>`).join("");
    return `<div class="hb-ctrl">${lab}<div class="hb-seg-row">${btns}</div></div>`;
  }
  if (c.kind === "color") {
    const hex = /^#([0-9a-f]{6})$/i.test(v) ? v : "#000000";
    return `<div class="hb-ctrl">${lab}<div class="hb-color">` +
      `<input type="color" data-prop="${c.prop}" data-colorpick value="${hex}">` +
      `<input type="text" class="input hb-input" data-prop="${c.prop}" value="${escapeAttr(v)}" placeholder="transparent" spellcheck="false">` +
      `<button type="button" class="hb-clear" data-prop="${c.prop}" data-clear title="Clear">×</button></div></div>`;
  }
  if (c.kind === "sides") {
    const parts = ["top", "right", "bottom", "left"].map((side) => {
      const p = `${c.prop}-${side}`;
      const pv = resolved[p] != null ? resolved[p] : "";
      const ov = own[p] != null ? " is-over" : "";
      return `<input type="text" class="input hb-input hb-side${ov}" data-prop="${p}" value="${escapeAttr(pv)}" placeholder="${side[0].toUpperCase()}" title="${c.label} ${side}" spellcheck="false">`;
    }).join("");
    return `<div class="hb-ctrl">${lab}<div class="hb-sides">${parts}</div></div>`;
  }
  // text
  return `<div class="hb-ctrl">${lab}<input type="text" class="input hb-input" data-prop="${c.prop}" value="${escapeAttr(v)}" placeholder="${escapeAttr(c.ph || "")}" spellcheck="false"></div>`;
}

/* ── attributes tab ────────────────────────────────────────────────────── */
function attrTab(node) {
  let html = "";
  // name + text content
  html += `<details class="hb-sec" open><summary>Element</summary><div class="hb-sec__body">`;
  html += `<div class="hb-ctrl"><label class="hb-ctrl__label">Name (editor label)</label><input type="text" class="input hb-input" data-name value="${escapeAttr(node.name || "")}" placeholder="${escapeAttr(node.tag)}" spellcheck="false"></div>`;
  if (canHaveText(node.tag)) {
    html += `<div class="hb-ctrl"><label class="hb-ctrl__label">Text content</label><textarea class="input hb-input" data-text rows="2" spellcheck="false">${escape(node.text || "")}</textarea></div>`;
  }
  html += `<div class="hb-ctrl"><label class="hb-ctrl__label">Classes (space-separated)</label><input type="text" class="input hb-input" data-classes value="${escapeAttr((node.classes || []).join(" "))}" placeholder="my-class another" spellcheck="false"></div>`;
  html += `</div></details>`;

  const spec = { ...GLOBAL_ATTRS, ...(tagInfo(node.tag).attrs || {}) };
  if (Object.keys(spec).length) {
    html += `<details class="hb-sec" open><summary>Attributes</summary><div class="hb-sec__body">`;
    for (const [name, def] of Object.entries(spec)) {
      const val = node.attrs[name];
      if (def.type === "bool") {
        html += `<label class="hb-check"><input type="checkbox" data-attr="${name}"${val ? " checked" : ""}> ${name}</label>`;
      } else if (def.type === "enum") {
        const opts = def.options.map((o) => `<option value="${o}"${o === (val || "") ? " selected" : ""}>${o || "—"}</option>`).join("");
        html += `<div class="hb-ctrl"><label class="hb-ctrl__label">${name}</label><select class="input hb-input" data-attr="${name}">${opts}</select></div>`;
      } else if (def.type === "url") {
        html += `<div class="hb-ctrl"><label class="hb-ctrl__label">${name}</label>`;
        html += `<div class="hb-url-row"><input type="text" class="input hb-input" data-attr="${name}" value="${escapeAttr(val == null ? "" : val)}" placeholder="https://… or upload" spellcheck="false">`;
        html += `<button type="button" class="hb-tool-btn hb-upload-btn" data-upload="${name}" title="Upload image">↑</button>`;
        html += `<input type="file" accept="image/*" data-asset-upload="${name}" hidden></div>`;
        if (typeof val === "string" && val.startsWith("asset:")) {
          const a = assets.get(val.slice(6));
          if (a) html += `<div class="hb-asset-info"><img class="hb-asset-thumb" src="${escapeAttr(a.dataUrl)}" alt=""><span>${escape(a.name)}</span><button type="button" class="hb-clear" data-asset-clear="${name}" title="Remove">×</button></div>`;
        }
        html += `</div>`;
      } else {
        const type = def.type === "number" ? "number" : "text";
        html += `<div class="hb-ctrl"><label class="hb-ctrl__label">${name}</label><input type="${type}" class="input hb-input" data-attr="${name}" value="${escapeAttr(val == null ? "" : val)}" spellcheck="false"></div>`;
      }
    }
    html += `</div></details>`;
  }
  return html;
}

/* ── events ────────────────────────────────────────────────────────────── */
function onClick(e) {
  const t = e.target.closest("[data-tab]");
  if (t) { tab = t.getAttribute("data-tab"); render(); return; }
  const seg = e.target.closest(".hb-seg");
  if (seg) {
    const id = store.get().ui.selectedId;
    const cur = store.get();
    const node = findNode(cur.root, id);
    const layer = activeLayer();
    const isOn = seg.getAttribute("aria-pressed") === "true";
    store.setStyle(id, seg.getAttribute("data-prop"), isOn ? "" : seg.getAttribute("data-val"), layer);
    // reflect pressed state without full rebuild
    seg.parentElement.querySelectorAll(".hb-seg").forEach((b) => b.setAttribute("aria-pressed", "false"));
    if (!isOn) seg.setAttribute("aria-pressed", "true");
    return;
  }
  const clr = e.target.closest("[data-clear]");
  if (clr) {
    const id = store.get().ui.selectedId;
    store.setStyle(id, clr.getAttribute("data-prop"), "", activeLayer());
    const row = clr.closest(".hb-color");
    if (row) row.querySelector('input[type="text"]').value = "";
    return;
  }
  const up = e.target.closest("[data-upload]");
  if (up) {
    const file = up.parentElement.querySelector('input[type="file"][data-asset-upload]');
    if (file) file.click();
    return;
  }
  const aclr = e.target.closest("[data-asset-clear]");
  if (aclr) {
    const id = store.get().ui.selectedId;
    store.setAttr(id, aclr.getAttribute("data-asset-clear"), "");
    render();
    return;
  }
}

function onInput(e) {
  const id = store.get().ui.selectedId;
  if (!id) return;
  const t = e.target;

  if (t.hasAttribute("data-prop")) {
    const layer = activeLayer();
    let value = t.value;
    if (t.hasAttribute("data-colorpick")) {
      const text = t.parentElement.querySelector('input[type="text"]');
      if (text) text.value = value;
    }
    store.setStyle(id, t.getAttribute("data-prop"), value, layer);
    return;
  }
  if (t.hasAttribute("data-asset-upload")) {
    const name = t.getAttribute("data-asset-upload");
    const file = t.files && t.files[0];
    if (file) {
      assets.addFromFile(file)
        .then((aid) => { store.setAttr(id, name, "asset:" + aid); render(); notify("Image uploaded"); })
        .catch((err) => notify(err.message || "Upload failed"));
    }
    t.value = ""; // allow re-selecting the same file
    return;
  }
  if (t.hasAttribute("data-attr")) {
    const name = t.getAttribute("data-attr");
    const value = t.type === "checkbox" ? t.checked : t.value;
    store.setAttr(id, name, value);
    return;
  }
  if (t.hasAttribute("data-text")) { store.setText(id, t.value); return; }
  if (t.hasAttribute("data-name")) { store.setName(id, t.value); return; }
  if (t.hasAttribute("data-classes")) {
    store.setClasses(id, t.value.split(/\s+/).filter(Boolean));
    return;
  }
}

function notify(msg) { window.dispatchEvent(new CustomEvent("hb:notify", { detail: msg })); }
function escape(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function escapeAttr(s) { return String(s == null ? "" : s).replace(/[&"<]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;" }[c])); }
