/* Flipper GUI Studio — visual editor for Flipper Zero / Momentum GUIs.
 *
 * State mirrors the JSON export shape (schema "flipper-gui/v1"). The
 * editor canvas renders at native 128×64 with image-rendering:pixelated
 * CSS scaling, so the editor and on-device output use the same
 * coordinate system. Text rendering in the editor is approximate
 * (canvas fillText with a monospace font) — pixel-exact font rendering
 * is in the deferred set.
 */

import { FONTS, getFont, measureText } from "./lib/font-metrics.js";
import {
  packXbm, unpackXbm, bytesToB64, b64ToBytes,
  imageDataToBits, renderXbm,
} from "./lib/xbm.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ── Defaults & sample ──────────────────────────────────────────────

function defaultState() {
  return {
    v: 1,
    app: { name: "my_app", namespace: "my_app" },
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
    if (typeof p.app.name === "string") out.app.name = p.app.name.slice(0, 40);
    if (typeof p.app.namespace === "string") out.app.namespace = p.app.namespace.slice(0, 40);
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

const FG_FG = "#000000";   // pixel-on color in editor preview
const FG_BG = "transparent"; // editor canvas background is set via CSS

function renderCanvas() {
  if (!canvas) return;
  ctx.clearRect(0, 0, 128, 64);
  const sc = activeScreen();
  if (!sc) return;
  for (const w of sc.widgets) {
    drawWidget(ctx, w);
  }
  // Optional grid overlay
  const gridOn = $("#fg-grid")?.checked;
  if (gridOn) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let x = 8; x < 128; x += 8) ctx.fillRect(x, 0, 1, 64);
    for (let y = 8; y < 64; y += 8) ctx.fillRect(0, y, 128, 1);
  }
}

function drawWidget(ctx, w) {
  ctx.fillStyle = FG_FG;
  switch (w.type) {
    case "text": {
      const f = getFont(w.font || "primary");
      // Editor approximation: monospace fillText sized to cap height.
      // The CSS pixel-scaling makes small text look blocky.
      ctx.font = `${f.cap}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textBaseline = "top";
      ctx.fillText(w.text || "", w.x, w.y);
      break;
    }
    case "box":
      ctx.fillRect(w.x, w.y, w.w, w.h);
      break;
    case "frame":
      ctx.fillRect(w.x, w.y, w.w, 1);
      ctx.fillRect(w.x, w.y + w.h - 1, w.w, 1);
      ctx.fillRect(w.x, w.y, 1, w.h);
      ctx.fillRect(w.x + w.w - 1, w.y, 1, w.h);
      break;
    case "line":
      drawLine(ctx, w.x, w.y, w.x2, w.y2);
      break;
    case "dot":
      ctx.fillRect(w.x, w.y, 1, 1);
      break;
    case "icon": {
      const icon = state.icons.find((i) => i.id === w.iconId);
      if (icon) {
        const bytes = b64ToBytes(icon.bits);
        renderXbm(ctx, w.x, w.y, icon.w, icon.h, bytes, 1);
      } else {
        // Placeholder X
        ctx.fillRect(w.x, w.y, 8, 1);
        ctx.fillRect(w.x, w.y, 1, 8);
        ctx.fillRect(w.x + 7, w.y, 1, 8);
        ctx.fillRect(w.x, w.y + 7, 8, 1);
        drawLine(ctx, w.x, w.y, w.x + 7, w.y + 7);
        drawLine(ctx, w.x, w.y + 7, w.x + 7, w.y);
      }
      break;
    }
    case "button": {
      if (w.style === "invert") {
        ctx.fillRect(w.x, w.y, w.w, w.h);
        // Inverted text below.
        ctx.fillStyle = "#f0f0d0";
      } else if (w.style === "framed") {
        drawFrame(ctx, w.x, w.y, w.w, w.h);
      }
      const f = getFont("secondary");
      ctx.font = `${f.cap}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textBaseline = "top";
      const text = w.label || "";
      const textW = text.length * f.charW;
      const tx = w.x + Math.max(0, Math.floor((w.w - textW) / 2));
      const ty = w.y + Math.floor((w.h - f.cap) / 2);
      ctx.fillText(text, tx, ty);
      ctx.fillStyle = FG_FG;
      break;
    }
    case "progress": {
      drawFrame(ctx, w.x, w.y, w.w, w.h);
      const val = typeof w.value === "string" ? 50 : (w.value | 0);
      const inner = Math.max(0, Math.min(w.w - 2, Math.floor((val * (w.w - 2)) / 100)));
      ctx.fillRect(w.x + 1, w.y + 1, inner, w.h - 2);
      break;
    }
    case "menu": {
      const f = getFont("primary");
      ctx.font = `${f.cap}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textBaseline = "top";
      const lineH = w.lineH || (f.lineH + 2);
      const selected = 0; // editor preview always highlights first row.
      const items = w.items || [];
      for (let i = 0; i < items.length; i++) {
        const iy = w.y + i * lineH;
        if (i === selected) {
          ctx.fillRect(w.x, iy, w.w, lineH);
          ctx.fillStyle = "#f0f0d0";
          ctx.fillText(items[i].label || "", w.x + 2, iy + 1);
          ctx.fillStyle = FG_FG;
        } else {
          ctx.fillText(items[i].label || "", w.x + 2, iy + 1);
        }
      }
      break;
    }
    case "toggle": {
      const f = getFont("secondary");
      const box = 7;
      drawFrame(ctx, w.x, w.y, box, box);
      const on = typeof w.state === "string" ? true : !!w.state;
      if (on) ctx.fillRect(w.x + 2, w.y + 2, box - 4, box - 4);
      ctx.font = `${f.cap}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textBaseline = "top";
      ctx.fillText(w.label || "", w.x + box + 3, w.y);
      break;
    }
  }
}

