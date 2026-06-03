/* Snippet exporter — emits the draw_callback BODY for the currently
 * active screen, no includes, no function wrapper. For pasting into
 * an existing app. */

import { emitWidgetDraw } from "./scene.js";
import { getFont } from "../lib/font-metrics.js";

export function exportSnippet(state, activeScreenId) {
  const screen = state.screens.find((s) => s.id === activeScreenId) || state.screens[0];
  if (!screen) {
    return { filename: "draw_callback.snippet.c", text: "// No screen selected." };
  }
  const ctx = { lastFont: null, scrollExpr: "scroll" };
  const needsScroll = (screen.widgets || []).some(
    (w) => w.scroll && ["text", "button", "menu", "toggle"].includes(w.type));
  const lines = [];
  if (needsScroll) {
    lines.push(
      "// Side-scroll requires: #include <gui/elements.h>",
      "// Provide a `size_t scroll;` you increment on a periodic timer",
      "// (call view_port_update each tick) to animate the long text.",
    );
  }
  lines.push("canvas_clear(canvas);");
  for (const w of screen.widgets) {
    const out = emitWidgetDraw(w, ctx, state);
    if (out) lines.push(...out);
  }
  // Reset font drift comment if any non-primary font was used.
  return {
    filename: `${state.app.namespace || "app"}_${screen.id}_draw.c`,
    text: lines.join("\n") + "\n",
  };
}

// Re-export getFont for downstream consumers (kept here so the import
// graph is minimal).
export { getFont };
