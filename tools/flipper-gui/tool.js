/* Flipper GUI Studio — visual editor for Flipper Zero / Momentum GUIs.
 *
 * State mirrors the JSON export shape (schema "flipper-gui/v1"). The
 * editor canvas renders at native 128×64 with image-rendering:pixelated
 * CSS scaling, so the editor and on-device output use the same
 * coordinate system. Text rendering is pixel-exact for FontPrimary,
 * FontKeyboard and FontBigNumbers (real u8g2 glyph bitmaps via
 * lib/font-render.js); FontSecondary (haxrcorp4089) has no upstream
 * BDF so it falls back to fillText, but lays out with real advances.
 */

import { FONTS, getFont } from "./lib/font-metrics.js";
import { preloadFonts, measureText } from "./lib/font-render.js";
import {
  packXbm, bytesToB64, b64ToBytes,
  imageDataToBits, renderXbm, unpackXbm,
} from "./lib/xbm.js";
import { openIconPicker } from "./lib/icon-picker.js";
import { drawScene } from "./lib/draw-scene.js";
import { png1Blob } from "./lib/png1.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ── Defaults & sample ──────────────────────────────────────────────

function defaultState() {
  return {
    v: 1,
    app: {
      name: "my_app", namespace: "my_app",
      category: "Examples", stackSize: 2, requires: ["gui"],
      description: "", author: "", version: "1.0", weburl: "",
      iconMode: "png",
    },
    screens: [
      { id: "scr_main", name: "Main", widgets: [] },
    ],
    icons: [],
    activeScreenId: "scr_main",
    selection: [],
  };
}

const SAMPLE = {
  v: 1,
  app: { name: "demo", namespace: "demo" },
  screens: [
    {
      id: "scr_main", name: "Main",
      widgets: [
        { id: "w_1", type: "text", x: 4, y: 2, text: "demo app", font: "primary" },
        { id: "w_2", type: "frame", x: 0, y: 14, w: 128, h: 1 },
        { id: "w_3", type: "text", x: 4, y: 20, text: "press ok for menu", font: "secondary" },
        { id: "w_4", type: "button", x: 36, y: 48, w: 56, h: 12, label: "menu", style: "framed",
          key: "ok", event: "short", action: { kind: "goto", target: "scr_menu" } },
      ],
    },
    {
      id: "scr_menu", name: "Menu",
      widgets: [
        { id: "w_5", type: "text", x: 4, y: 2, text: "settings", font: "primary" },
        { id: "w_6", type: "menu", x: 4, y: 14, w: 120, lineH: 10,
          selectedVar: "var:menu_cursor",
          items: [
            { label: "Brightness", action: { kind: "custom_event", code: 1 } },
            { label: "Sound",      action: { kind: "custom_event", code: 2 } },
            { label: "About",      action: { kind: "custom_event", code: 3 } },
          ],
        },
      ],
    },
  ],
  icons: [],
  activeScreenId: "scr_main",
  selection: [],
};

// ── State + helpers ────────────────────────────────────────────────

let state = defaultState();
let nextWidgetId = 1;
let nextIconId = 1;
let renderQueued = false;
let undoStack = [];
let redoStack = [];
const UNDO_MAX = 50;

const HASH_KEY = "c=";
const HASH_LIMIT = 4096;

function clone(o) {
  if (Array.isArray(o)) return o.map(clone);
  if (o && typeof o === "object") {
    const out = {};
    for (const k of Object.keys(o)) out[k] = clone(o[k]);
    return out;
  }
  return o;
}

function snapshot() {
  return {
    v: state.v,
    app: clone(state.app),
    screens: clone(state.screens),
    icons: clone(state.icons),
    activeScreenId: state.activeScreenId,
    selection: [...state.selection],
  };
}

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack = [];
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  Object.assign(state, undoStack.pop());
  refreshAll();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  Object.assign(state, redoStack.pop());
  refreshAll();
}

function genId(prefix, existing) {
  let n = 1;
  const taken = new Set(existing.map((w) => w.id));
  while (taken.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
}

function genWidgetId() {
  const all = state.screens.flatMap((s) => s.widgets);
  return genId("w", all);
}

function genScreenId() {
  return genId("scr", state.screens);
}

function genIconId() {
  return genId("ico", state.icons || []);
}

function activeScreen() {
  return state.screens.find((s) => s.id === state.activeScreenId) || state.screens[0];
}

function findWidget(id) {
  for (const s of state.screens) {
    const w = s.widgets.find((w) => w.id === id);
    if (w) return { screen: s, widget: w };
  }
  return null;
}

// ── Encoding / hash ────────────────────────────────────────────────

function encodeState() {
  const lite = {
    v: state.v,
    app: state.app,
    screens: state.screens,
    icons: state.icons,
    activeScreenId: state.activeScreenId,
  };
  const json = JSON.stringify(lite);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeState(b64url) {
  try {
    let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (b64.length % 4)) % 4;
    b64 += "=".repeat(pad);
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json);
    return validateState(parsed);
  } catch (e) {
    return null;
  }
}

const ALLOWED_WIDGET_TYPES = new Set([
  "text", "box", "frame", "line", "dot", "icon",
  "button", "progress", "menu", "toggle",
]);

function validateState(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const out = defaultState();
  if (p.v) out.v = 1;
  if (p.app && typeof p.app === "object") {
    const a = p.app;
    if (typeof a.name === "string") out.app.name = a.name.slice(0, 40);
    if (typeof a.namespace === "string") out.app.namespace = a.namespace.slice(0, 40);
    if (typeof a.category === "string") out.app.category = a.category.slice(0, 24);
    if (Number.isFinite(parseInt(a.stackSize, 10))) out.app.stackSize = Math.max(1, Math.min(8, parseInt(a.stackSize, 10)));
    if (Array.isArray(a.requires)) {
      const req = a.requires.filter((r) => typeof r === "string" && /^[a-z0-9_]+$/i.test(r)).slice(0, 12);
      if (!req.includes("gui")) req.unshift("gui");
      out.app.requires = req;
    }
    if (typeof a.description === "string") out.app.description = a.description.slice(0, 200);
    if (typeof a.author === "string") out.app.author = a.author.slice(0, 60);
    if (typeof a.version === "string") out.app.version = a.version.slice(0, 16);
    if (typeof a.weburl === "string") out.app.weburl = a.weburl.slice(0, 200);
    if (a.iconMode === "assets") out.app.iconMode = "assets";
    if (a.icon && typeof a.icon === "object" && typeof a.icon.bits === "string") {
      out.app.icon = { w: 10, h: 10, bits: a.icon.bits.slice(0, 512) };
    }
  }
  if (Array.isArray(p.screens) && p.screens.length) {
    out.screens = p.screens.filter((s) => s && typeof s === "object").map((s) => ({
      id: String(s.id || "").slice(0, 40) || "scr_main",
      name: String(s.name || "Screen").slice(0, 40),
      widgets: Array.isArray(s.widgets) ? s.widgets
        .filter((w) => w && typeof w === "object" && ALLOWED_WIDGET_TYPES.has(w.type))
        .map(sanitizeWidget) : [],
    }));
    if (!out.screens.length) out.screens = [{ id: "scr_main", name: "Main", widgets: [] }];
  }
  if (Array.isArray(p.icons)) {
    out.icons = p.icons.filter((i) => i && typeof i === "object" && typeof i.bits === "string").map((i) => ({
      id: String(i.id || "").slice(0, 40) || "ico_1",
      name: String(i.name || "I_icon_8x8").replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 48),
      w: Math.max(1, Math.min(128, parseInt(i.w, 10) || 8)),
      h: Math.max(1, Math.min(64, parseInt(i.h, 10) || 8)),
      frames: 1,
      rate: 0,
      bits: i.bits.slice(0, 4096),
    }));
  }
  if (typeof p.activeScreenId === "string") {
    if (out.screens.some((s) => s.id === p.activeScreenId)) out.activeScreenId = p.activeScreenId;
    else out.activeScreenId = out.screens[0].id;
  } else {
    out.activeScreenId = out.screens[0].id;
  }
  return out;
}

