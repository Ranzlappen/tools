# MIUI Theme Studio

> Build and edit MIUI / HyperOS themes for the Xiaomi 14T Pro in your browser, then download a ready-to-install `.mtz`.

## What it does

A MIUI `.mtz` theme is just a ZIP with a fixed internal layout, and on
HyperOS / MIUI 14 (what the 14T Pro runs) unsigned themes install fine
through the Themes app or file manager. This tool lets you assemble one
visually — wallpapers, an icon pack, custom fonts, a boot animation,
system-UI color/drawable overrides, and animated MAML overlays — preview it
on a phone-shaped canvas, and export the finished `.mtz`. You can also import
an existing `.mtz`, edit it, and re-export. Everything runs locally; nothing
is uploaded.

## User guide

### Features

- **Metadata** — title, designer, author, version and `uiVersion` (defaults
  to 14 for HyperOS / MIUI 14) written into `description.xml`.
- **Wallpaper** — home and lockscreen wallpapers, re-encoded to the device
  resolution (1220×2712) with a cover/contain fit.
- **Lockscreen** — static wallpaper, or an animated MAML lockscreen with
  clock / date / image / unlocker overlays.
- **Icons** — an icon pack mapping package names to PNGs (re-encoded to
  192×192). Drop a batch of PNGs named after packages, pick from presets, or
  add packages by hand. Optionally make an icon an animated "fancy" icon.
- **Fonts** — pick from a curated set of open-license Google Fonts or search
  for any family (fetched as a real `.ttf` and embedded), or upload your own
  `.ttf`. All preview live.
- **Boot animation** — group PNG frames into parts and set width/height/FPS,
  or **sample frames from a video** in the browser; packaged as a standard
  `bootanimation.zip` with a generated `desc.txt`.
- **System colors / drawables** — override `theme_values.xml` colors and
  replace drawable PNGs for `com.android.systemui`, `framework-res`,
  `com.miui.home` and any other package.
- **Previews** — auto-generate the `preview/` images and `thumbnail.jpg`
  straight from the canvas.
- **Import / export** — round-trip an existing `.mtz`; download the built one.

### How to use it

1. Fill in the **Metadata** (the title is the only required field).
2. Add components from the left panel — upload wallpapers, drop icon PNGs,
   add a font, build a boot animation, set system colors.
3. Switch the center **view tabs** (Home / Lockscreen / Boot / System Colors)
   to preview each part on the phone canvas.
4. Optionally click **Generate from canvas** under *Previews*.
5. Click **Build & download .mtz**.
6. Copy the `.mtz` to your phone and open it with the Themes app or file
   manager to apply it.

To edit an existing theme, click **Import .mtz**, make your changes, and build
again.

### Examples

- **Wallpaper-only theme**: set a title, upload a home wallpaper, Build. The
  result is a minimal valid `.mtz` containing `description.xml` and
  `wallpaper/default_wallpaper.jpg`.
- **Icon pack**: drop a folder of PNGs named `com.android.chrome.png`,
  `com.whatsapp.png`, … — each becomes an entry in the `icons` archive.
- **Animated lockscreen**: switch Lockscreen to *Animated (MAML)*, add a
  **Time** and a **DateTime** overlay, position them in the inspector.

### Privacy

Pure client-side. Files you add are read and packaged in your browser with
the Canvas API and JSZip; nothing is uploaded. The only outbound requests the
page makes are for JSZip (loaded from a pinned CDN on first build/import) and
the in-app help modal you are reading now.

## Developer guide

### File layout

- `index.html` — head, three-pane editor shell, the phone canvas, and inline
  `.mt-`-prefixed styling.
- `tool.js` — state, the canvas render loop, delegated event handling, the
  option panels, and lazy loaders for JSZip + the exporters.
- `lib/mtz-spec.js` — device dimensions, known package names, preset apps,
  color presets, size caps.
- `lib/state.js` — `defaultState()`, `validate()`, `slugify()`, color
  normalisation.
