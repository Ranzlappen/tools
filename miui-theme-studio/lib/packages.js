/* System-UI overlay package model. Each package becomes a nested ZIP named
   exactly after the package, containing theme_values.xml (colors/integers) and
   drawable density folders of replacement PNGs. */

import { COLOR_PRESETS } from "./mtz-spec.js";

export function makePackage(name) {
  const presets = COLOR_PRESETS[name] || [];
  return {
    name,
    colors: presets.map((n) => ({ name: n, value: "#FFFFFFFF" })),
    integers: [],
    drawables: [], // { density, name, blob, url }
  };
}

export function findPackage(state, name) {
  return state.packages.find((p) => p.name === name) || null;
}

export function ensurePackage(state, name) {
  let pkg = findPackage(state, name);
  if (!pkg) {
    pkg = makePackage(name);
    state.packages.push(pkg);
  }
  return pkg;
}

export function removePackage(state, name) {
  const i = state.packages.findIndex((p) => p.name === name);
  if (i >= 0) state.packages.splice(i, 1);
}

// True if the package would emit nothing (so the builder can skip it).
export function isEmptyPackage(pkg) {
  const hasColor = (pkg.colors || []).some((c) => c.name);
  const hasInt = (pkg.integers || []).some((i) => i.name);
  const hasDrawable = (pkg.drawables || []).length > 0;
  return !hasColor && !hasInt && !hasDrawable;
}