function sanitizeWidget(w) {
  const base = {
    id: String(w.id || "").slice(0, 40) || `w_${nextWidgetId++}`,
    type: w.type,
    x: clampInt(w.x, 0, 127),
    y: clampInt(w.y, 0, 63),
  };
  if (typeof w.name === "string") base.name = w.name.slice(0, 32);
  if (w.locked) base.locked = true;
  switch (w.type) {
    case "text":
      base.text = String(w.text || "").slice(0, 80);
      base.font = (FONTS[w.font]) ? w.font : "primary";
      break;
    case "box":
    case "frame":
      base.w = clampInt(w.w, 1, 128);
      base.h = clampInt(w.h, 1, 64);
      break;
    case "line":
      base.x2 = clampInt(w.x2, 0, 127);
      base.y2 = clampInt(w.y2, 0, 63);
      break;
    case "dot":
      break;
    case "icon":
      base.iconId = String(w.iconId || "").slice(0, 40);
      break;
    case "button":
      base.w = clampInt(w.w, 6, 128);
      base.h = clampInt(w.h, 6, 64);
      base.label = String(w.label || "").slice(0, 32);
      base.key = ["ok","up","down","left","right","back"].includes(w.key) ? w.key : "ok";
      base.event = ["short","long","repeat"].includes(w.event) ? w.event : "short";
      base.style = ["framed","plain","invert"].includes(w.style) ? w.style : "framed";
      base.action = sanitizeAction(w.action);
      break;
    case "progress":
      base.w = clampInt(w.w, 6, 128);
      base.h = clampInt(w.h, 3, 32);
      base.value = sanitizeValue(w.value, 0, 100, 50);
      break;
    case "menu":
      base.w = clampInt(w.w, 16, 128);
      base.lineH = clampInt(w.lineH, 6, 32);
      base.selectedVar = typeof w.selectedVar === "string" ? w.selectedVar.slice(0, 48) : "var:menu_cursor";
      base.items = Array.isArray(w.items) ? w.items.slice(0, 16).map((it) => ({
        label: String(it.label || "").slice(0, 32),
        action: sanitizeAction(it.action),
      })) : [];
      break;
    case "toggle":
      base.label = String(w.label || "").slice(0, 32);
      base.state = sanitizeBoolOrVar(w.state);
      break;
  }
  return base;
}

function sanitizeAction(a) {
  if (!a || typeof a !== "object") return { kind: "custom_event", code: 0 };
  if (a.kind === "goto" && typeof a.target === "string") return { kind: "goto", target: a.target.slice(0, 40) };
  if (a.kind === "custom_event") return { kind: "custom_event", code: clampInt(a.code, 0, 9999) };
  return { kind: "custom_event", code: 0 };
}

function sanitizeValue(v, lo, hi, fallback) {
  if (typeof v === "string" && v.startsWith("var:")) return v.slice(0, 48);
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

function sanitizeBoolOrVar(v) {
  if (typeof v === "string" && v.startsWith("var:")) return v.slice(0, 48);
  return !!v;
}

function clampInt(v, lo, hi) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// ── Render loop ────────────────────────────────────────────────────

let canvas, ctx, overlay, stageInner, statusEl;

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderCanvas();
    renderOverlay();
    renderElementsList();
    renderInspector();
    renderExport();
    syncHash();
  });
}

function refreshAll() {
  renderTabs();
  renderIconList();
  syncAppFields();
  scheduleRender();
}

function renderCanvas() {
  if (!canvas) return;
  ctx.clearRect(0, 0, 128, 64);
  const sc = activeScreen();
  if (!sc) return;
  drawScene(ctx, sc.widgets, state.icons);
  // Optional grid overlay
  const gridOn = $("#fg-grid")?.checked;
  if (gridOn) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let x = 8; x < 128; x += 8) ctx.fillRect(x, 0, 1, 64);
    for (let y = 8; y < 64; y += 8) ctx.fillRect(0, y, 128, 1);
  }
}

// ── Selection overlay ──────────────────────────────────────────────

function widgetBbox(w) {
  switch (w.type) {
    case "text": {
      const m = measureText(w.text || "", w.font || "primary");
      return { x: w.x, y: w.y, w: Math.max(2, m.w), h: m.h };
    }
    case "box":
    case "frame":
    case "button":
    case "progress":
    case "menu":
      return { x: w.x, y: w.y, w: w.w, h: (w.type === "menu") ? ((w.items?.length || 1) * (w.lineH || 10)) : w.h };
    case "line": {
      const x = Math.min(w.x, w.x2), y = Math.min(w.y, w.y2);
      const ww = Math.abs(w.x2 - w.x) + 1, hh = Math.abs(w.y2 - w.y) + 1;
      return { x, y, w: ww, h: hh };
    }
    case "dot":
      return { x: w.x, y: w.y, w: 1, h: 1 };
    case "icon": {
      const icon = state.icons.find((i) => i.id === w.iconId);
      return { x: w.x, y: w.y, w: icon ? icon.w : 8, h: icon ? icon.h : 8 };
    }
    case "toggle": {
      const f = getFont("secondary");
      const textW = measureText(w.label || "", "secondary").w;
      return { x: w.x, y: w.y, w: 7 + 3 + textW, h: Math.max(7, f.lineH) };
    }
  }
  return { x: w.x, y: w.y, w: 4, h: 4 };
}

function renderOverlay() {
  if (!overlay) return;
  overlay.innerHTML = "";
  const sc = activeScreen();
  if (!sc) return;
  const zoom = getZoom();
  for (const id of state.selection) {
    const w = sc.widgets.find((w) => w.id === id);
    if (!w) continue;
    const bb = widgetBbox(w);
    const handle = document.createElement("div");
    handle.className = "fg-handle";
    handle.style.left = (bb.x * zoom) + "px";
    handle.style.top = (bb.y * zoom) + "px";
    handle.style.width = Math.max(4, bb.w * zoom) + "px";
    handle.style.height = Math.max(4, bb.h * zoom) + "px";
    handle.dataset.widgetId = w.id;
    const label = document.createElement("span");
    label.className = "fg-handle__label";
    label.textContent = `${w.type}  ${w.x},${w.y}`;
    handle.appendChild(label);
    overlay.appendChild(handle);
  }
}

function elementLabel(w) {
  let detail = "";
  if (w.type === "text") detail = w.text || "";
  else if (w.type === "button" || w.type === "toggle") detail = w.label || "";
  else if (w.type === "icon") detail = state.icons.find((i) => i.id === w.iconId)?.name || "(none)";
  else if (w.type === "menu") detail = `${w.items?.length || 0} items`;
  else detail = `${w.x},${w.y}`;
  return detail ? `${w.type} · ${detail}` : w.type;
}

function renderElementsList() {
  const ul = $("#fg-elements");
  if (!ul) return;
  ul.innerHTML = "";
  const sc = activeScreen();
  if (!sc || !sc.widgets.length) {
    ul.innerHTML = '<li class="fg-el-empty">No elements yet.</li>';
    return;
  }
  // Top-most first: the last-drawn widget sits on top, so list it first.
  for (let i = sc.widgets.length - 1; i >= 0; i--) {
    const w = sc.widgets[i];
    const li = document.createElement("li");
    li.className = "fg-el-row";
    li.dataset.elId = w.id;
    if (state.selection.includes(w.id)) li.classList.add("is-selected");
    if (w.locked) li.classList.add("is-locked");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "fg-el-lock";
    cb.checked = !!w.locked;
    cb.title = "Lock position & make clickthrough";
    cb.setAttribute("aria-label", `Lock ${w.type}`);
    const label = document.createElement("button");
    label.type = "button";
    label.className = "fg-el-label";
    label.textContent = elementLabel(w);
    li.appendChild(cb);
    li.appendChild(label);
    ul.appendChild(li);
  }
}