function drawFrame(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function drawLine(ctx, x0, y0, x1, y1) {
  // Bresenham — gives pixel-perfect lines like canvas_draw_line.
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
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
      const textW = (w.label || "").length * f.charW;
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
  // Clamp the new widget into the canvas.
  const bb = widgetBbox(w);
  if (bb.x + bb.w > 128) w.x = Math.max(0, 128 - bb.w);
  if (bb.y + bb.h > 64) w.y = Math.max(0, 64 - bb.h);
  sc.widgets.push(w);
  state.selection = [id];
  scheduleRender();
  return id;
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
    if (!w) continue;
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
  // Back-to-front: top widget wins on click.
  for (let i = sc.widgets.length - 1; i >= 0; i--) {
    const w = sc.widgets[i];
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
      if (!w) continue;
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
      addWidget(type, 8, 8);
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
          addWidget(type, x, y);
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

function numField(label, val, lo, hi, onChange) {
  const wrap = fieldWrap(label);
  const inp = document.createElement("input");
  inp.type = "number";
  inp.min = String(lo); inp.max = String(hi); inp.step = "1";
  inp.value = String(val);
  inp.addEventListener("input", () => onChange(clampInt(inp.value, lo, hi)));
  wrap.appendChild(inp);
  return wrap;
}

function textField(label, val, onChange) {
  const wrap = fieldWrap(label);
  const inp = document.createElement("input");
  inp.type = "text";
  inp.value = val || "";
  inp.addEventListener("input", () => onChange(inp.value));
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
  inp.addEventListener("input", () => {
    if (mode.value === "var") onChange("var:" + inp.value.replace(/[^a-zA-Z0-9_]/g, "_"));
    else onChange(clampInt(inp.value, 0, 100));
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
    inner.addEventListener("input", () => onChange("var:" + inner.value.replace(/[^a-zA-Z0-9_]/g, "_")));
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
    inner.addEventListener("input", () => onChange({ kind: "custom_event", code: clampInt(inner.value, 0, 9999) }));
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
    inp.addEventListener("input", () => {
      const next = clone(items);
      next[i].label = inp.value;
      onChange(next);
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

// ── Export panel ──────────────────────────────────────────────────

let activeExport = "snippet";
let exportCache = null;
let exportersLoaded = false;
let exporters = null;

async function loadExporters() {
  if (exportersLoaded) return exporters;
  const [snip, scene, xbm, jsn] = await Promise.all([
    import("./exporters/snippet.js"),
    import("./exporters/scene.js"),
    import("./exporters/xbm.js"),
    import("./exporters/json.js"),
  ]);
  exporters = {
    snippet: () => snip.exportSnippet(state, state.activeScreenId),
    scene: () => scene.exportScene(state),
    xbm: () => xbm.exportXbm(state),
    json: () => jsn.exportJson(state),
  };
  exportersLoaded = true;
  return exporters;
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
    scheduleRender();
  });
  $("#fg-app-namespace").addEventListener("input", (e) => {
    pushUndo();
    state.app.namespace = e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
    e.target.value = state.app.namespace;
    scheduleRender();
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

  // Export tabs
  $$("[data-export-tab]").forEach((b) => {
    b.addEventListener("click", () => setActiveExport(b.dataset.exportTab));
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
}

boot();
