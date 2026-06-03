/* Icon picker for Flipper GUI Studio.
 *
 * A native <dialog> (built once, reused) that lets the user browse the
 * predefined library (lib/icons/library.js, lazy-loaded on first open) by
 * category + size, search by name, or pick one of their own uploaded
 * icons. Resolves with the chosen icon, or null if cancelled.
 *
 *   const pick = await openIconPicker({ state });
 *   // pick === null  → cancelled
 *   // pick === { source:"library",  name, w, h, b64 }
 *   // pick === { source:"uploaded", name, w, h, b64, id }
 */

import { renderXbm, b64ToBytes } from "./xbm.js";

const SIZES = [8, 16, 32, 64];

let dialog = null;
let libraryPromise = null;
let library = null;
let resolver = null;
let picked = false;

let ui = {};        // cached element refs
let curSize = 32;
let curCat = null;  // category id or "all"
let query = "";
let stateRef = null;

function loadLibrary() {
  if (library) return Promise.resolve(library);
  if (!libraryPromise) {
    libraryPromise = import("./icons/library.js")
      .then((m) => { library = m.default; return library; });
  }
  return libraryPromise;
}

function thumbCanvas(b64, size) {
  const scale = Math.max(1, Math.round(48 / size));
  const cv = document.createElement("canvas");
  cv.width = size * scale;
  cv.height = size * scale;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#000";
  renderXbm(ctx, 0, 0, size, size, b64ToBytes(b64), scale);
  return cv;
}

function makeTile(label, b64, size, onClick) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "fg-pick-tile";
  tile.title = label;
  tile.appendChild(thumbCanvas(b64, size));
  const cap = document.createElement("span");
  cap.className = "fg-pick-tile__cap";
  cap.textContent = label;
  tile.appendChild(cap);
  tile.addEventListener("click", onClick);
  return tile;
}

function resolveWith(pick) {
  picked = true;
  const r = resolver;
  resolver = null;
  dialog.close();
  if (r) r(pick);
}

function renderGrid() {
  const grid = ui.grid;
  grid.innerHTML = "";
  const q = query.trim().toLowerCase();

  // Library icons.
  let count = 0;
  for (const cat of library.categories) {
    if (curCat !== "all" && cat.id !== curCat) continue;
    for (const ic of cat.icons) {
      if (q && !ic.name.toLowerCase().includes(q)) continue;
      const b64 = ic.sizes[curSize];
      grid.appendChild(makeTile(ic.name, b64, curSize, () =>
        resolveWith({ source: "library", name: ic.name, w: curSize, h: curSize, b64 })));
      count++;
    }
  }

  // The user's own uploaded icons (always shown, any size).
  const own = (stateRef?.icons || []).filter((i) => !q || i.name.toLowerCase().includes(q));
  if (own.length) {
    const sep = document.createElement("div");
    sep.className = "fg-pick-sep";
    sep.textContent = "Your icons";
    grid.appendChild(sep);
    for (const i of own) {
      grid.appendChild(makeTile(`${i.name} ${i.w}×${i.h}`, i.bits, i.w, () =>
        resolveWith({ source: "uploaded", name: i.name, w: i.w, h: i.h, b64: i.bits, id: i.id })));
    }
  }

  if (count === 0 && !own.length) {
    const empty = document.createElement("div");
    empty.className = "fg-pick-empty";
    empty.textContent = "No icons match.";
    grid.appendChild(empty);
  }
}

function renderCats() {
  ui.cats.innerHTML = "";
  const tabs = [{ id: "all", label: "All" }, ...library.categories.map((c) => ({ id: c.id, label: c.label }))];
  for (const t of tabs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fg-pick-cat";
    b.textContent = t.label;
    b.setAttribute("aria-pressed", t.id === curCat ? "true" : "false");
    b.addEventListener("click", () => { curCat = t.id; renderCats(); renderGrid(); });
    ui.cats.appendChild(b);
  }
}

function renderSizes() {
  ui.sizes.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", Number(b.dataset.size) === curSize ? "true" : "false");
  });
}

function buildDialog() {
  if (dialog) return;
  dialog = document.createElement("dialog");
  dialog.className = "fg-icon-picker";
  dialog.innerHTML = `
    <div class="fg-pick-head">
      <strong>Choose an icon</strong>
      <button type="button" class="fg-pick-close" aria-label="Close">×</button>
    </div>
    <div class="fg-pick-controls">
      <input type="search" class="fg-pick-search" placeholder="Search…" aria-label="Search icons" />
      <div class="fg-pick-sizes" role="group" aria-label="Icon size">
        ${SIZES.map((s) => `<button type="button" data-size="${s}">${s}</button>`).join("")}
      </div>
    </div>
    <div class="fg-pick-cats" role="tablist" aria-label="Category"></div>
    <div class="fg-pick-grid"></div>`;
  document.body.appendChild(dialog);

  ui = {
    search: dialog.querySelector(".fg-pick-search"),
    sizes: dialog.querySelector(".fg-pick-sizes"),
    cats: dialog.querySelector(".fg-pick-cats"),
    grid: dialog.querySelector(".fg-pick-grid"),
  };

  ui.search.addEventListener("input", () => { query = ui.search.value; renderGrid(); });
  ui.sizes.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-size]");
    if (!b) return;
    curSize = Number(b.dataset.size);
    renderSizes();
    renderGrid();
  });
  dialog.querySelector(".fg-pick-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  // Native close (Esc, backdrop, close button) → resolve null unless a pick fired.
  dialog.addEventListener("close", () => {
    if (!picked && resolver) { const r = resolver; resolver = null; r(null); }
  });
}

export async function openIconPicker({ state } = {}) {
  buildDialog();
  stateRef = state;
  picked = false;
  if (curCat === null) curCat = "all";
  ui.grid.innerHTML = '<div class="fg-pick-empty">Loading…</div>';
  ui.search.value = query = "";
  renderSizes();
  dialog.showModal();
  await loadLibrary();
  renderCats();
  renderGrid();
  return new Promise((resolve) => { resolver = resolve; });
}