function selectWidget(id) {
  if (!findWidget(id)) return;
  state.selection = [id];
  scheduleRender();
}

function toggleWidgetLock(id) {
  const found = findWidget(id);
  if (!found) return;
  pushUndo();
  if (found.widget.locked) {
    delete found.widget.locked;
  } else {
    found.widget.locked = true;
    state.selection = state.selection.filter((s) => s !== id);
  }
  scheduleRender();
}

function getZoom() {
  return parseInt($("#fg-zoom")?.value || "4", 10);
}

function setZoom(z) {
  const v = Math.max(2, Math.min(8, z | 0));
  $("#fg-zoom").value = String(v);
  $("#fg-zoom-val").textContent = v + "×";
  stageInner.style.setProperty("--fg-zoom", String(v));
  renderOverlay();
}

// ── Tabs ───────────────────────────────────────────────────────────

function renderTabs() {
  const root = $("#fg-tabs");
  root.innerHTML = "";
  for (const s of state.screens) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "fg-tab";
    tab.role = "tab";
    tab.setAttribute("aria-selected", s.id === state.activeScreenId ? "true" : "false");
    tab.dataset.screenId = s.id;
    const name = document.createElement("span");
    name.className = "fg-tab__name";
    name.textContent = s.name;
    tab.appendChild(name);
    if (state.screens.length > 1) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "fg-tab__close";
      close.textContent = "×";
      close.dataset.screenClose = s.id;
      close.title = `Delete screen "${s.name}"`;
      tab.appendChild(close);
    }
    root.appendChild(tab);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.className = "fg-tab--add";
  add.dataset.action = "add-screen";
  add.textContent = "+ Screen";
  root.appendChild(add);
}

function setActiveScreen(id) {
  if (!state.screens.some((s) => s.id === id)) return;
  state.activeScreenId = id;
  state.selection = [];
  renderTabs();
  scheduleRender();
}

function addScreen() {
  pushUndo();
  const id = genScreenId();
  const num = state.screens.length + 1;
  state.screens.push({ id, name: `Screen ${num}`, widgets: [] });
  state.activeScreenId = id;
  state.selection = [];
  refreshAll();
}

function deleteScreen(id) {
  if (state.screens.length <= 1) return;
  // Any button targeting this screen?
  const refs = [];
  for (const s of state.screens) {
    for (const w of s.widgets) {
      if (w.type === "button" && w.action?.kind === "goto" && w.action.target === id) refs.push(`${s.name}/${w.label || w.id}`);
      if (w.type === "menu") {
        for (const it of (w.items || [])) {
          if (it.action?.kind === "goto" && it.action.target === id) refs.push(`${s.name}/${w.id}`);
        }
      }
    }
  }
  if (refs.length && !confirm(`Delete screen? Targeted by: ${refs.join(", ")}. Those buttons will be left without a valid target.`)) return;
  pushUndo();
  state.screens = state.screens.filter((s) => s.id !== id);
  if (state.activeScreenId === id) state.activeScreenId = state.screens[0].id;
  state.selection = [];
  refreshAll();
}

// ── Widget add / mutate / delete ───────────────────────────────────

function addWidget(type, atX = 8, atY = 8) {
  const sc = activeScreen();
  if (!sc) return null;
  pushUndo();
  const id = genWidgetId();
  let w = { id, type, x: clampInt(atX, 0, 127), y: clampInt(atY, 0, 63) };
  switch (type) {
    case "text":
      w.text = "Text"; w.font = "primary"; break;
    case "box": w.w = 32; w.h = 16; break;
    case "frame": w.w = 32; w.h = 16; break;
    case "line": w.x2 = w.x + 16; w.y2 = w.y; break;
    case "dot": break;
    case "icon":
      w.iconId = state.icons[0]?.id || ""; break;
    case "button":
      w.w = 40; w.h = 12; w.label = "OK"; w.key = "ok"; w.event = "short"; w.style = "framed";
      w.action = state.screens.length > 1
        ? { kind: "goto", target: state.screens.find((s) => s.id !== sc.id).id }
        : { kind: "custom_event", code: 1 };
      break;
    case "progress":
      w.w = 64; w.h = 6; w.value = 50; break;
    case "menu":
      w.w = 120; w.lineH = 10; w.selectedVar = "var:menu_cursor";
      w.items = [{ label: "Item 1", action: { kind: "custom_event", code: 1 } }];
      break;
    case "toggle":
      w.label = "Enable"; w.state = false; break;
  }
  return placeWidget(w);
}

/* Clamp a freshly-built widget into the canvas, append it to the active
   screen, select it, and re-render. Caller is responsible for pushUndo. */
function placeWidget(w) {
  const sc = activeScreen();
  if (!sc) return null;
  const bb = widgetBbox(w);
  if (bb.x + bb.w > 128) w.x = Math.max(0, 128 - bb.w);
  if (bb.y + bb.h > 64) w.y = Math.max(0, 64 - bb.h);
  sc.widgets.push(w);
  state.selection = [w.id];
  scheduleRender();
  return w.id;
}

function updateWidget(id, patch) {
  const found = findWidget(id);
  if (!found) return;
  pushUndo();
  Object.assign(found.widget, patch);
  // Clamp coords after edit.
  found.widget.x = clampInt(found.widget.x, 0, 127);
  found.widget.y = clampInt(found.widget.y, 0, 63);
  scheduleRender();
}

function deleteWidget(id) {
  const found = findWidget(id);
  if (!found) return;
  pushUndo();
  found.screen.widgets = found.screen.widgets.filter((w) => w.id !== id);
  state.selection = state.selection.filter((s) => s !== id);
  scheduleRender();
}

function duplicateWidget(id) {
  const found = findWidget(id);
  if (!found) return;
  pushUndo();
  const w = clone(found.widget);
  w.id = genWidgetId();
  w.x = clampInt(w.x + 4, 0, 127);
  w.y = clampInt(w.y + 4, 0, 63);
  found.screen.widgets.push(w);
  state.selection = [w.id];
  scheduleRender();
}

function moveSelectionBy(dx, dy) {
  if (!state.selection.length) return;
  pushUndo();
  const sc = activeScreen();
  for (const id of state.selection) {
    const w = sc.widgets.find((w) => w.id === id);
    if (!w || w.locked) continue;
    w.x = clampInt(w.x + dx, 0, 127);
    w.y = clampInt(w.y + dy, 0, 63);
    if (w.type === "line") {
      w.x2 = clampInt(w.x2 + dx, 0, 127);
      w.y2 = clampInt(w.y2 + dy, 0, 63);
    }
  }
  scheduleRender();
}

// ── Pointer interactions ───────────────────────────────────────────

let drag = null; // {kind: "create"|"move", widgetId?, type?, startX, startY, origPos[]}

function pointerToCanvas(ev) {
  const rect = stageInner.getBoundingClientRect();
  const zoom = getZoom();
  const x = Math.floor((ev.clientX - rect.left) / zoom);
  const y = Math.floor((ev.clientY - rect.top) / zoom);
  return { x: clampInt(x, 0, 127), y: clampInt(y, 0, 63) };
}

function hitTestAt(x, y) {
  const sc = activeScreen();
  if (!sc) return null;
  // Back-to-front: top widget wins on click. Locked widgets are
  // clickthrough — they don't intercept canvas hits.
  for (let i = sc.widgets.length - 1; i >= 0; i--) {
    const w = sc.widgets[i];
    if (w.locked) continue;
    const bb = widgetBbox(w);
    if (x >= bb.x && x < bb.x + bb.w && y >= bb.y && y < bb.y + bb.h) return w;
  }
  return null;
}