- `lib/image.js` — decode / resize (cover/contain) / re-encode via Canvas2D.
- `lib/xml.js` — build and parse `description.xml`, `theme_values.xml` and the
  MAML manifests (DOMParser for parsing).
- `lib/maml.js` — element-type registry driving the MAML inspector.
- `lib/fonts.js` + `lib/font-catalog.js` — curated Google Fonts and runtime
  resolution of any family to a real `.ttf` via jsDelivr.
- `lib/boot.js` — assemble / parse `bootanimation.zip` and `desc.txt`.
- `lib/packages.js` — system-package (overlay) model helpers.
- `lib/preview-canvas.js` — pure compositor (`drawHome` / `drawLock` /
  `drawColors` / `drawBoot`), shared by the live canvas and the PNG exporter.
- `exporters/build-mtz.js` — assemble the outer ZIP and all nested ZIPs.
- `exporters/parse-mtz.js` — unpack a `.mtz`, recursing nested ZIPs, into state.
- `exporters/previews.js` — render the canvas views to `preview/*` PNGs.

### Key DOM hooks

| Selector | Role |
| --- | --- |
| `#mt-editor` | Editor root; all clicks/inputs are delegated from here. |
| `#mt-canvas` / `#mt-phone` | Preview canvas inside the phone frame. |
| `[data-view]` | Preview view tabs (home/lock/boot/colors). |
| `[data-meta]` | Metadata inputs bound to `state.meta`. |
| `[data-action]` | Every button action (add/remove/build/import/…). |
| `#mt-inspector` | Context editor for the selected MAML / fancy element. |
| `#mt-validation` | Live `validate()` readout; disables Build on errors. |
| `#mt-build` | Build & download the `.mtz`. |

### Dependencies

Only **JSZip** (`jszip@3.10.1`, pinned + SRI), lazy-loaded from jsDelivr on the
first build or import. Everything else is native: Canvas2D for image
resize/encode, `DOMParser` for XML, and `FontFace` for `.ttf` preview. The
README modal additionally uses marked + DOMPurify via the shared
`info-modal.js`.

### Extending

- **New system overlay**: add the package name to `KNOWN_PACKAGES` (and color
  hints to `COLOR_PRESETS`) in `lib/mtz-spec.js`.
- **New MAML element**: add it to `LOCKSCREEN_TYPES` / `FANCY_TYPES` in
  `lib/maml.js`; the inspector and XML builder pick it up automatically.
- **New component**: model it in `lib/state.js`, render a section in
  `index.html` + `tool.js`, and emit it in `exporters/build-mtz.js` (parse it
  back in `exporters/parse-mtz.js`).

### Limitations / gotchas

- **No APK-level theming.** Re-skinning *compiled* system UI (layout
  restructures, compiled vector shapes) needs decompiling Xiaomi's APKs with
  `apktool`/`aapt2` + a JDK — impossible in a browser and generally requiring
  root to install. This tool stays in the unsigned-`.mtz` overlay lane:
  asset replacement + `theme_values.xml` overrides.
- **MAML is version-sensitive.** Generated manifests are conservative;
  treat animated lockscreens / fancy icons as best-effort and test on device.
- **Overlay names vary by build.** Unknown `theme_values` color / drawable
  names are silently ignored by HyperOS — the editor warns but doesn't block.
- **Themes are unsigned.** Some regional builds restrict third-party themes;
  if applying fails, that's a device policy, not a malformed package.
- Imported entries the tool doesn't model are preserved verbatim and
  re-emitted on build, so editing a complex theme won't drop unknown files.
- **Not bakeable into a `.mtz`** (system features, not theme components):
  video / live wallpapers (set via Gallery / Super Wallpaper), the lockscreen
  wallpaper *carousel* (a server-fed feed), and gyro/parallax "Super
  Wallpapers" (separate APKs). Video support here is limited to sampling a
  clip into boot-animation frames.
- Google-Fonts picks are fetched at build/preview time from jsDelivr's mirror
  of the open-source `google/fonts` repo, so adding a predefined font needs a
  network connection (uploading your own `.ttf` does not).
