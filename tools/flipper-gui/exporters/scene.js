/* Scene exporter — full .c + .h pair targeting Momentum/Flipper Zero
 * ViewPort pattern.
 *
 * Output layout:
 *
 *   <ns>_scene.h
 *     - #pragma once
 *     - AppScreen enum
 *     - AppModel struct (collected variable bindings)
 *     - Opaque scene typedef + public API (alloc/free/view_port/run)
 *
 *   <ns>_scene.c
 *     - Includes (furi + gui + input)
 *     - Static icon byte arrays (only those referenced by widgets)
 *     - Per-screen static draw helpers
 *     - Master draw_callback + input_callback dispatcher
 *     - Allocator that wires callbacks + initial state
 */

import { getFont } from "../lib/font-metrics.js";
import { bytesToCArray, b64ToBytes } from "../lib/xbm.js";

// ── Identifier helpers ─────────────────────────────────────────────

export function safeNs(s) {
  return (s || "app").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[0-9]/, "_$&") || "app";
}

export function pascal(s) {
  return (s || "").split(/[_\s-]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("") || "Unnamed";
}

function cString(s) {
  return '"' + String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"';
}

function parseVar(field) {
  if (typeof field === "string" && field.startsWith("var:")) {
    const name = field.slice(4).trim();
    if (/^[a-z_][a-z0-9_]*$/i.test(name)) return name;
  }
  return null;
}

const KEY_TO_INPUT = {
  ok: "InputKeyOk",
  up: "InputKeyUp",
  down: "InputKeyDown",
  left: "InputKeyLeft",
  right: "InputKeyRight",
  back: "InputKeyBack",
};

const EVENT_TO_TYPE = {
  short: "InputTypeShort",
  long: "InputTypeLong",
  repeat: "InputTypeRepeat",
};

// ── Per-widget draw emitter ────────────────────────────────────────
// Returns an array of C lines (no leading whitespace; the caller
// indents). `ctx.lastFont` tracks the most-recently-set font to avoid
// redundant canvas_set_font calls.

export function emitWidgetDraw(w, ctx, state) {
  if (!w || w.locked) return [];
  switch (w.type) {
    case "text": {
      const font = w.font || "primary";
      const fontC = getFont(font).name;
      const lines = [];
      if (ctx.lastFont !== font) {
        lines.push(`canvas_set_font(canvas, ${fontC});`);
        ctx.lastFont = font;
      }
      const f = getFont(font);
      const baselineY = (w.y | 0) + f.baseline;
      lines.push(`canvas_draw_str(canvas, ${w.x | 0}, ${baselineY}, ${cString(w.text || "")});`);
      return lines;
    }
    case "box":
      return [`canvas_draw_box(canvas, ${w.x | 0}, ${w.y | 0}, ${w.w | 0}, ${w.h | 0});`];
    case "frame":
      return [`canvas_draw_frame(canvas, ${w.x | 0}, ${w.y | 0}, ${w.w | 0}, ${w.h | 0});`];
    case "line":
      return [`canvas_draw_line(canvas, ${w.x | 0}, ${w.y | 0}, ${w.x2 | 0}, ${w.y2 | 0});`];
    case "dot":
      return [`canvas_draw_dot(canvas, ${w.x | 0}, ${w.y | 0});`];
    case "icon": {
      const icon = (state.icons || []).find((i) => i.id === w.iconId);
      if (!icon) return [`// missing icon ref: ${w.iconId}`];
      return [`canvas_draw_xbm(canvas, ${w.x | 0}, ${w.y | 0}, ${icon.w}, ${icon.h}, ${icon.name});`];
    }
    case "button": {
      // Visual: frame + centered label. Input wiring lives in the
      // input_callback emitter.
      const lines = [];
      const style = w.style || "framed";
      if (style === "framed") {
        lines.push(`canvas_draw_frame(canvas, ${w.x | 0}, ${w.y | 0}, ${w.w | 0}, ${w.h | 0});`);
      } else if (style === "invert") {
        lines.push(`canvas_draw_box(canvas, ${w.x | 0}, ${w.y | 0}, ${w.w | 0}, ${w.h | 0});`);
        lines.push(`canvas_set_color(canvas, ColorWhite);`);
      }
      const font = "secondary";
      const fontC = getFont(font).name;
      if (ctx.lastFont !== font) {
        lines.push(`canvas_set_font(canvas, ${fontC});`);
        ctx.lastFont = font;
      }
      const f = getFont(font);
      const label = w.label || "";
      const textW = label.length * f.charW;
      const tx = (w.x | 0) + Math.max(0, Math.floor(((w.w | 0) - textW) / 2));
      const ty = (w.y | 0) + Math.floor(((w.h | 0) - f.lineH) / 2) + f.baseline;
      lines.push(`canvas_draw_str(canvas, ${tx}, ${ty}, ${cString(label)});`);
      if (style === "invert") {
        lines.push(`canvas_set_color(canvas, ColorBlack);`);
      }
      return lines;
    }
    case "progress": {
      const lines = [`canvas_draw_frame(canvas, ${w.x | 0}, ${w.y | 0}, ${w.w | 0}, ${w.h | 0});`];
      const valVar = parseVar(w.value);
      const inner = `((${valVar ? `state->${valVar}` : (w.value | 0)}) * (${(w.w | 0) - 2}) / 100)`;
      lines.push(`canvas_draw_box(canvas, ${(w.x | 0) + 1}, ${(w.y | 0) + 1}, ${inner}, ${(w.h | 0) - 2});`);
      return lines;
    }
    case "menu": {
      const lines = [];
      const font = "primary";
      const fontC = getFont(font).name;
      if (ctx.lastFont !== font) {
        lines.push(`canvas_set_font(canvas, ${fontC});`);
        ctx.lastFont = font;
      }
      const f = getFont(font);
      const lineH = (w.lineH | 0) || (f.lineH + 2);
      const selVar = parseVar(w.selectedVar) || "menu_cursor";
      const items = w.items || [];
      // Render items via a small in-place loop so the count is dynamic.
      const cArr = items.map((it) => cString(it.label || ""));
      lines.push(`{`);
      lines.push(`    static const char* const items[] = { ${cArr.join(", ")} };`);
      lines.push(`    const size_t count = ${items.length};`);
      lines.push(`    for(size_t i = 0; i < count; i++) {`);
      lines.push(`        int iy = ${w.y | 0} + (int)i * ${lineH};`);
      lines.push(`        if(i == state->${selVar}) {`);
      lines.push(`            canvas_draw_box(canvas, ${w.x | 0}, iy, ${w.w | 0}, ${lineH});`);
      lines.push(`            canvas_set_color(canvas, ColorWhite);`);
      lines.push(`            canvas_draw_str(canvas, ${(w.x | 0) + 2}, iy + ${f.baseline + 1}, items[i]);`);
      lines.push(`            canvas_set_color(canvas, ColorBlack);`);
      lines.push(`        } else {`);
      lines.push(`            canvas_draw_str(canvas, ${(w.x | 0) + 2}, iy + ${f.baseline + 1}, items[i]);`);
      lines.push(`        }`);
      lines.push(`    }`);
      lines.push(`}`);
      ctx.lastFont = font;
      return lines;
    }
    case "toggle": {
      const lines = [];
      const font = "secondary";
      const fontC = getFont(font).name;
      if (ctx.lastFont !== font) {
        lines.push(`canvas_set_font(canvas, ${fontC});`);
        ctx.lastFont = font;
      }
      const f = getFont(font);
      const boxSize = 7;
      // Box at left, label right of it.
      lines.push(`canvas_draw_frame(canvas, ${w.x | 0}, ${w.y | 0}, ${boxSize}, ${boxSize});`);
      const stVar = parseVar(w.state);
      const cond = stVar ? `state->${stVar}` : (w.state ? "true" : "false");
      lines.push(`if(${cond}) {`);
      lines.push(`    canvas_draw_box(canvas, ${(w.x | 0) + 2}, ${(w.y | 0) + 2}, ${boxSize - 4}, ${boxSize - 4});`);
      lines.push(`}`);
      const tx = (w.x | 0) + boxSize + 3;
      const ty = (w.y | 0) + f.baseline - 1;
      lines.push(`canvas_draw_str(canvas, ${tx}, ${ty}, ${cString(w.label || "")});`);
      return lines;
    }
    default:
      return [`// unknown widget type: ${w.type}`];
  }
}

// ── Variable collector ─────────────────────────────────────────────

function collectModelVars(state) {
  const out = new Map(); // name → cType
  for (const s of state.screens) {
    for (const w of s.widgets) {
      if (w.type === "progress") {
        const v = parseVar(w.value);
        if (v) out.set(v, "uint8_t");
      } else if (w.type === "toggle") {
        const v = parseVar(w.state);
        if (v) out.set(v, "bool");
      } else if (w.type === "menu") {
        const v = parseVar(w.selectedVar) || "menu_cursor";
        out.set(v, "uint8_t");
      }
    }
  }
  return out;
}

// ── Input callback per-screen branches ─────────────────────────────

function emitScreenInput(screen, state, TPrefix) {
  const buttons = screen.widgets.filter((w) => w.type === "button" && w.action);
  const menus = screen.widgets.filter((w) => w.type === "menu");
  const lines = [];
  // Default key event filter (short).
  const grouped = new Map(); // event → [{key, action}]
  for (const b of buttons) {
    const evt = EVENT_TO_TYPE[b.event || "short"] || "InputTypeShort";
    if (!grouped.has(evt)) grouped.set(evt, []);
    grouped.get(evt).push(b);
  }
  // Menu nav: up/down adjust the cursor variable (clamp to item count).
  for (const m of menus) {
    const selVar = parseVar(m.selectedVar) || "menu_cursor";
    const count = (m.items || []).length;
    if (count > 0) {
      if (!grouped.has("InputTypeShort")) grouped.set("InputTypeShort", []);
      grouped.get("InputTypeShort").push({ key: "up", action: { kind: "menu_prev", var: selVar, count } });
      grouped.get("InputTypeShort").push({ key: "down", action: { kind: "menu_next", var: selVar, count } });
      // OK on a menu fires the selected item's action.
      grouped.get("InputTypeShort").push({ key: "ok", action: { kind: "menu_ok", menu: m } });
    }
  }
  for (const [evt, entries] of grouped) {
    lines.push(`            if(e->type == ${evt}) {`);
    for (const ent of entries) {
      const keyC = KEY_TO_INPUT[ent.key];
      if (!keyC) continue;
      const body = emitAction(ent.action, state, TPrefix);
      if (!body) continue;
      lines.push(`                if(e->key == ${keyC}) { ${body} }`);
    }
    lines.push(`            }`);
  }
  return lines;
}

function emitAction(action, state, TPrefix) {
  if (!action || !action.kind) return null;
  if (action.kind === "goto") {
    const target = state.screens.find((s) => s.id === action.target);
    if (!target) return null;
    return `state->screen = ${TPrefix}Screen${pascal(target.name)};`;
  }
  if (action.kind === "custom_event") {
    return `state->last_event = ${action.code | 0};`;
  }
  if (action.kind === "menu_prev") {
    return `if(state->${action.var} > 0) state->${action.var}--;`;
  }
  if (action.kind === "menu_next") {
    return `if(state->${action.var} < ${action.count - 1}) state->${action.var}++;`;
  }
  if (action.kind === "menu_ok") {
    // Switch on the menu cursor to dispatch per-item action.
    const m = action.menu;
    const selVar = parseVar(m.selectedVar) || "menu_cursor";
    const cases = (m.items || []).map((it, i) => {
      const inner = emitAction(it.action, state, TPrefix);
      return `case ${i}: ${inner || "/* no-op */"} break;`;
    });
    return `switch(state->${selVar}) { ${cases.join(" ")} }`;
  }
  return null;
}

// ── Full scene generator ───────────────────────────────────────────

export function exportScene(state) {
  const ns = safeNs(state.app.namespace || state.app.name || "app");
  const TPrefix = pascal(state.app.name || ns);
  const screens = state.screens.length ? state.screens : [{ id: "scr_main", name: "Main", widgets: [] }];
  const referencedIcons = collectReferencedIcons(state);
  const modelVars = collectModelVars(state);

  // ── Header ────────────────────────────────────────────────────
  const screenEnum = screens.map((s, i) => `    ${TPrefix}Screen${pascal(s.name)}${i === 0 ? " = 0" : ""},`).join("\n");
  const modelFields = [];
  modelFields.push(`    ${TPrefix}Screen screen;`);
  modelFields.push(`    int32_t last_event;`);
  for (const [name, type] of modelVars) {
    modelFields.push(`    ${type} ${name};`);
  }

  const h = `#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
${screenEnum}
} ${TPrefix}Screen;

typedef struct {
${modelFields.join("\n")}
} ${TPrefix}Model;

typedef struct ${TPrefix}Scene ${TPrefix}Scene;

${TPrefix}Scene* ${ns}_scene_alloc(void);
void              ${ns}_scene_free(${TPrefix}Scene* scene);
void              ${ns}_scene_run(${TPrefix}Scene* scene);
${TPrefix}Model*  ${ns}_scene_model(${TPrefix}Scene* scene);

#ifdef __cplusplus
}
#endif
`;

  // ── Source ────────────────────────────────────────────────────
  const iconDecls = referencedIcons.map((icon) => {
    const bytes = b64ToBytes(icon.bits || "");
    return `static const uint8_t ${icon.name}[] = {
${bytesToCArray(bytes)}
};`;
  }).join("\n\n");

  const drawHelpers = screens.map((screen) => {
    const ctx = { lastFont: null };
    const lines = [];
    for (const w of screen.widgets) {
      const out = emitWidgetDraw(w, ctx, state);
      if (out) lines.push(...out.map((l) => "    " + l));
    }
    return `static void draw_screen_${pascal(screen.name).toLowerCase()}(Canvas* canvas, ${TPrefix}Model* state) {
    (void)state;
${lines.join("\n")}
}`;
  }).join("\n\n");

  const drawDispatch = screens.map((s) =>
    `        case ${TPrefix}Screen${pascal(s.name)}: draw_screen_${pascal(s.name).toLowerCase()}(canvas, state); break;`
  ).join("\n");

  const inputBranches = screens.map((s) => {
    const branchBody = emitScreenInput(s, state, TPrefix);
    return `        case ${TPrefix}Screen${pascal(s.name)}:
${branchBody.join("\n")}
            if(e->type == InputTypeShort && e->key == InputKeyBack) {
                if(state->screen == ${TPrefix}Screen${pascal(screens[0].name)}) {
                    view_port_enabled_set(scene_ptr->vp, false);
                } else {
                    state->screen = ${TPrefix}Screen${pascal(screens[0].name)};
                }
            }
            break;`;
  }).join("\n");

  const modelInit = [];
  modelInit.push(`    scene->model.screen = ${TPrefix}Screen${pascal(screens[0].name)};`);
  modelInit.push(`    scene->model.last_event = 0;`);
  for (const [name, type] of modelVars) {
    const init = type === "bool" ? "false" : "0";
    modelInit.push(`    scene->model.${name} = ${init};`);
  }

  const c = `#include "${ns}_scene.h"

#include <furi.h>
#include <gui/gui.h>
#include <gui/view_port.h>
#include <input/input.h>

// ─── Internal scene struct ────────────────────────────────────────────

struct ${TPrefix}Scene {
    Gui* gui;
    ViewPort* vp;
    FuriMessageQueue* events;
    ${TPrefix}Model model;
};

static ${TPrefix}Scene* scene_ptr = NULL; // single-instance shortcut for callbacks

// ─── Icon byte arrays ─────────────────────────────────────────────────

${iconDecls || "// (no icons referenced)"}

// ─── Per-screen draw helpers ──────────────────────────────────────────

${drawHelpers}

// ─── Master draw callback ─────────────────────────────────────────────

static void ${ns}_draw_callback(Canvas* canvas, void* ctx) {
    ${TPrefix}Model* state = ctx;
    canvas_clear(canvas);
    switch(state->screen) {
${drawDispatch}
    }
}

// ─── Master input callback ────────────────────────────────────────────

static void ${ns}_input_callback(InputEvent* e, void* ctx) {
    ${TPrefix}Model* state = ctx;
    switch(state->screen) {
${inputBranches}
    }
    if(scene_ptr) view_port_update(scene_ptr->vp);
}

// ─── Public API ───────────────────────────────────────────────────────

${TPrefix}Scene* ${ns}_scene_alloc(void) {
    ${TPrefix}Scene* scene = malloc(sizeof(${TPrefix}Scene));
${modelInit.join("\n")}

    scene->gui = furi_record_open(RECORD_GUI);
    scene->vp = view_port_alloc();
    view_port_draw_callback_set(scene->vp, ${ns}_draw_callback, &scene->model);
    view_port_input_callback_set(scene->vp, ${ns}_input_callback, &scene->model);
    gui_add_view_port(scene->gui, scene->vp, GuiLayerFullscreen);
    scene_ptr = scene;
    return scene;
}

void ${ns}_scene_free(${TPrefix}Scene* scene) {
    if(!scene) return;
    view_port_enabled_set(scene->vp, false);
    gui_remove_view_port(scene->gui, scene->vp);
    view_port_free(scene->vp);
    furi_record_close(RECORD_GUI);
    if(scene_ptr == scene) scene_ptr = NULL;
    free(scene);
}

void ${ns}_scene_run(${TPrefix}Scene* scene) {
    // Simple blocking loop: wait until the view port is disabled (e.g. Back on the root screen).
    while(view_port_is_enabled(scene->vp)) {
        furi_delay_ms(50);
    }
}

${TPrefix}Model* ${ns}_scene_model(${TPrefix}Scene* scene) {
    return &scene->model;
}
`;

  return [
    { filename: `${ns}_scene.h`, text: h },
    { filename: `${ns}_scene.c`, text: c },
  ];
}

function collectReferencedIcons(state) {
  const used = new Set();
  for (const s of state.screens) {
    for (const w of s.widgets) {
      if (w.type === "icon" && w.iconId) used.add(w.iconId);
    }
  }
  return (state.icons || []).filter((i) => used.has(i.id));
}
