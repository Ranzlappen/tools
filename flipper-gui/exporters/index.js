/* Stable, DOM-free export surface for headless consumers.
 *
 * This is the entry point the Flipper repo (Ranzlappen/flipper) vendors and
 * imports for its `regen-check` CI gate: it parses each committed
 * `<appid>.flipper-gui.json`, regenerates the FAM + scene with these
 * exporters, and byte-diffs them against the committed files. None of the
 * modules re-exported here touch `document`/`window`/`canvas` at import time
 * or at call time — the only font dependency is `measureText` (pure data +
 * `atob`, used for button-label centering); the canvas-using `blitText` is
 * never reached by the exporters.
 *
 * Determinism contract: button-label centering depends on real glyph
 * advances, which load asynchronously. Call `await preloadFonts()` ONCE
 * before `exportScene` for byte-identical output; otherwise the metric-table
 * fallback may shift a label by a pixel.
 *
 *   import { preloadFonts, exportFam, exportScene, exportJson, appMeta }
 *     from "./vendor/flipper-gui/exporters/index.js";
 *   await preloadFonts();
 *   const state = JSON.parse(read("my_app.flipper-gui.json"));
 *   const fam = exportFam(state);          // { filename, text }
 *   const [h, c] = exportScene(state);     // [{filename,text}, {filename,text}]
 *   const json = exportJson(state);        // canonical re-serialization
 *   const meta = appMeta(state);           // { ns, appid, folder, entry, … }
 */

export { exportFam, appMeta, hasReferencedIcons, FAP_CATEGORIES } from "./fam.js";
export { exportScene, safeNs, pascal } from "./scene.js";
export { exportEntry } from "./entry.js";
export { exportJson } from "./json.js";
export { preloadFonts, measureText } from "../lib/font-render.js";
