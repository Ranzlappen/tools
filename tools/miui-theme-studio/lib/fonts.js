/* Google Fonts helpers. Fetches real .ttf files (so they embed into the theme)
   from jsDelivr's mirror of the open-source google/fonts repo. The curated list
   in font-catalog.js has verified paths; any other family is resolved at
   runtime from its METADATA.pb. All fetches are CORS-enabled and key-less. */

import { CURATED_FONTS } from "./font-catalog.js";

// Tracks google/fonts main. jsDelivr caches per-path; search self-heals because
// it reads each family's METADATA.pb from the same ref.
const GF = "https://cdn.jsdelivr.net/gh/google/fonts@main";

export { CURATED_FONTS };

export function slugify(family) {
  return family.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function ttfUrl(entry) {
  // encode the file segment so variable-font brackets survive the URL.
  return `${GF}/${entry.dir}/${entry.slug}/${encodeURIComponent(entry.file)}`;
}

export function safeName(family) {
  return family.replace(/[^A-Za-z0-9]/g, "") + ".ttf";
}

// Choose the best single file from a METADATA.pb body: prefer a variable font
// (all weights in one file), then a static Regular, then any non-italic.
function pickFile(meta) {
  const files = [...meta.matchAll(/filename:\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((f) => !/Italic/i.test(f));
  return (
    files.find((f) => /\[/.test(f)) ||
    files.find((f) => /[-_]Regular\.ttf$/i.test(f)) ||
    files[0] ||
    null
  );
}

function familyName(meta, fallback) {
  const m = meta.match(/name:\s*"([^"]+)"/);
  return m ? m[1] : fallback;
}

// Resolve an arbitrary family name to a concrete { family, slug, dir, file }.
// Returns null if it can't be found in the open-license trees.
export async function resolveFamily(input) {
  const slug = slugify(input);
  if (!slug) return null;
  for (const dir of ["ofl", "apache", "ufl"]) {
    let res;
    try {
      res = await fetch(`${GF}/${dir}/${slug}/METADATA.pb`);
    } catch {
      continue;
    }
    if (!res.ok) continue;
    const meta = await res.text();
    const file = pickFile(meta);
    if (file) return { family: familyName(meta, input), slug, dir, file };
  }
  return null;
}

// Fetch the .ttf for an entry as a Blob.
export async function fetchTtf(entry) {
  const res = await fetch(ttfUrl(entry));
  if (!res.ok) throw new Error(`Couldn't fetch ${entry.family} (${res.status}).`);
  return res.blob();
}

export function searchCurated(query) {
  const q = query.trim().toLowerCase();
  if (!q) return CURATED_FONTS;
  return CURATED_FONTS.filter((f) => f.family.toLowerCase().includes(q));
}