function wireCanvasPointer() {
  canvas.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    const p = pointerToCanvas(ev);
    const hit = hitTestAt(p.x, p.y);
    if (hit) {
      if (ev.shiftKey) {
        if (state.selection.includes(hit.id)) state.selection = state.selection.filter((s) => s !== hit.id);
        else state.selection.push(hit.id);
      } else if (!state.selection.includes(hit.id)) {
        state.selection = [hit.id];
      }
      const sc = activeScreen();
      const orig = state.selection.map((id) => {
        const w = sc.widgets.find((w) => w.id === id);
        return { id, x: w.x, y: w.y, x2: w.x2, y2: w.y2 };
      });
      drag = { kind: "move", startX: p.x, startY: p.y, orig, preSnapshot: snapshot(), moved: false };
      renderOverlay();
    } else {
      state.selection = [];
      renderOverlay();
      renderInspector();
    }
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const p = pointerToCanvas(ev);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    if (dx !== 0 || dy !== 0) drag.moved = true;
    const sc = activeScreen();
    for (const o of drag.orig) {
      const w = sc.widgets.find((w) => w.id === o.id);
      if (!w || w.locked) continue;
      w.x = clampInt(o.x + dx, 0, 127);
      w.y = clampInt(o.y + dy, 0, 63);
      if (w.type === "line" && o.x2 !== undefined) {
        w.x2 = clampInt(o.x2 + dx, 0, 127);
        w.y2 = clampInt(o.y2 + dy, 0, 63);
      }
    }
    renderCanvas();
    renderOverlay();
    setStatus(`(${p.x}, ${p.y})`);
  });
  canvas.addEventListener("pointerup", () => {
    if (drag) {
      // Commit the pre-drag snapshot as a single undo entry, only if
      // the drag actually moved something.
      if (drag.moved && drag.preSnapshot) {
        undoStack.push(drag.preSnapshot);
        if (undoStack.length > UNDO_MAX) undoStack.shift();
        redoStack = [];
      }
      drag = null;
      scheduleRender();
    }
  });
  canvas.addEventListener("pointercancel", () => { drag = null; });
}

function wirePaletteDrag() {
  $$("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.add;
      if (type === "icon") addIconWidget(8, 8);
      else addWidget(type, 8, 8);
    });
    // Drag-to-canvas: pointerdown starts ghost; pointerup over canvas places.
    btn.addEventListener("pointerdown", (ev) => {
      const type = btn.dataset.add;
      btn.setAttribute("data-dragging", "true");
      let ghost = null;
      const onMove = (mv) => {
        const rect = stageInner.getBoundingClientRect();
        const overStage = mv.clientX >= rect.left && mv.clientX < rect.right && mv.clientY >= rect.top && mv.clientY < rect.bottom;
        if (overStage) {
          if (!ghost) {
            ghost = document.createElement("div");
            ghost.className = "fg-ghost";
            stageInner.appendChild(ghost);
          }
          const zoom = getZoom();
          const x = Math.floor((mv.clientX - rect.left) / zoom);
          const y = Math.floor((mv.clientY - rect.top) / zoom);
          ghost.style.left = (x * zoom) + "px";
          ghost.style.top = (y * zoom) + "px";
          ghost.style.width = (16 * zoom) + "px";
          ghost.style.height = (8 * zoom) + "px";
          setStatus(`drop at (${x}, ${y})`);
        } else if (ghost) {
          ghost.remove();
          ghost = null;
        }
      };
      const onUp = (up) => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        btn.removeAttribute("data-dragging");
        const rect = stageInner.getBoundingClientRect();
        const overStage = up.clientX >= rect.left && up.clientX < rect.right && up.clientY >= rect.top && up.clientY < rect.bottom;
        if (overStage) {
          const zoom = getZoom();
          const x = Math.floor((up.clientX - rect.left) / zoom);
          const y = Math.floor((up.clientY - rect.top) / zoom);
          if (type === "icon") addIconWidget(x, y);
          else addWidget(type, x, y);
        }
        if (ghost) ghost.remove();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  });
}

// ── Inspector form ─────────────────────────────────────────────────

function renderInspector() {
  const root = $("#fg-inspector");
  if (state.selection.length === 0) {
    root.innerHTML = '<div class="fg-inspector__empty">No selection.<br>Click a widget on the canvas, or add one from the palette.</div>';
    return;
  }
  if (state.selection.length > 1) {
    root.innerHTML = `<div class="fg-inspector__empty">${state.selection.length} widgets selected. Use arrows to nudge, Del to delete.</div>`;
    return;
  }
  const id = state.selection[0];
  const found = findWidget(id);
  if (!found) {
    root.innerHTML = '<div class="fg-inspector__empty">Selection no longer exists.</div>';
    return;
  }
  const w = found.widget;
  root.innerHTML = "";

  const heading = document.createElement("div");
  heading.style.cssText = "display:flex;justify-content:space-between;align-items:center;font-family:var(--f-mono);font-size:0.78rem;";
  heading.innerHTML = `<span style="color:var(--c-accent);">${w.type}</span><span style="color:var(--c-text-faint);">${w.id}</span>`;
  root.appendChild(heading);

  // Coords always shown.
  root.appendChild(numField("X", w.x, 0, 127, (v) => updateWidget(w.id, { x: v })));
  root.appendChild(numField("Y", w.y, 0, 63, (v) => updateWidget(w.id, { y: v })));

  switch (w.type) {
    case "text":
      root.appendChild(textField("Text", w.text, (v) => updateWidget(w.id, { text: v })));
      root.appendChild(chipField("Font", Object.keys(FONTS), w.font, (v) => updateWidget(w.id, { font: v }), (k) => FONTS[k].label));
      break;
    case "box":
    case "frame":
      root.appendChild(numField("Width", w.w, 1, 128, (v) => updateWidget(w.id, { w: v })));
      root.appendChild(numField("Height", w.h, 1, 64, (v) => updateWidget(w.id, { h: v })));
      break;
    case "line":
      root.appendChild(numField("X2", w.x2, 0, 127, (v) => updateWidget(w.id, { x2: v })));
      root.appendChild(numField("Y2", w.y2, 0, 63, (v) => updateWidget(w.id, { y2: v })));
      break;
    case "icon": {
      const opts = state.icons.map((i) => i.id);
      root.appendChild(selectField("Icon", opts, w.iconId, (v) => updateWidget(w.id, { iconId: v }), (id) => state.icons.find((i) => i.id === id)?.name || id));
      break;
    }
    case "button":
      root.appendChild(textField("Label", w.label, (v) => updateWidget(w.id, { label: v })));
      root.appendChild(numField("Width", w.w, 6, 128, (v) => updateWidget(w.id, { w: v })));
      root.appendChild(numField("Height", w.h, 6, 64, (v) => updateWidget(w.id, { h: v })));
      root.appendChild(chipField("Key", ["ok","up","down","left","right","back"], w.key, (v) => updateWidget(w.id, { key: v })));
      root.appendChild(chipField("Event", ["short","long","repeat"], w.event, (v) => updateWidget(w.id, { event: v })));
      root.appendChild(chipField("Style", ["framed","plain","invert"], w.style, (v) => updateWidget(w.id, { style: v })));
      root.appendChild(actionField(w.action, (a) => updateWidget(w.id, { action: a })));
      break;
    case "progress":
      root.appendChild(numField("Width", w.w, 6, 128, (v) => updateWidget(w.id, { w: v })));
      root.appendChild(numField("Height", w.h, 3, 32, (v) => updateWidget(w.id, { h: v })));
      root.appendChild(valueField("Value (0–100)", w.value, (v) => updateWidget(w.id, { value: v })));
      break;
    case "menu":
      root.appendChild(numField("Width", w.w, 16, 128, (v) => updateWidget(w.id, { w: v })));
      root.appendChild(numField("Line height", w.lineH, 6, 32, (v) => updateWidget(w.id, { lineH: v })));
      root.appendChild(textField("Cursor var", w.selectedVar, (v) => updateWidget(w.id, { selectedVar: v })));
      root.appendChild(menuItemsField(w.items, (items) => updateWidget(w.id, { items })));
      break;
    case "toggle":
      root.appendChild(textField("Label", w.label, (v) => updateWidget(w.id, { label: v })));
      root.appendChild(toggleStateField(w.state, (v) => updateWidget(w.id, { state: v })));
      break;
  }
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:6px;margin-top:var(--space-sm);";
  const dup = document.createElement("button");
  dup.type = "button";
  dup.className = "fg-pal-btn";
  dup.textContent = "Duplicate";
  dup.onclick = () => duplicateWidget(w.id);
  const del = document.createElement("button");
  del.type = "button";
  del.className = "fg-btn-danger";
  del.textContent = "Delete";
  del.onclick = () => deleteWidget(w.id);
  actions.appendChild(dup);
  actions.appendChild(del);
  root.appendChild(actions);
}

