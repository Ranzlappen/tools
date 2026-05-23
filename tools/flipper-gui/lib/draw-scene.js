/* Pure 1-bit scene renderer — shared by the editor canvas (tool.js) and
 * the exported JS bundle (render.js). No DOM or editor state: the icon
 * list is passed in explicitly so the same code renders identically in
 * both contexts.
 *
 * Pixels are drawn black (PIXEL_ON) on the caller's surface. Inverted
 * regions (button "invert", selected menu row) paint text in PAPER, the
 * Flipper LCD "off" colour — so render onto a PAPER-filled canvas.
 */

import { getFont } from "./font-metrics.js";
import { blitText, measureText } from "./font-render.js";
import { renderXbm, b64ToBytes } from "./xbm.js";

export const PIXEL_ON = "#000000";
export const PAPER = "#f0f0d0";

function drawText(ctx, x, y, text, fontKey) {
  if (blitText(ctx, x, y, text, fontKey) !== null) return;
  const f = getFont(fontKey);
  ctx.font = `${f.cap}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textBaseline = "top";
  ctx.fillText(text || "", x, y);
}

function drawFrame(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function drawLine(ctx, x0, y0, x1, y1) {
  // Bresenham — pixel-perfect, matches canvas_draw_line.
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

export function drawWidget(ctx, w, icons = []) {
  ctx.fillStyle = PIXEL_ON;
  switch (w.type) {
    case "text":
      drawText(ctx, w.x, w.y, w.text || "", w.font || "primary");
      break;
    case "box":
      ctx.fillRect(w.x, w.y, w.w, w.h);
      break;
    case "frame":
      drawFrame(ctx, w.x, w.y, w.w, w.h);
      break;
    case "line":
      drawLine(ctx, w.x, w.y, w.x2, w.y2);
      break;
    case "dot":
      ctx.fillRect(w.x, w.y, 1, 1);
      break;
    case "icon": {
      const icon = icons.find((i) => i.id === w.iconId);
      if (icon) {
        renderXbm(ctx, w.x, w.y, icon.w, icon.h, b64ToBytes(icon.bits), 1);
      } else {
        // Placeholder X for a missing icon ref.
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
        ctx.fillStyle = PAPER;
      } else if (w.style === "framed") {
        drawFrame(ctx, w.x, w.y, w.w, w.h);
      }
      const f = getFont("secondary");
      const text = w.label || "";
      const textW = measureText(text, "secondary").w;
      const tx = w.x + Math.max(0, Math.floor((w.w - textW) / 2));
      const ty = w.y + Math.floor((w.h - f.cap) / 2);
      drawText(ctx, tx, ty, text, "secondary");
      ctx.fillStyle = PIXEL_ON;
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
      const lineH = w.lineH || (f.lineH + 2);
      const selected = 0; // preview highlights the first row.
      const items = w.items || [];
      for (let i = 0; i < items.length; i++) {
        const iy = w.y + i * lineH;
        if (i === selected) {
          ctx.fillRect(w.x, iy, w.w, lineH);
          ctx.fillStyle = PAPER;
          drawText(ctx, w.x + 2, iy + 1, items[i].label || "", "primary");
          ctx.fillStyle = PIXEL_ON;
        } else {
          drawText(ctx, w.x + 2, iy + 1, items[i].label || "", "primary");
        }
      }
      break;
    }
    case "toggle": {
      const box = 7;
      drawFrame(ctx, w.x, w.y, box, box);
      const on = typeof w.state === "string" ? true : !!w.state;
      if (on) ctx.fillRect(w.x + 2, w.y + 2, box - 4, box - 4);
      drawText(ctx, w.x + box + 3, w.y, w.label || "", "secondary");
      break;
    }
  }
}

export function drawScene(ctx, widgets, icons = []) {
  for (const w of widgets) drawWidget(ctx, w, icons);
}
