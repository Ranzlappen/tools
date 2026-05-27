/* Boot animation helpers — build/parse the Android-standard bootanimation.zip
   (desc.txt + partN/ folders of sequential PNG frames). */

import { encodePng, toAsset } from "./image.js";

export function descText(boot) {
  const lines = [`${boot.width} ${boot.height} ${boot.fps}`];
  for (const part of boot.parts) {
    // p <playCount> <pause> <path>
    lines.push(`p ${part.count ?? 1} ${part.pause ?? 0} ${part.name}`);
  }
  return lines.join("\n") + "\n";
}

export function parseDesc(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const [w, h, fps] = (lines[0] || "0 0 30").split(/\s+/).map(Number);
  const parts = [];
  for (const line of lines.slice(1)) {
    const m = line.split(/\s+/);
    if (m[0] === "p" || m[0] === "c") {
      parts.push({ name: m[3], count: Number(m[1]) || 0, pause: Number(m[2]) || 0, frames: [] });
    }
  }
  return { width: w || 1220, height: h || 2712, fps: fps || 30, parts };
}

const pad = (n) => String(n).padStart(4, "0");

// Build the inner bootanimation.zip as a Uint8Array. JSZip is injected.
export async function assembleBootZip(boot, { JSZip }) {
  const z = new JSZip();
  z.file("desc.txt", descText(boot));
  for (const part of boot.parts) {
    if (!part.frames.length) continue;
    const folder = z.folder(part.name);
    for (let i = 0; i < part.frames.length; i += 1) {
      const png = await encodePng(part.frames[i], boot.width, boot.height, "contain");
      folder.file(`${pad(i)}.png`, png);
    }
  }
  // Boot zips are conventionally STORED (uncompressed) for fast frame reads.
  return z.generateAsync({ type: "uint8array", compression: "STORE" });
}

// Parse an inner bootanimation.zip (already a loaded JSZip) back into state.boot.
export async function parseBootZip(zip) {
  const descFile = zip.file("desc.txt");
  const desc = descFile ? parseDesc(await descFile.async("string")) : { width: 1220, height: 2712, fps: 30, parts: [] };
  for (const part of desc.parts) {
    const entries = [];
    zip.folder(part.name).forEach((rel, file) => {
      if (!file.dir && /\.png$/i.test(rel)) entries.push({ rel, file });
    });
    entries.sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true }));
    for (const e of entries) {
      const blob = await e.file.async("blob");
      part.frames.push(await toAsset(blob, e.rel));
    }
  }
  return desc;
}
