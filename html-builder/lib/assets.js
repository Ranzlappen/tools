/* assets.js — uploaded-media registry. Files are read to data URLs once and
   stored on the doc as { id, name, type, dataUrl }; elements reference them via
   an "asset:<id>" src. The renderer/exporters resolve those refs (inline data
   URL for preview + single-file HTML, ./assets/<name> for ZIP). Pure registry
   logic + a size-guarded FileReader; no DOM. */

import { uid, walk } from "./schema.js";
import * as store from "./store.js";

export const MAX_FILE = 3 * 1024 * 1024;   // 3 MB per file (data-URL chars ≈ bytes)
export const MAX_TOTAL = 10 * 1024 * 1024; // 10 MB across the whole registry

const totalBytes = (assets) => assets.reduce((s, a) => s + (a.dataUrl ? a.dataUrl.length : 0), 0);
const sanitize = (name) => (String(name || "asset").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "").slice(0, 64) || "asset");

function uniqueName(assets, name) {
  const taken = new Set(assets.map((a) => a.name));
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 1;
  while (taken.has(`${base}-${i}${ext}`)) i++;
  return `${base}-${i}${ext}`;
}

/* Read a File to a data URL and register it. Resolves to the asset id (reusing
   an existing one if the content is identical). Rejects on oversize. */
export function addFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error("No file selected")); return; }
    if (file.size > MAX_FILE) { reject(new Error(`Image too large — max ${Math.floor(MAX_FILE / 1048576)} MB`)); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const assets = store.get().assets || [];
      const dupe = assets.find((a) => a.dataUrl === dataUrl);
      if (dupe) { resolve(dupe.id); return; }
      if (totalBytes(assets) + dataUrl.length > MAX_TOTAL) {
        reject(new Error("Asset storage limit reached — remove an image or export instead"));
        return;
      }
      const asset = { id: uid("a"), name: uniqueName(assets, sanitize(file.name)), type: file.type || "application/octet-stream", dataUrl };
      store.addAsset(asset);
      resolve(asset.id);
    };
    reader.readAsDataURL(file);
  });
}

export function get(id) {
  return (store.get().assets || []).find((a) => a.id === id) || null;
}
export function remove(id) { store.removeAsset(id); }

/* ids actually referenced by the tree — used to prune the registry on export. */
export function usedAssetIds(doc) {
  const ids = new Set();
  walk(doc.root, (n) => {
    for (const v of Object.values(n.attrs || {})) {
      if (typeof v === "string" && v.startsWith("asset:")) ids.add(v.slice(6));
    }
  });
  return ids;
}
