/* Build a .mtz (a ZIP renamed to .mtz). Pure — all environment is injected:
   buildMtz(state, { JSZip, image, xml, boot, packages }).

   Components that are themselves ZIPs (`icons`, `boots/bootanimation.zip`, each
   system-package overlay) are generated to a Uint8Array first, then added to
   the outer ZIP as a single STORED entry. */

import { ICON_SIZE, DEVICE } from "../lib/mtz-spec.js";

async function innerZip(JSZip, buildFn, opts = {}) {
  const z = new JSZip();
  await buildFn(z);
  return z.generateAsync({ type: "uint8array", compression: opts.compression || "DEFLATE" });
}

export async function buildMtz(state, { JSZip, image, xml, boot, packages }) {
  const onProgress = state.__onProgress || (() => {});
  const outer = new JSZip();

  // 1. description.xml (required)
  outer.file("description.xml", xml.description(state.meta));
  onProgress("metadata");

  // 2. wallpaper
  if (state.wallpaper.home) {
    const jpg = await image.encodeJpeg(state.wallpaper.home, DEVICE.width, DEVICE.height, state.wallpaper.home.fit || "cover");
    outer.file("wallpaper/default_wallpaper.jpg", jpg);
  }
  if (state.wallpaper.lock) {
    const jpg = await image.encodeJpeg(state.wallpaper.lock, DEVICE.width, DEVICE.height, state.wallpaper.lock.fit || "cover");
    outer.file("wallpaper/default_lock_wallpaper.jpg", jpg);
  }
  onProgress("wallpaper");

  // 3. icons (nested zip, no extension)
  const validIcons = state.icons.filter((ic) => ic.pkg && ic.image);
  if (validIcons.length) {
    const bytes = await innerZip(JSZip, async (z) => {
      for (const ic of validIcons) {
        const png = await image.encodePngSquare(ic.image, ICON_SIZE, "contain");
        z.file(`${ic.pkg}.png`, png);
        if (ic.fancy && ic.fancy.elements && ic.fancy.elements.length) {
          z.file(`fancy_icons/${ic.pkg}/manifest.xml`, xml.fancyIconManifest(ic.fancy));
          for (const asset of ic.fancy.assets || []) {
            z.file(`fancy_icons/${ic.pkg}/${asset.name}`, asset.blob);
          }
        }
      }
    });
    outer.file("icons", bytes, { compression: "STORE" });
  }
  onProgress("icons");

  // 4. lockscreen/advance (MAML) — plain folder entries, not a nested zip
  if (state.lockscreen.mode === "maml" && state.lockscreen.maml.elements.length) {
    outer.file("lockscreen/advance/manifest.xml", xml.lockscreenManifest(state.lockscreen.maml));
    for (const asset of state.lockscreen.maml.assets || []) {
      outer.file(`lockscreen/advance/${asset.name}`, asset.blob);
    }
  }
  onProgress("lockscreen");

  // 5. boots/bootanimation.zip (nested zip, STORED)
  const bootHasFrames = state.boot.parts.some((p) => p.frames.length);
  if (bootHasFrames) {
    const bytes = await boot.assembleBootZip(state.boot, { JSZip });
    outer.file("boots/bootanimation.zip", bytes, { compression: "STORE" });
  }
  onProgress("boot");

  // 6. system package overlays (each a nested zip named after the package)
  for (const pkg of state.packages) {
    if (packages.isEmptyPackage(pkg)) continue;
    const bytes = await innerZip(JSZip, async (z) => {
      const hasValues =
        (pkg.colors || []).some((c) => c.name) || (pkg.integers || []).some((i) => i.name);
      if (hasValues) z.file("theme_values.xml", xml.themeValues(pkg));
      for (const d of pkg.drawables || []) {
        if (d.blob && d.name) z.file(`${d.density || "drawable-xxhdpi"}/${d.name}.png`, d.blob);
      }
    });
    outer.file(pkg.name, bytes, { compression: "STORE" });
  }
  onProgress("packages");

  // 7. fonts
  for (const f of state.fonts) {
    if (f.blob) outer.file(`fonts/${f.name}`, f.blob, { compression: "STORE" });
  }
  onProgress("fonts");

  // 8. previews
  if (state.previews.thumbnail) {
    outer.file("preview/thumbnail.jpg", state.previews.thumbnail.blob);
  }
  for (const p of state.previews.images || []) {
    if (p.blob) outer.file(`preview/${p.name}`, p.blob);
  }
  onProgress("previews");

  // 9. re-emit anything we imported but don't model
  for (const entry of state.passthrough || []) {
    if (entry.blob && entry.path) outer.file(entry.path, entry.blob, { compression: "STORE" });
  }

  const blob = await outer.generateAsync({ type: "blob", mimeType: "application/octet-stream" });
  onProgress("done");
  return { blob };
}
