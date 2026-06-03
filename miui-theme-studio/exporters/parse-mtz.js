/* Parse a .mtz / .zip back into editor state. Pure — deps injected:
   parseMtz(file, { JSZip, image, xml, boot, state }).
   Detects nested ZIPs (icons, boots/bootanimation.zip, system-package overlays)
   and recurses one level; unrecognised entries are preserved in passthrough. */

import { KNOWN_PACKAGES, MAX_IMPORT_BYTES } from "../lib/mtz-spec.js";

function isZipBytes(u8) {
  return u8 && u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 0x03 || u8[2] === 0x05 || u8[2] === 0x07);
}

function basename(path) {
  return path.split("/").pop();
}

async function parseIconsZip(zip, { JSZip, image, xml }) {
  const inner = await JSZip.loadAsync(await zip.async("uint8array"));
  const icons = [];
  const byPkg = new Map();
  const fancyManifests = [];
  const fancyAssets = [];

  for (const name of Object.keys(inner.files)) {
    const f = inner.files[name];
    if (f.dir) continue;
    if (/^fancy_icons\//.test(name)) {
      if (/manifest\.xml$/.test(name)) fancyManifests.push({ name, f });
      else fancyAssets.push({ name, f });
      continue;
    }
    if (/\.png$/i.test(name) && !name.includes("/")) {
      const pkg = name.replace(/\.png$/i, "");
      const asset = await image.toAsset(await f.async("blob"), name);
      const ic = { id: `imp_${pkg}`, pkg, image: asset, fancy: null };
      icons.push(ic);
      byPkg.set(pkg, ic);
    }
  }

  for (const { name, f } of fancyManifests) {
    const pkg = name.split("/")[1];
    const cfg = xml.parseFancyIcon(await f.async("string"));
    cfg.assets = [];
    const ic = byPkg.get(pkg) || { id: `imp_${pkg}`, pkg, image: null, fancy: null };
    ic.fancy = cfg;
    if (!byPkg.has(pkg)) {
      icons.push(ic);
      byPkg.set(pkg, ic);
    }
  }
  for (const { name, f } of fancyAssets) {
    const [, pkg] = name.split("/");
    const ic = byPkg.get(pkg);
    if (ic && ic.fancy) ic.fancy.assets.push(await image.toAsset(await f.async("blob"), basename(name)));
  }
  return icons;
}

async function parsePackageZip(name, zip, { JSZip, image, xml }) {
  const inner = await JSZip.loadAsync(await zip.async("uint8array"));
  const pkg = { name, colors: [], integers: [], drawables: [] };
  const tv = inner.file("theme_values.xml");
  if (tv) {
    const parsed = xml.parseThemeValues(await tv.async("string"));
    pkg.colors = parsed.colors;
    pkg.integers = parsed.integers;
  }
  for (const entryName of Object.keys(inner.files)) {
    const f = inner.files[entryName];
    if (f.dir || !/^drawable[^/]*\/.+\.png$/i.test(entryName)) continue;
    const [density, ...rest] = entryName.split("/");
    const drawableName = rest.join("/").replace(/\.png$/i, "");
    pkg.drawables.push({
      density,
      name: drawableName,
      ...(await assetForDrawable(image, await f.async("blob"), entryName)),
    });
  }
  return pkg;
}

async function assetForDrawable(image, blob, name) {
  const a = await image.toAsset(blob, basename(name));
  return { blob: a.blob, url: a.url, width: a.width, height: a.height };
}

export async function parseMtz(file, { JSZip, image, xml, boot, state }) {
  const zip = await JSZip.loadAsync(file);

  // Size sanity check (zip-bomb guard).
  let total = 0;
  for (const name of Object.keys(zip.files)) {
    const meta = zip.files[name]._data;
    if (meta && meta.uncompressedSize) total += meta.uncompressedSize;
  }
  if (total > MAX_IMPORT_BYTES) throw new Error("Theme is too large to import safely.");

  const descFile = zip.file("description.xml");
  if (!descFile) throw new Error("Not a MIUI theme: description.xml missing.");
  state.meta = xml.parseDescription(await descFile.async("string"));

  const names = Object.keys(zip.files);
  for (const name of names) {
    const entry = zip.files[name];
    if (entry.dir) continue;

    // wallpapers
    if (name === "wallpaper/default_wallpaper.jpg") {
      state.wallpaper.home = { ...(await image.toAsset(await entry.async("blob"), "home")), fit: "cover" };
      continue;
    }
    if (name === "wallpaper/default_lock_wallpaper.jpg") {
      state.wallpaper.lock = { ...(await image.toAsset(await entry.async("blob"), "lock")), fit: "cover" };
      continue;
    }

    // lockscreen MAML
    if (name === "lockscreen/advance/manifest.xml") {
      state.lockscreen.mode = "maml";
      const maml = xml.parseLockscreenManifest(await entry.async("string"));
      state.lockscreen.maml = { ...state.lockscreen.maml, ...maml, assets: state.lockscreen.maml.assets };
      continue;
    }
    if (/^lockscreen\/advance\/.+/.test(name) && !/manifest\.xml$/.test(name)) {
      state.lockscreen.maml.assets.push(await image.toAsset(await entry.async("blob"), basename(name)));
      continue;
    }

    // fonts
    if (/^fonts\/.+\.ttf$/i.test(name)) {
      const blob = await entry.async("blob");
      state.fonts.push({ id: `imp_${basename(name)}`, name: basename(name), blob, family: null });
      continue;
    }

    // previews
    if (name === "preview/thumbnail.jpg") {
      state.previews.thumbnail = await image.toAsset(await entry.async("blob"), "thumbnail.jpg");
      continue;
    }
    if (/^preview\/.+/.test(name)) {
      state.previews.images.push(await image.toAsset(await entry.async("blob"), basename(name)));
      continue;
    }

    // nested: icons
    if (name === "icons") {
      state.icons = await parseIconsZip(entry, { JSZip, image, xml });
      continue;
    }

    // nested: boot
    if (name === "boots/bootanimation.zip") {
      const innerBoot = await JSZip.loadAsync(await entry.async("uint8array"));
      state.boot = await boot.parseBootZip(innerBoot);
      continue;
    }

    // nested: system package overlay (known name, or extensionless zip with no slash)
    const looksPackage =
      !name.includes("/") &&
      (KNOWN_PACKAGES.includes(name) || (!/\.[a-z0-9]+$/i.test(name) && isZipBytes(await entry.async("uint8array"))));
    if (looksPackage) {
      state.packages.push(await parsePackageZip(name, entry, { JSZip, image, xml }));
      continue;
    }

    if (name === "description.xml") continue;

    // anything else: preserve verbatim
    state.passthrough.push({ path: name, blob: await entry.async("blob") });
  }

  return state;
}