function fieldWrap(label) {
  const wrap = document.createElement("div");
  wrap.className = "fg-field";
  if (label) {
    const lab = document.createElement("label");
    lab.textContent = label;
    wrap.appendChild(lab);
  }
  return wrap;
}

/* Commit a text/number input on Enter + blur; Escape reverts. Avoids the
   per-keystroke onChange that rebuilt the inspector mid-typing (stealing
   focus) and flooded the undo stack — now exactly one commit per edit. */
function wireCommitInput(inp, { read, commit }) {
  let orig = inp.value;
  let reverting = false;
  inp.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      inp.blur();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      reverting = true;
      inp.value = orig;
      inp.blur();
    }
  });
  inp.addEventListener("blur", () => {
    if (reverting) { reverting = false; return; }
    if (inp.value === orig) return;
    orig = inp.value;
    commit(read());
  });
}

function numField(label, val, lo, hi, onChange) {
  const wrap = fieldWrap(label);
  const inp = document.createElement("input");
  inp.type = "number";
  inp.min = String(lo); inp.max = String(hi); inp.step = "1";
  inp.value = String(val);
  wireCommitInput(inp, { read: () => clampInt(inp.value, lo, hi), commit: onChange });
  wrap.appendChild(inp);
  return wrap;
}

function textField(label, val, onChange) {
  const wrap = fieldWrap(label);
  const inp = document.createElement("input");
  inp.type = "text";
  inp.value = val || "";
  wireCommitInput(inp, { read: () => inp.value, commit: onChange });
  wrap.appendChild(inp);
  return wrap;
}

function selectField(label, opts, val, onChange, labelFn = (v) => v) {
  const wrap = fieldWrap(label);
  const sel = document.createElement("select");
  for (const o of opts) {
    const opt = document.createElement("option");
    opt.value = o; opt.textContent = labelFn(o);
    if (o === val) opt.selected = true;
    sel.appendChild(opt);
  }
  if (!opts.length) {
    const opt = document.createElement("option");
    opt.value = ""; opt.textContent = "(no icons yet)";
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => onChange(sel.value));
  wrap.appendChild(sel);
  return wrap;
}

function chipField(label, opts, val, onChange, labelFn = (v) => v) {
  const wrap = fieldWrap(label);
  const row = document.createElement("div");
  row.className = "fg-chiprow";
  for (const o of opts) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "fg-chip";
    c.setAttribute("aria-pressed", o === val ? "true" : "false");
    c.textContent = labelFn(o);
    c.addEventListener("click", () => onChange(o));
    row.appendChild(c);
  }
  wrap.appendChild(row);
  return wrap;
}

function valueField(label, val, onChange) {
  const wrap = fieldWrap(label);
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px;align-items:center;";
  const isVar = typeof val === "string" && val.startsWith("var:");
  const mode = document.createElement("select");
  const optStatic = document.createElement("option"); optStatic.value = "static"; optStatic.textContent = "static";
  const optVar = document.createElement("option"); optVar.value = "var"; optVar.textContent = "var";
  mode.appendChild(optStatic); mode.appendChild(optVar);
  mode.value = isVar ? "var" : "static";
  const inp = document.createElement("input");
  if (isVar) {
    inp.type = "text"; inp.value = val.slice(4);
  } else {
    inp.type = "number"; inp.min = "0"; inp.max = "100"; inp.step = "1"; inp.value = String(val | 0);
  }
  mode.addEventListener("change", () => {
    if (mode.value === "var") {
      inp.type = "text"; inp.value = "progress"; onChange("var:progress");
    } else {
      inp.type = "number"; inp.min = "0"; inp.max = "100"; inp.step = "1"; inp.value = "50"; onChange(50);
    }
    renderInspector();
  });
  wireCommitInput(inp, {
    read: () => isVar ? "var:" + inp.value.replace(/[^a-zA-Z0-9_]/g, "_") : clampInt(inp.value, 0, 100),
    commit: onChange,
  });
  row.appendChild(mode);
  row.appendChild(inp);
  wrap.appendChild(row);
  return wrap;
}

function toggleStateField(val, onChange) {
  const wrap = fieldWrap("State");
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px;align-items:center;";
  const isVar = typeof val === "string" && val.startsWith("var:");
  const mode = document.createElement("select");
  for (const m of ["static", "var"]) {
    const o = document.createElement("option"); o.value = m; o.textContent = m;
    if ((m === "var") === isVar) o.selected = true;
    mode.appendChild(o);
  }
  let inner;
  if (isVar) {
    inner = document.createElement("input");
    inner.type = "text"; inner.value = val.slice(4);
    wireCommitInput(inner, { read: () => "var:" + inner.value.replace(/[^a-zA-Z0-9_]/g, "_"), commit: onChange });
  } else {
    inner = document.createElement("select");
    for (const v of ["false","true"]) {
      const o = document.createElement("option"); o.value = v; o.textContent = v;
      if ((v === "true") === !!val) o.selected = true;
      inner.appendChild(o);
    }
    inner.addEventListener("change", () => onChange(inner.value === "true"));
  }
  mode.addEventListener("change", () => {
    if (mode.value === "var") onChange("var:enabled"); else onChange(false);
    renderInspector();
  });
  row.appendChild(mode); row.appendChild(inner);
  wrap.appendChild(row);
  return wrap;
}

function actionField(action, onChange) {
  const wrap = fieldWrap("Action");
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px;align-items:center;";
  const mode = document.createElement("select");
  for (const m of ["goto", "custom_event"]) {
    const o = document.createElement("option"); o.value = m; o.textContent = m;
    if (action.kind === m) o.selected = true;
    mode.appendChild(o);
  }
  let inner;
  if (action.kind === "goto") {
    inner = document.createElement("select");
    for (const s of state.screens) {
      const o = document.createElement("option"); o.value = s.id; o.textContent = s.name;
      if (s.id === action.target) o.selected = true;
      inner.appendChild(o);
    }
    inner.addEventListener("change", () => onChange({ kind: "goto", target: inner.value }));
  } else {
    inner = document.createElement("input");
    inner.type = "number"; inner.min = "0"; inner.max = "9999"; inner.step = "1";
    inner.value = String(action.code | 0);
    wireCommitInput(inner, { read: () => ({ kind: "custom_event", code: clampInt(inner.value, 0, 9999) }), commit: onChange });
  }
  mode.addEventListener("change", () => {
    if (mode.value === "goto") onChange({ kind: "goto", target: state.screens[0].id });
    else onChange({ kind: "custom_event", code: 0 });
    renderInspector();
  });
  row.appendChild(mode); row.appendChild(inner);
  wrap.appendChild(row);
  return wrap;
}

