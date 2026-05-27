/* Pure preview compositor. Every function draws in DEVICE coordinate space
   (0..1220 × 0..2712); the caller scales the context to the target canvas.
   No DOM lookups, no module state — the live editor and the PNG exporter call
   these identically.

   env = {
     img(asset)        -> CanvasImageSource | null  (decoded, cached by caller)
     now               -> ms timestamp (for boot playback)
     fontFamily        -> string | null             (embedded font for clocks)
     activePackage     -> string | null             (System Colors view)
   } */

import { DEVICE } from "./mtz-spec.js";
import { drawFit } from "./image.js";

const W = DEVICE.width;
const H = DEVICE.height;

function colorOf(pkg, name, fallback) {
  if (!pkg) return fallback;
  const c = (pkg.colors || []).find((x) => x.name === name && x.value);
  if (!c) return fallback;
  // theme_values stores #AARRGGBB; canvas wants #RRGGBBAA.
  return argbToCss(c.value) || fallback;
}

export function argbToCss(v) {
  const s = String(v || "").trim();
  if (/^#[0-9a-fA-F]{8}$/.test(s)) {
    const a = s.slice(1, 3);
    const rgb = s.slice(3);
    return `#${rgb}${a}`;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return null;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function placeholderWall(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b1f1a");
  g.addColorStop(1, "#163d31");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function statusBar(ctx, state, env) {
  const sysui = (state.packages || []).find((p) => p.name === "com.android.systemui");
  const fg = colorOf(sysui, "status_bar_clock_color", "#ffffff");
  const time = new Date();
  const hh = String(time.getHours()).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");
  ctx.fillStyle = fg;
  ctx.font = `600 44px ${env.fontFamily || "sans-serif"}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`${hh}:${mm}`, 48, 70);
  // signal / wifi / battery glyphs as simple bars on the right
  ctx.textAlign = "right";
  ctx.font = "600 40px sans-serif";
  ctx.fillText("◉ ▰ █", W - 48, 70);
}

export function drawHome(ctx, state, env) {
  const wall = state.wallpaper.home && env.img(state.wallpaper.home);
  if (wall) drawFit(ctx, wall, W, H, state.wallpaper.home.fit || "cover");
  else placeholderWall(ctx);

  statusBar(ctx, state, env);

  // App icon grid
  const cols = 4;
  const margin = 80;
  const gap = 44;
  const cell = (W - margin * 2 - gap * (cols - 1)) / cols;
  const top = 320;
  const icons = state.icons.length
    ? state.icons
    : Array.from({ length: 12 }, (_, i) => ({ placeholder: true, pkg: `app${i}` }));

  icons.slice(0, 20).forEach((ic, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (cell + gap);
    const y = top + row * (cell + gap + 36);
    const img = !ic.placeholder && ic.image && env.img(ic.image);
    if (img) {
      ctx.save();
      roundRect(ctx, x, y, cell, cell, cell * 0.24);
      ctx.clip();
      ctx.drawImage(img, x, y, cell, cell);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(ctx, x, y, cell, cell, cell * 0.24);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = `600 ${cell * 0.4}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const letter = (ic.pkg || "?").replace(/^.*\./, "").charAt(0).toUpperCase() || "?";
      ctx.fillText(letter, x + cell / 2, y + cell / 2);
    }
    // label
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const label = (ic.pkg || "").replace(/^.*\./, "").slice(0, 10);
    ctx.fillText(label, x + cell / 2, y + cell + 6);
  });
}

function renderMamlElements(ctx, state, env, elements, assets) {
  for (const el of elements) {
    if (el.type === "Image" || el.type === "Unlocker") {
      const asset = (assets || []).find((a) => a.name === el.src);
      const img = asset && env.img(asset);
      if (img) ctx.drawImage(img, Number(el.x) || 0, Number(el.y) || 0);
      continue;
    }
    if (el.type === "Time" || el.type === "DateTime") {
      const now = new Date();
      const isDate = /[EMdy]/.test(el.format || "") && !/[Hhms]/.test(el.format || "");
      const text = isDate
        ? now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
        : `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      ctx.fillStyle = argbToCss(el.color) || "#ffffff";
      ctx.font = `600 ${Number(el.fontSize) || 64}px ${env.fontFamily || "sans-serif"}`;
      ctx.textAlign = el.align || "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, Number(el.x) || 0, Number(el.y) || 0);
    }
  }
}

export function drawLock(ctx, state, env) {
  const wall =
    (state.wallpaper.lock && env.img(state.wallpaper.lock)) ||
    (state.wallpaper.home && env.img(state.wallpaper.home));
  if (wall) {
    const fit = (state.wallpaper.lock || state.wallpaper.home).fit || "cover";
    drawFit(ctx, wall, W, H, fit);
  } else {
    placeholderWall(ctx);
  }
  // dim for legibility
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, W, H);

  if (state.lockscreen.mode === "maml" && state.lockscreen.maml.elements.length) {
    renderMamlElements(ctx, state, env, state.lockscreen.maml.elements, state.lockscreen.maml.assets);
    return;
  }
  // default clock
  const now = new Date();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `200 320px ${env.fontFamily || "sans-serif"}`;
  ctx.fillText(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, W / 2, 760);
  ctx.font = `400 64px ${env.fontFamily || "sans-serif"}`;
  ctx.fillText(now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), W / 2, 980);
}

export function drawColors(ctx, state, env) {
  ctx.fillStyle = "#0b1210";
  ctx.fillRect(0, 0, W, H);
  const pkg = (state.packages || []).find((p) => p.name === env.activePackage) || state.packages[0];
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "600 56px sans-serif";
  ctx.fillText(pkg ? pkg.name : "No system package selected", 64, 64);

  if (!pkg) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "40px sans-serif";
    ctx.fillText("Add a system package to preview its colors.", 64, 160);
    return;
  }

  let y = 220;
  for (const c of pkg.colors || []) {
    if (!c.name) continue;
    const css = argbToCss(c.value) || "#888888";
    ctx.fillStyle = css;
    roundRect(ctx, 64, y, 120, 120, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 40px sans-serif";
    ctx.fillText(c.name, 220, y + 24);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "34px monospace";
    ctx.fillText(c.value || "", 220, y + 74);
    y += 160;
    if (y > H - 200) break;
  }
}

export function drawBoot(ctx, state, env) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const frames = [];
  for (const part of state.boot.parts) for (const f of part.frames) frames.push(f);
  if (!frames.length) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "48px sans-serif";
    ctx.fillText("Add boot animation frames", W / 2, H / 2);
    return;
  }
  const idx = state.ui.bootFrame % frames.length;
  const img = env.img(frames[idx]);
  if (img) drawFit(ctx, img, W, H, "contain");
}

export function render(ctx, state, env) {
  ctx.save();
  switch (state.ui.activeView) {
    case "lock":
      drawLock(ctx, state, env);
      break;
    case "boot":
      drawBoot(ctx, state, env);
      break;
    case "colors":
      drawColors(ctx, state, env);
      break;
    case "home":
    default:
      drawHome(ctx, state, env);
  }
  ctx.restore();
}
