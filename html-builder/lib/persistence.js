/* persistence.js — localStorage autosave (consent-gated, debounced) + share
   links. The full doc (including transient ui) is stored locally for
   convenience; the share form strips the transient ui and encodes the rest as
   base64url in the URL hash. No CDN dependency — kept dependency-free so the
   tool stays fully offline-capable. */

import { cloneDoc } from "./schema.js";

const KEY = "tools:html-builder:doc";
const SAVE_MS = 600;
let timer = 0;

/* Honor the repo's functional-cookie consent (set by cookie-consent.js). */
export function canPersist() {
  try { return document.documentElement.classList.contains("consent-functional"); }
  catch (e) { return false; }
}

const SAVE_LIMIT = 4.5 * 1024 * 1024; // localStorage budget (uploaded assets count here)
let warnedSize = false;

export function save(doc) {
  if (!canPersist()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const json = JSON.stringify(doc);
      if (json.length > SAVE_LIMIT) {
        if (!warnedSize) {
          warnedSize = true;
          window.dispatchEvent(new CustomEvent("hb:notify", { detail: "Too large to autosave (images) — export to keep your work" }));
        }
        return;
      }
      warnedSize = false;
      localStorage.setItem(KEY, json);
    } catch (e) { /* quota / private mode */ }
  }, SAVE_MS);
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearLocal() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

/* ── base64url helpers ─────────────────────────────────────────────────── */
function bytesToB64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const enc = new TextEncoder();
const dec = new TextDecoder();

/* ── share link ────────────────────────────────────────────────────────── */
export const HASH_LIMIT = 32000; // skip auto-hashing very large docs

/* Share links carry the design but NOT uploaded assets — data URLs blow the
   URL length budget. `asset:` refs travel; the images don't. Returns
   { hash, droppedAssets } so the caller can warn. */
export function toHash(doc) {
  const slim = cloneDoc(doc);
  delete slim.ui;
  const droppedAssets = (slim.assets && slim.assets.length) || 0;
  slim.assets = [];
  return { hash: "d=" + bytesToB64url(enc.encode(JSON.stringify(slim))), droppedAssets };
}

export function fromHash(hash) {
  const m = /^#?d=(.+)$/.exec(hash || "");
  if (!m) return null;
  try {
    return JSON.parse(dec.decode(b64urlToBytes(m[1])));
  } catch (e) { return null; }
}
