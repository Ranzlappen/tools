# Color Picker

> Pick a color, see every format, check WCAG contrast against any partner.

## What it does

Pick a foreground colour and the tool converts it into **HEX**, **RGB**,
**HSL**, **HSV**, and **OKLCH** simultaneously. Pick a background colour
and it shows the WCAG contrast ratio with pass/fail badges for the four
common tier+size combinations. Conversion happens locally — no network.

## User guide

### Features

- Native colour picker plus an editable HEX text input, kept in sync.
- Five output formats with per-row **Copy** buttons:
  - `HEX` — `#rrggbb`
  - `RGB` — `rgb(r, g, b)` with 0–255 channels
  - `HSL` — `hsl(h, s%, l%)`
  - `HSV` — `hsv(h, s%, v%)`
  - `OKLCH` — `oklch(L% C H)`, perceptually uniform (Björn Ottosson)
- Contrast panel with:
  - A preview tile showing large text + body text in the chosen colours.
  - The ratio expressed as `n.nn : 1`.
  - Four badges — **AA normal**, **AA large**, **AAA normal**,
    **AAA large** — green when the ratio meets the threshold.

### How to use it

1. Click the foreground colour swatch (or type a HEX) to change colour.
2. Read off the conversion you need on the right; click **Copy**.
3. Click the smaller swatch in the **Contrast check** panel to set the
   background and watch the ratio + badges update live.

### Examples

Foreground `#4ade80`, background `#0b1210` →

```
HEX    #4ade80
RGB    rgb(74, 222, 128)
HSL    hsl(142, 69.0%, 58.0%)
HSV    hsv(142, 66.7%, 87.1%)
OKLCH  oklch(82.7% 0.183 145)
```

Contrast ratio: **10.71 : 1** — passes **AA normal**, **AA large**,
**AAA normal**, and **AAA large**.

### Privacy

Pure client-side conversion using the colour-math equations baked into
`tool.js`. No network requests with your colours.

## Developer guide

### File layout

- `index.html` — markup with two `<input type="color">` pickers, a HEX
  text input, the format-row container, and the contrast panel.
- `tool.js` — all conversions + WCAG luminance + DOM rendering.

### Key DOM hooks

| Selector             | Role                                           |
| -------------------- | ---------------------------------------------- |
| `#fg-input`          | Foreground `<input type="color">`.             |
| `#fg-text`           | Foreground HEX text input.                     |
| `#fg-preview`        | Square swatch reflecting the current colour.   |
| `#fg-formats`        | Container that receives `.format-row` rows.    |
| `#bg-input`          | Background `<input type="color">`.             |
| `#contrast-preview`  | Preview tile (text on background).             |
| `#contrast-ratio`    | Numeric ratio display.                         |
| `#contrast-badges`   | Container that receives `.badge` chips.        |
| `[data-copy="…"]`    | Per-row clipboard copy button.                 |

### Dependencies

Vanilla JS only. No external libraries.

### Extending

- **Add a new format**: write a converter (`rgb → <newFormat>`) in
  `tool.js`, then push another `makeFormatRow(label, value)` inside
  `render()`. Roughly 5–10 lines per format.
- **Add a colour preset palette**: render a row of swatches above the
  picker and on click call `render(hex)`. The render function already
  handles all the downstream updates.
- **Different contrast standard** (e.g. APCA): replace `contrast()` and
  the `lines` array in `renderContrast()`.

### Limitations / gotchas

- HEX text input only accepts 3- or 6-digit form (no alpha).
- OKLCH output is `D65` sRGB → OKLab → OKLCH; values for very saturated
  colours may not round-trip through `<input type="color">` (which
  clamps to sRGB).
- Contrast badges use the WCAG 2.x relative-luminance formula. They do
  not account for non-text (graphics) or APCA.