function menuItemsField(items, onChange) {
  const wrap = fieldWrap("Items");
  for (let i = 0; i < items.length; i++) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:4px;margin-bottom:4px;";
    const inp = document.createElement("input");
    inp.type = "text"; inp.value = items[i].label || ""; inp.placeholder = "Label";
    inp.style.flex = "1";
    wireCommitInput(inp, {
      read: () => inp.value,
      commit: (label) => { const next = clone(items); next[i].label = label; onChange(next); },
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "fg-btn-danger";
    del.textContent = "×";
    del.style.cssText = "padding:4px 8px;";
    del.onclick = () => {
      const next = items.filter((_, j) => j !== i);
      onChange(next);
    };
    row.appendChild(inp);
    row.appendChild(del);
    wrap.appendChild(row);
  }
  if (items.length < 16) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "fg-pal-btn";
    add.textContent = "+ Add item";
    add.onclick = () => {
      const next = [...items, { label: `Item ${items.length + 1}`, action: { kind: "custom_event", code: items.length + 1 } }];
      onChange(next);
    };
    wrap.appendChild(add);
  }
  return wrap;
}

// ── Icons ──────────────────────────────────────────────────────────

function renderIconList() {
  const root = $("#fg-icon-list");
  root.innerHTML = "";
  if (state.icons.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "color:var(--c-text-faint);font-size:0.7rem;font-family:var(--f-mono);";
    empty.textContent = "no icons yet";
    root.appendChild(empty);
    return;
  }
  for (const icon of state.icons) {
    const row = document.createElement("div");
    row.className = "fg-icon-row";
    const cv = document.createElement("canvas");
    cv.width = icon.w; cv.height = icon.h;
    const c = cv.getContext("2d");
    c.fillStyle = "#000";
    renderXbm(c, 0, 0, icon.w, icon.h, b64ToBytes(icon.bits), 1);
    const name = document.createElement("span");
    name.className = "fg-icon-row__name";
    name.textContent = `${icon.name} ${icon.w}×${icon.h}`;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "fg-icon-row__del";
    del.textContent = "×";
    del.title = "Delete icon";
    del.onclick = () => deleteIcon(icon.id);
    row.appendChild(cv);
    row.appendChild(name);
    row.appendChild(del);
    root.appendChild(row);
  }
}

async function handleIconUpload(file) {
  if (!file) return;
  const w = parseInt(prompt("Icon width (1–64)", "16"), 10);
  if (!Number.isFinite(w) || w < 1 || w > 64) return;
  const h = parseInt(prompt("Icon height (1–64)", "16"), 10);
  if (!Number.isFinite(h) || h < 1 || h > 64) return;
  const dither = confirm("Apply Floyd–Steinberg dithering? OK = yes, Cancel = simple threshold.");
  try {
    const bmp = await createImageBitmap(file);
    const off = (typeof OffscreenCanvas !== "undefined")
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const oc = off.getContext("2d");
    oc.imageSmoothingEnabled = true;
    oc.drawImage(bmp, 0, 0, w, h);
    const img = oc.getImageData(0, 0, w, h);
    const bits = imageDataToBits(img, w, h, { dither });
    const packed = packXbm(bits, w, h);
    pushUndo();
    const baseName = (file.name || "icon").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_") || "icon";
    state.icons.push({
      id: genIconId(),
      name: `I_${baseName}_${w}x${h}`,
      w, h, frames: 1, rate: 0,
      bits: bytesToB64(packed),
    });
    refreshAll();
    setStatus(`Icon imported (${w}×${h}).`);
  } catch (e) {
    setStatus(`Icon import failed: ${e.message}`, true);
  }
}

function deleteIcon(id) {
  if (!confirm("Delete this icon? Any widgets referencing it will keep the id but render a placeholder.")) return;
  pushUndo();
  state.icons = state.icons.filter((i) => i.id !== id);
  refreshAll();
}

function libIconName(pick) {
  return `I_${pick.name}_${pick.w}x${pick.h}`.replace(/[^a-zA-Z0-9_]/g, "_");
}

/* Resolve a picker result to an icon id in state.icons. Library picks
   create a new record (deduped by name); uploaded picks already exist. */
function ensureLibraryIcon(pick) {
  if (pick.source === "uploaded" && pick.id) return pick.id;
  const name = libIconName(pick);
  const existing = state.icons.find((i) => i.name === name);
  if (existing) return existing.id;
  const id = genIconId();
  state.icons.push({ id, name, w: pick.w, h: pick.h, frames: 1, rate: 0, bits: pick.b64 });
  return id;
}

/* Open the picker, then place an icon widget referencing the chosen icon.
   Cancelling leaves no widget and no undo entry. */
async function addIconWidget(atX = 8, atY = 8) {
  if (!activeScreen()) return;
  const pick = await openIconPicker({ state });
  if (!pick) return;
  pushUndo();
  const iconId = ensureLibraryIcon(pick);
  placeWidget({ id: genWidgetId(), type: "icon", x: clampInt(atX, 0, 127), y: clampInt(atY, 0, 63), iconId });
  renderIconList();
}

/* Stock the icon list from the library without placing a widget. */
async function browseIcons() {
  const pick = await openIconPicker({ state });
  if (!pick || pick.source === "uploaded") return;
  if (state.icons.some((i) => i.name === libIconName(pick))) {
    setStatus("Icon already in your list.");
    return;
  }
  pushUndo();
  ensureLibraryIcon(pick);
  refreshAll();
  setStatus(`Added ${pick.name} ${pick.w}×${pick.h}.`);
}

// ── Export panel ──────────────────────────────────────────────────

let activeExport = "snippet";
let exportCache = null;
let exportersLoaded = false;
let exporters = null;

async function loadExporters() {
  if (exportersLoaded) return exporters;
  const [snip, scene, xbm, jsn, fam, entry] = await Promise.all([
    import("./exporters/snippet.js"),
    import("./exporters/scene.js"),
    import("./exporters/xbm.js"),
    import("./exporters/json.js"),
    import("./exporters/fam.js"),
    import("./exporters/entry.js"),
  ]);
  exporters = {
    snippet: () => snip.exportSnippet(state, state.activeScreenId),
    snippetFor: (id) => snip.exportSnippet(state, id),
    scene: () => scene.exportScene(state),
    xbm: () => xbm.exportXbm(state),
    json: () => jsn.exportJson(state),
    fam: () => fam.exportFam(state),
    entry: () => entry.exportEntry(state),
  };
  exportersLoaded = true;
  return exporters;
}

// ── Bundle (.zip) export ───────────────────────────────────────────

const JSZIP_CDN = {
  src: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  sri: "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG",
};

// Source files copied verbatim into the JS bundle (paths relative to the
// tool dir; mirrored under bundle's lib/).
const BUNDLE_LIB_FILES = [
  "draw-scene.js", "xbm.js", "font-render.js", "font-metrics.js",
  "fonts/primary.js", "fonts/secondary.js", "fonts/keyboard.js", "fonts/big_numbers.js",
];

let bundleTarget = "c";
let jszipPromise = null;
function ensureJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jszipPromise) {
    jszipPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = JSZIP_CDN.src;
      s.integrity = JSZIP_CDN.sri;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => reject(new Error("Failed to load JSZip"));
      document.head.appendChild(s);
    });
  }
  return jszipPromise;
}

/* Render an icon to a transparent PNG at the given integer scale (RGBA,
 * for the JS preview bundle only). */
async function renderIconPng(icon, scale = 1) {
  const cv = document.createElement("canvas");
  cv.width = icon.w * scale;
  cv.height = icon.h * scale;
  const c = cv.getContext("2d");
  c.fillStyle = "#000";
  renderXbm(c, 0, 0, icon.w, icon.h, b64ToBytes(icon.bits), scale);
  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  return { blob, dataURL: cv.toDataURL("image/png") };
}

