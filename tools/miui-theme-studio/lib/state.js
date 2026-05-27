/* Theme state: the single source of truth the editor reads, the builder emits
   and the parser populates. Binary assets are held as in-memory blob records
   ({ name, type, blob, url, width, height }); everything else is JSON-clonable. */

import { DEVICE, DEFAULT_UI_VERSION, ICON_SIZE } from "./mtz-spec.js";

let seq = 0;
export function uid(prefix = "id") {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export function defaultState() {
  return {
    schema: 1,
    meta: {
      title: "My HyperOS Theme",
      designer: "",
      author: "",
      version: 1,
      uiVersion: DEFAULT_UI_VERSION,
    },
    wallpaper: { home: null, lock: null },
    lockscreen: {
      mode: "static",
      maml: {
        frameRate: 60,
        screenWidth: DEVICE.width,
        screenHeight: DEVICE.height,
        assets: [],
        elements: [],
      },
    },
    icons: [], // { id, pkg, image, fancy }
    fonts: [], // { id, name, blob, family }
    boot: {
      width: DEVICE.width,
      height: DEVICE.height,
      fps: 30,
      parts: [], // { name, count, pause, frames: [asset] }
    },
    packages: [], // { name, colors, integers, drawables }
    previews: { thumbnail: null, images: [] },
    passthrough: [], // { path, blob } — unrecognised imported entries
    ui: { activeView: "home", selectedId: null, zoom: 1, bootFrame: 0 },
  };
}

const HEX8 = /^#[0-9a-fA-F]{8}$/;
const HEX6 = /^#[0-9a-fA-F]{6}$/;

// Normalise a color to #AARRGGBB. Accepts #RRGGBB (assumes opaque) and #AARRGGBB.
export function normalizeColor(value) {
  const v = String(value || "").trim();
  if (HEX8.test(v)) return v.toUpperCase();
  if (HEX6.test(v)) return ("#FF" + v.slice(1)).toUpperCase();
  return v; // leave as-is; validate() will warn
}

export function slugify(str) {
  return (
    String(str || "theme")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "theme"
  );
}

// Returns { errors:[{msg}], warnings:[{msg}] }. Errors block a sensible build;
// warnings are advisory (HyperOS quirks, sizing, color format).
export function validate(state) {
  const errors = [];
  const warnings = [];

  if (!state.meta.title || !state.meta.title.trim()) {
    errors.push({ msg: "Theme title is required (goes in description.xml)." });
  }
  if (Number(state.meta.uiVersion) !== DEFAULT_UI_VERSION) {
    warnings.push({
      msg: `uiVersion is ${state.meta.uiVersion}; HyperOS / MIUI 14 expects ${DEFAULT_UI_VERSION}.`,
    });
  }

  const hasContent =
    state.wallpaper.home ||
    state.wallpaper.lock ||
    state.icons.length ||
    state.fonts.length ||
    state.boot.parts.length ||
    state.packages.length ||
    state.lockscreen.mode === "maml";
  if (!hasContent) {
    warnings.push({ msg: "Theme has no components yet — only metadata will be packaged." });
  }

  for (const ic of state.icons) {
    if (!ic.pkg) warnings.push({ msg: "An icon has no package name and will be skipped." });
    if (ic.image && (ic.image.width !== ICON_SIZE || ic.image.height !== ICON_SIZE)) {
      // Not an error — we re-encode to 192×192 on build — but worth noting.
    }
  }

  for (const pkg of state.packages) {
    for (const c of pkg.colors || []) {
      if (c.value && !HEX8.test(c.value) && !HEX6.test(c.value)) {
        warnings.push({ msg: `Color "${c.name}" in ${pkg.name} is not #AARRGGBB.` });
      }
    }
  }

  if (state.boot.parts.length) {
    const empty = state.boot.parts.filter((p) => !p.frames.length);
    if (empty.length) warnings.push({ msg: "A boot animation part has no frames." });
  }

  if (!state.previews.thumbnail && !state.previews.images.length) {
    warnings.push({ msg: "No preview images — generate them for a nicer Themes listing." });
  }

  return { errors, warnings };
}
