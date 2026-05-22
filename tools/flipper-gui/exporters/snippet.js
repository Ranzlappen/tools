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
  const ctx = { lastFont: null };
  const lines = ["canvas_clear(canvas);"];
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
