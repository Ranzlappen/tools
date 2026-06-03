/* Generate preview/*.png + thumbnail.jpg by rendering the same pure compositor
   the live editor uses, at full device resolution. Writes into state.previews. */

import { DEVICE } from "../lib/mtz-spec.js";
import { decode, drawFit } from "../lib/image.js";
import { drawHome, drawLock, drawColors, drawBoot } from "../lib/preview-canvas.js";

function collectAssets(state) {
  const out = [];
  if (state.wallpaper.home) out.push(state.wallpaper.home);
  if (state.wallpaper.lock) out.push(state.wallpaper.lock);
  for (const ic of state.icons) if (ic.image) out.push(ic.image);
  for (const a of state.lockscreen.maml.assets || []) out.push(a);
  for (const p of state.boot.parts) for (const f of p.frames) out.push(f);
  return out;
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

function renderView(fn, state, env) {
  const canvas = document.createElement("canvas");
  canvas.width = DEVICE.width;
  canvas.height = DEVICE.height;
  const ctx = canvas.getContext("2d");
  fn(ctx, state, env);
  return canvas;
}

export async function generatePreviews(state) {
  // Pre-decode every referenced asset so the synchronous draw calls can resolve.
  const map = new Map();
  for (const asset of collectAssets(state)) {
    if (!map.has(asset)) {
      try {
        map.set(asset, await decode(asset.blob));
      } catch {
        map.set(asset, null);
      }
    }
  }
  const env = {
    img: (asset) => map.get(asset) || null,
    now: Date.now(),
    fontFamily: state.fonts[0] && state.fonts[0].family ? state.fonts[0].family : null,
    activePackage: state.packages[0] ? state.packages[0].name : null,
  };

  const images = [];
  const homeCanvas = renderView(drawHome, state, env);
  images.push({ name: "preview_home.png", blob: await toBlob(homeCanvas, "image/png") });
  images.push({ name: "preview_lockscreen.png", blob: await toBlob(renderView(drawLock, state, env), "image/png") });
  if (state.packages.length) {
    images.push({ name: "preview_systemui.png", blob: await toBlob(renderView(drawColors, state, env), "image/png") });
  }
  if (state.boot.parts.some((p) => p.frames.length)) {
    images.push({ name: "preview_boot.png", blob: await toBlob(renderView(drawBoot, state, env), "image/png") });
  }

  // thumbnail.jpg — cover-crop of the home view into the store banner box.
  const thumb = document.createElement("canvas");
  thumb.width = 720;
  thumb.height = 312;
  const tctx = thumb.getContext("2d");
  tctx.fillStyle = "#000";
  tctx.fillRect(0, 0, 720, 312);
  drawFit(tctx, homeCanvas, 720, 312, "cover");
  const thumbnail = { name: "thumbnail.jpg", blob: await toBlob(thumb, "image/jpeg", 0.85) };

  state.previews.images = images;
  state.previews.thumbnail = thumbnail;
  return state.previews;
}
