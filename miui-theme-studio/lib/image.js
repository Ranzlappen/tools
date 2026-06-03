/* Image helpers — decode, resize (cover/contain) and re-encode entirely with
   the native Canvas2D API. No external dependencies. */

// Decode any blob/file into an ImageBitmap (falls back to <img> if the browser
// lacks createImageBitmap for the type).
export async function decode(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image decode failed"));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dims(src) {
  return {
    w: src.naturalWidth || src.videoWidth || src.width || 0,
    h: src.naturalHeight || src.videoHeight || src.height || 0,
  };
}

// Turn a File/Blob into the asset record the state uses everywhere.
export async function toAsset(file, name) {
  const blob = file instanceof Blob ? file : new Blob([file]);
  const bmp = await decode(blob);
  const { w, h } = dims(bmp);
  if (typeof bmp.close === "function") bmp.close();
  return {
    name: name || file.name || "image",
    type: blob.type || "application/octet-stream",
    blob,
    url: URL.createObjectURL(blob),
    width: w,
    height: h,
  };
}

export function revokeAsset(asset) {
  if (asset && asset.url) {
    try {
      URL.revokeObjectURL(asset.url);
    } catch {
      /* ignore */
    }
  }
}

// Draw `src` into a w×h box using cover (fill, crop) or contain (letterbox).
export function drawFit(ctx, src, w, h, fit = "cover") {
  const s = dims(src);
  if (!s.w || !s.h) return;
  const scale =
    fit === "contain"
      ? Math.min(w / s.w, h / s.h)
      : Math.max(w / s.w, h / s.h);
  const dw = s.w * scale;
  const dh = s.h * scale;
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encode failed"))),
      type,
      quality,
    );
  });
}

// Re-encode an asset to a fixed-size JPEG (wallpapers). Returns a Blob.
export async function encodeJpeg(asset, w, h, fit = "cover", quality = 0.92) {
  const bmp = await decode(asset.blob);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  drawFit(ctx, bmp, w, h, fit);
  if (typeof bmp.close === "function") bmp.close();
  return canvasToBlob(canvas, "image/jpeg", quality);
}

// Re-encode an asset to a square transparent PNG of `size` (icons).
export async function encodePngSquare(asset, size, fit = "contain") {
  const bmp = await decode(asset.blob);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  drawFit(ctx, bmp, size, size, fit);
  if (typeof bmp.close === "function") bmp.close();
  return canvasToBlob(canvas, "image/png");
}

// Re-encode to a fixed w×h PNG (boot frames). Returns a Blob.
export async function encodePng(asset, w, h, fit = "cover") {
  const bmp = await decode(asset.blob);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  drawFit(ctx, bmp, w, h, fit);
  if (typeof bmp.close === "function") bmp.close();
  return canvasToBlob(canvas, "image/png");
}