/* Default 10x10 launcher icon (1 = black/on): a rounded tile with an
 * inner square. Used when the user hasn't set a custom app icon. */
const DEFAULT_APP_ICON_PX = [
  0,1,1,1,1,1,1,1,1,0,
  1,1,0,0,0,0,0,0,1,1,
  1,0,0,0,0,0,0,0,0,1,
  1,0,0,1,1,1,1,0,0,1,
  1,0,0,1,0,0,1,0,0,1,
  1,0,0,1,0,0,1,0,0,1,
  1,0,0,1,1,1,1,0,0,1,
  1,0,0,0,0,0,0,0,0,1,
  1,1,0,0,0,0,0,0,1,1,
  0,1,1,1,1,1,1,1,1,0,
];

function appIconPixels() {
  const ic = state.app.icon;
  if (ic && typeof ic.bits === "string") {
    return { px: unpackXbm(b64ToBytes(ic.bits), 10, 10), w: 10, h: 10 };
  }
  return { px: DEFAULT_APP_ICON_PX, w: 10, h: 10 };
}

/* 10x10 1-bit launcher icon PNG for fap_icon. Must be true 1-bit (the
 * asset compiler rejects canvas.toBlob's RGBA) — see lib/png1.js. */
async function renderAppIconPng() {
  const { px, w, h } = appIconPixels();
  return png1Blob(px, w, h);
}

/* 1-bit PNG of a design icon, for fap_icon_assets (images/) mode. */
async function renderIconPng1(icon) {
  const px = unpackXbm(b64ToBytes(icon.bits), icon.w, icon.h);
  return png1Blob(px, icon.w, icon.h);
}

async function setAppIconFromFile(file) {
  try {
    const bmp = await createImageBitmap(file);
    const off = (typeof OffscreenCanvas !== "undefined")
      ? new OffscreenCanvas(10, 10)
      : Object.assign(document.createElement("canvas"), { width: 10, height: 10 });
    const oc = off.getContext("2d");
    oc.imageSmoothingEnabled = true;
    oc.drawImage(bmp, 0, 0, 10, 10);
    const img = oc.getImageData(0, 0, 10, 10);
    const bits = imageDataToBits(img, 10, 10, { dither: false });
    pushUndo();
    state.app.icon = { w: 10, h: 10, bits: bytesToB64(packXbm(bits, 10, 10)) };
    refreshAll();
    setStatus("App icon set (10×10).");
  } catch (e) {
    setStatus("App icon failed: " + e.message, true);
  }
}

async function downloadBundle() {
  const target = bundleTarget;
  setStatus("Building bundle…");
  try {
    await loadExporters();
    const [JSZip, libFiles] = await Promise.all([
      ensureJSZip(),
      (async () => {
        const out = {};
        if (target === "js") {
          await Promise.all(BUNDLE_LIB_FILES.map(async (p) => {
            const r = await fetch(new URL("lib/" + p, location.href));
            if (!r.ok) throw new Error("fetch " + p + " → " + r.status);
            out[p] = await r.text();
          }));
        }
        return out;
      })(),
    ]);
    const { exportBundle } = await import("./exporters/bundle.js");
    const { blob, filename } = await exportBundle(state, { target, exporters, JSZip, renderIconPng, renderAppIconPng, renderIconPng1, libFiles });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`Saved ${filename}.`);
  } catch (e) {
    setStatus("Bundle failed: " + e.message, true);
  }
}

function setBundleTarget(t) {
  bundleTarget = t === "js" ? "js" : "c";
  $$("[data-bundle-target]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.bundleTarget === bundleTarget ? "true" : "false");
  });
}

async function renderExport() {
  const panel = $("#fg-export-panel");
  if (!panel || !panel.open) return;
  const out = $("#fg-export-out");
  const filenameEl = $("#fg-export-filename");
  const extra = $("#fg-export-extra");
  const extraOut = $("#fg-export-extra-out");
  const extraName = $("#fg-export-extra-filename");

  await loadExporters();
  const result = exporters[activeExport]();
  exportCache = result;

  if (Array.isArray(result)) {
    filenameEl.textContent = result[0].filename;
    out.textContent = result[0].text;
    if (result[1]) {
      extra.classList.remove("is-hidden");
      extraName.textContent = result[1].filename;
      extraOut.textContent = result[1].text;
    } else {
      extra.classList.add("is-hidden");
    }
  } else {
    filenameEl.textContent = result.filename;
    out.textContent = result.text;
    extra.classList.add("is-hidden");
  }
}

function setActiveExport(name) {
  activeExport = name;
  $$("[data-export-tab]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.exportTab === name ? "true" : "false");
  });
  renderExport();
}

function copyExport(extra = false) {
  if (!exportCache) return;
  const target = (Array.isArray(exportCache))
    ? (extra ? exportCache[1] : exportCache[0])
    : exportCache;
  if (!target) return;
  navigator.clipboard.writeText(target.text)
    .then(() => setStatus(`Copied ${target.filename}.`))
    .catch(() => setStatus("Copy failed.", true));
}

function downloadExport(extra = false) {
  if (!exportCache) return;
  const target = (Array.isArray(exportCache))
    ? (extra ? exportCache[1] : exportCache[0])
    : exportCache;
  if (!target) return;
  const blob = new Blob([target.text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = target.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`Saved ${target.filename}.`);
}

// ── Status & hash ──────────────────────────────────────────────────

let statusTimer = null;
function setStatus(msg, err = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = err ? "#ef4444" : "var(--c-text-muted)";
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.textContent = "—"; statusEl.style.color = ""; }, 2400);
}

function syncHash() {
  const encoded = encodeState();
  if (encoded.length > HASH_LIMIT) {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    setStatus("Design too large for URL — use Download JSON.", true);
    return;
  }
  const next = "#" + HASH_KEY + encoded;
  if (next !== location.hash) {
    history.replaceState(null, "", location.pathname + location.search + next);
  }
}

function readHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw.startsWith(HASH_KEY)) return null;
  return decodeState(raw.slice(HASH_KEY.length));
}

function syncAppFields() {
  $("#fg-app-name").value = state.app.name || "";
  $("#fg-app-namespace").value = state.app.namespace || "";
  const set = (sel, val) => { const el = $(sel); if (el) el.value = val; };
  set("#fg-app-category", state.app.category || "Examples");
  set("#fg-app-stack", String(state.app.stackSize || 2));
  set("#fg-app-desc", state.app.description || "");
  set("#fg-app-author", state.app.author || "");
  set("#fg-app-version", state.app.version || "1.0");
  set("#fg-app-weburl", state.app.weburl || "");
  $$("[data-require]").forEach((cb) => {
    cb.checked = (state.app.requires || ["gui"]).includes(cb.dataset.require);
  });
  $$("[data-icon-mode]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.iconMode === (state.app.iconMode || "png") ? "true" : "false");
  });
  renderAppMeta();
}

/* Mirrors exporters/scene.js safeNs so the live UI can show the derived
 * identifiers without eagerly importing the (heavier) exporter modules. */
function safeNsLocal(s) {
  return (s || "app").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[0-9]/, "_$&") || "app";
}

/* Mirrors the two FAM checks in JS-Apps/scripts/validate.mjs so the user
 * sees CI-green before downloading. */
function validateReady() {
  const ns = safeNsLocal(state.app.namespace || state.app.name || "app");
  const appid = ns;
  const folder = ns.replace(/_/g, "-");
  const entry = `${ns}_app`;
  const norm = (s) => s.toLowerCase().replace(/-/g, "_");
  const ok = norm(appid) === norm(folder) && /^[a-z_][a-z0-9_]*_app$/.test(entry);
  return { ok, appid, folder, entry };
}

