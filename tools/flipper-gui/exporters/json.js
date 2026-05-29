/* JSON exporter — round-trippable spec for the editor.
 *
 * This sidecar is the source of truth for a Studio-generated C app: the FAM
 * and scene are fully recoverable from it (the exporters read only state.app,
 * screens, icons), so the committed `<appid>.flipper-gui.json` is what the
 * Flipper repo's regen-check byte-diffs against. The filename is derived from
 * appMeta so it always matches the folder/appid the rest of the bundle uses.
 */

import { appMeta } from "./fam.js";

export function exportJson(state) {
  const out = {
    schema: "flipper-gui/v1",
    v: state.v,
    app: state.app,
    screens: state.screens.map((s) => ({
      id: s.id,
      name: s.name,
      widgets: s.widgets,
    })),
    icons: state.icons,
  };
  return {
    filename: `${appMeta(state).appid}.flipper-gui.json`,
    text: JSON.stringify(out, null, 2),
  };
}
