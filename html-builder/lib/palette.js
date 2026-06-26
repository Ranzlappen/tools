/* palette.js — the left-pane element catalog and component presets. Items are
   HTML5-draggable (drop resolution lives in canvas.js / layers.js) and also
   click-to-insert into the current selection. nodeFromDrag() is the shared
   factory both drop paths call. */

import { makeNode, TAGS, acceptsChildren, findNode } from "./schema.js";
import * as store from "./store.js";

/* group tags from the schema catalog for the element list */
function elementGroups() {
  const groups = {};
  for (const [tag, info] of Object.entries(TAGS)) {
    (groups[info.group] = groups[info.group] || []).push({ tag, label: info.label });
  }
  return groups;
}

/* ── component presets: () => Node subtrees ────────────────────────────── */
const S = (base) => ({ base, tablet: {}, mobile: {} });

export const PRESETS = {
  hero: () => makeNode("section", {
    styles: S({ padding: "64px 24px", "text-align": "center", background: "#0b1210", color: "#dce8e2" }),
    children: [
      makeNode("h1", { text: "Build something great", styles: S({ "font-size": "44px", margin: "0 0 12px" }) }),
      makeNode("p", { text: "A short supporting sentence that explains the value.", styles: S({ "font-size": "18px", color: "#7e948a", margin: "0 0 24px" }) }),
      makeNode("a", { text: "Get started", attrs: { href: "#" }, styles: S({ display: "inline-block", padding: "12px 24px", background: "#4ade80", color: "#0b1210", "border-radius": "8px", "text-decoration": "none", "font-weight": "600" }) }),
    ],
  }),
  card: () => makeNode("div", {
    styles: S({ padding: "24px", background: "#ffffff", border: "1px solid #e2e8e4", "border-radius": "12px", "max-width": "320px", "box-shadow": "0 8px 24px -16px rgba(0,0,0,.3)" }),
    children: [
      makeNode("h3", { text: "Card title", styles: S({ margin: "0 0 8px" }) }),
      makeNode("p", { text: "Card body copy goes here.", styles: S({ margin: "0", color: "#5a7068" }) }),
    ],
  }),
  navbar: () => makeNode("nav", {
    styles: S({ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "16px 24px", background: "#15201b", color: "#dce8e2" }),
    children: [
      makeNode("span", { text: "Brand", styles: S({ "font-weight": "700", "font-size": "18px" }) }),
      makeNode("div", {
        styles: S({ display: "flex", gap: "20px" }),
        children: [
          makeNode("a", { text: "Home", attrs: { href: "#" }, styles: S({ color: "#dce8e2", "text-decoration": "none" }) }),
          makeNode("a", { text: "About", attrs: { href: "#" }, styles: S({ color: "#dce8e2", "text-decoration": "none" }) }),
          makeNode("a", { text: "Contact", attrs: { href: "#" }, styles: S({ color: "#dce8e2", "text-decoration": "none" }) }),
        ],
      }),
    ],
  }),
  buttons: () => makeNode("div", {
    styles: S({ display: "flex", gap: "12px" }),
    children: [
      makeNode("button", { text: "Primary", styles: S({ padding: "10px 18px", background: "#4ade80", color: "#0b1210", border: "none", "border-radius": "8px", cursor: "pointer", "font-weight": "600" }) }),
      makeNode("button", { text: "Secondary", styles: S({ padding: "10px 18px", background: "transparent", color: "#1a2a22", border: "1px solid #cbd5d0", "border-radius": "8px", cursor: "pointer" }) }),
    ],
  }),
  twoCol: () => makeNode("div", {
    styles: S({ display: "grid", "grid-template-columns": "1fr 1fr", gap: "24px", padding: "24px" }),
    children: [
      makeNode("div", { styles: S({ padding: "24px", background: "#f0f5f2", "border-radius": "8px", "min-height": "120px" }) }),
      makeNode("div", { styles: S({ padding: "24px", background: "#f0f5f2", "border-radius": "8px", "min-height": "120px" }) }),
    ],
  }),
  form: () => makeNode("form", {
    styles: S({ display: "flex", "flex-direction": "column", gap: "16px", "max-width": "360px" }),
    children: [
      makeNode("label", { text: "Email", styles: S({ "font-weight": "600", "font-size": "14px" }) }),
      makeNode("input", { attrs: { type: "email", placeholder: "you@example.com" }, styles: S({ padding: "10px 12px", border: "1px solid #cbd5d0", "border-radius": "8px" }) }),
      makeNode("button", { text: "Subscribe", attrs: { type: "submit" }, styles: S({ padding: "12px", background: "#4ade80", color: "#0b1210", border: "none", "border-radius": "8px", "font-weight": "600", cursor: "pointer" }) }),
    ],
  }),
};

const PRESET_META = [
  { key: "hero", label: "Hero section" },
  { key: "card", label: "Card" },
  { key: "navbar", label: "Nav bar" },
  { key: "buttons", label: "Button group" },
  { key: "twoCol", label: "Two columns" },
  { key: "form", label: "Form" },
];

/* own-property guards: drag payloads are user-controlled, so a key like
   "constructor" must not dispatch to an inherited prototype member. */
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* shared factory for both drop paths */
export function nodeFromDrag(dt) {
  if (!dt) return null;
  const preset = dt.getData("text/hb-preset");
  if (preset && hasOwn(PRESETS, preset)) return PRESETS[preset]();
  const tag = dt.getData("text/hb-tag") || dt.getData("text/plain");
  if (tag && hasOwn(TAGS, tag)) return makeNode(tag);
  return null;
}

function targetParentId() {
  const d = store.get();
  const sel = d.ui.selectedId && findNode(d.root, d.ui.selectedId);
  if (sel && acceptsChildren(sel.tag)) return sel.id;
  return "root";
}

/* ── render the palette into its container ─────────────────────────────── */
export function mount(el) {
  const groups = elementGroups();
  let html = `<div class="hb-pal">`;
  html += `<div class="hb-pal__group"><div class="field-label">Components</div><div class="hb-pal__items">`;
  for (const p of PRESET_META) {
    html += `<button type="button" class="hb-pal__item hb-pal__item--preset" draggable="true" data-preset="${p.key}">${p.label}</button>`;
  }
  html += `</div></div>`;
  for (const [group, items] of Object.entries(groups)) {
    html += `<div class="hb-pal__group"><div class="field-label">${group}</div><div class="hb-pal__items">`;
    for (const it of items) {
      html += `<button type="button" class="hb-pal__item" draggable="true" data-tag="${it.tag}">${it.label}</button>`;
    }
    html += `</div></div>`;
  }
  html += `</div>`;
  el.innerHTML = html;

  el.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".hb-pal__item");
    if (!item) return;
    if (item.dataset.preset) {
      e.dataTransfer.setData("text/hb-preset", item.dataset.preset);
      e.dataTransfer.setData("text/plain", item.dataset.preset);
    } else {
      e.dataTransfer.setData("text/hb-tag", item.dataset.tag);
      e.dataTransfer.setData("text/plain", item.dataset.tag);
    }
    e.dataTransfer.effectAllowed = "copy";
  });

  el.addEventListener("click", (e) => {
    const item = e.target.closest(".hb-pal__item");
    if (!item) return;
    let node = null;
    if (item.dataset.preset && hasOwn(PRESETS, item.dataset.preset)) node = PRESETS[item.dataset.preset]();
    else if (item.dataset.tag && hasOwn(TAGS, item.dataset.tag)) node = makeNode(item.dataset.tag);
    if (node) store.insert(node, { parentId: targetParentId() });
  });
}