function renderAppMeta() {
  const el = $("#fg-app-derived");
  if (el) {
    const { ok, appid, folder, entry } = validateReady();
    el.innerHTML =
      `<div>drops into <code>C-Apps/${folder}/</code></div>` +
      `<div>appid <code>${appid}</code> · entry <code>${entry}</code></div>` +
      `<div class="${ok ? "fg-vbadge fg-vbadge--ok" : "fg-vbadge fg-vbadge--bad"}">` +
      `${ok ? "✓ validate-ready" : "✗ check app name / namespace"}</div>`;
  }
  const cv = $("#fg-app-icon-canvas");
  if (cv) {
    const { px } = appIconPixels();
    const c = cv.getContext("2d");
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = "#000";
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (px[y * 10 + x]) c.fillRect(x * 3, y * 3, 3, 3);
      }
    }
  }
}

// ── Boot ───────────────────────────────────────────────────────────

function boot() {
  canvas = $("#fg-canvas");
  ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  overlay = $("#fg-overlay");
  stageInner = $("#fg-stage-inner");
  statusEl = $("#fg-status");

  // Hydrate from hash.
  const fromHash = readHash();
  if (fromHash) {
    state = fromHash;
    if (!state.selection) state.selection = [];
  }

  // Wire palette
  wirePaletteDrag();
  wireCanvasPointer();

  // App fields
  $("#fg-app-name").addEventListener("input", (e) => {
    pushUndo();
    state.app.name = e.target.value.slice(0, 40);
    renderAppMeta();
    scheduleRender();
  });
  $("#fg-app-namespace").addEventListener("input", (e) => {
    pushUndo();
    state.app.namespace = e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
    e.target.value = state.app.namespace;
    renderAppMeta();
    scheduleRender();
  });

  // Extended app settings (manifest fields)
  const bindAppField = (sel, key, transform) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener("change", () => {
      pushUndo();
      state.app[key] = transform ? transform(el.value) : el.value;
      renderAppMeta();
      scheduleRender();
    });
  };
  bindAppField("#fg-app-category", "category", (v) => v.slice(0, 24));
  bindAppField("#fg-app-stack", "stackSize", (v) => Math.max(1, Math.min(8, parseInt(v, 10) || 2)));
  bindAppField("#fg-app-desc", "description", (v) => v.slice(0, 200));
  bindAppField("#fg-app-author", "author", (v) => v.slice(0, 60));
  bindAppField("#fg-app-version", "version", (v) => v.slice(0, 16));
  bindAppField("#fg-app-weburl", "weburl", (v) => v.slice(0, 200));

  $$("[data-require]").forEach((cb) => {
    cb.addEventListener("change", () => {
      pushUndo();
      const set = new Set(state.app.requires || ["gui"]);
      if (cb.checked) set.add(cb.dataset.require); else set.delete(cb.dataset.require);
      set.add("gui");
      state.app.requires = [...set];
      scheduleRender();
    });
  });

  $$("[data-icon-mode]").forEach((b) => {
    b.addEventListener("click", () => {
      pushUndo();
      state.app.iconMode = b.dataset.iconMode === "assets" ? "assets" : "png";
      syncAppFields();
      scheduleRender();
    });
  });

  $("#fg-app-icon-upload")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) setAppIconFromFile(f);
    e.target.value = "";
  });

  // Zoom / grid
  $("#fg-zoom").addEventListener("input", (e) => setZoom(parseInt(e.target.value, 10)));
  $("#fg-grid").addEventListener("change", scheduleRender);

  // Tabs (delegated)
  $("#fg-tabs").addEventListener("click", (e) => {
    const close = e.target.closest("[data-screen-close]");
    if (close) {
      e.stopPropagation();
      deleteScreen(close.dataset.screenClose);
      return;
    }
    const add = e.target.closest('[data-action="add-screen"]');
    if (add) { addScreen(); return; }
    const tab = e.target.closest(".fg-tab");
    if (tab) setActiveScreen(tab.dataset.screenId);
  });

  // Tab rename (double-click)
  $("#fg-tabs").addEventListener("dblclick", (e) => {
    const tab = e.target.closest(".fg-tab");
    if (!tab) return;
    const sc = state.screens.find((s) => s.id === tab.dataset.screenId);
    if (!sc) return;
    const next = prompt("Screen name:", sc.name);
    if (next && next.trim()) {
      pushUndo();
      sc.name = next.trim().slice(0, 40);
      refreshAll();
    }
  });

  // Palette actions
  $$("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.action;
      if (a === "upload-icon") $("#fg-icon-upload").click();
      else if (a === "browse-icons") browseIcons();
      else if (a === "app-icon") $("#fg-app-icon-upload").click();
      else if (a === "app-icon-reset") {
        pushUndo();
        delete state.app.icon;
        refreshAll();
        setStatus("App icon reset to default.");
      }
      else if (a === "reset") {
        if (confirm("Reset all? This clears every screen, widget, and icon.")) {
          pushUndo();
          state = defaultState();
          refreshAll();
        }
      }
      else if (a === "sample") {
        pushUndo();
        state = clone(SAMPLE);
        state.selection = [];
        refreshAll();
      }
      else if (a === "copy-share") {
        navigator.clipboard.writeText(location.href)
          .then(() => setStatus("Share URL copied."))
          .catch(() => setStatus("Copy failed.", true));
      }
      else if (a === "copy-export") copyExport(false);
      else if (a === "download-export") downloadExport(false);
      else if (a === "download-bundle") downloadBundle();
      else if (a === "copy-export-extra") copyExport(true);
      else if (a === "download-export-extra") downloadExport(true);
      else if (a === "load-json") {
        const text = $("#fg-load-json").value;
        try {
          const parsed = JSON.parse(text);
          const valid = validateState(parsed);
          if (!valid) throw new Error("invalid spec");
          pushUndo();
          state = valid;
          state.selection = [];
          refreshAll();
          setStatus("Loaded JSON.");
        } catch (e) {
          setStatus("Load failed: " + e.message, true);
        }
      }
    });
  });

  // Icon upload
  $("#fg-icon-upload").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    handleIconUpload(f);
    e.target.value = "";
  });

  // Elements list (delegated): row label selects, checkbox toggles lock.
  $("#fg-elements").addEventListener("click", (e) => {
    const row = e.target.closest("[data-el-id]");
    if (!row) return;
    const id = row.dataset.elId;
    if (e.target.closest("input.fg-el-lock")) toggleWidgetLock(id);
    else if (e.target.closest(".fg-el-label")) selectWidget(id);
  });

  // Export tabs
  $$("[data-export-tab]").forEach((b) => {
    b.addEventListener("click", () => setActiveExport(b.dataset.exportTab));
  });
  $$("[data-bundle-target]").forEach((b) => {
    b.addEventListener("click", () => setBundleTarget(b.dataset.bundleTarget));
  });
  $("#fg-export-panel").addEventListener("toggle", () => renderExport());

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((meta && e.key.toLowerCase() === "y") || (meta && e.shiftKey && e.key.toLowerCase() === "z")) { e.preventDefault(); redo(); return; }
    if (meta && e.key.toLowerCase() === "d") {
      e.preventDefault();
      for (const id of state.selection) duplicateWidget(id);
      return;
    }
    const step = e.shiftKey ? 8 : 1;
    if (e.key === "ArrowLeft")  { e.preventDefault(); moveSelectionBy(-step, 0); }
    if (e.key === "ArrowRight") { e.preventDefault(); moveSelectionBy(step, 0); }
    if (e.key === "ArrowUp")    { e.preventDefault(); moveSelectionBy(0, -step); }
    if (e.key === "ArrowDown")  { e.preventDefault(); moveSelectionBy(0, step); }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      for (const id of [...state.selection]) deleteWidget(id);
    }
  });

  // Initial render
  refreshAll();
  setZoom(getZoom());
  setStatus("Ready.");

  // Load pixel-font glyph data, then re-render so text is pixel-exact.
  preloadFonts().then(() => scheduleRender());
}

boot();
