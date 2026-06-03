# QR & Barcode Generator

> Every common 1D and 2D symbology, with full design and
> error-correction control. Runs entirely in your browser.

## What it does

Pick a symbology, type a payload, get a barcode. The tool covers ~55
formats — QR, Data Matrix, Aztec, PDF417, MaxiCode, Han Xin, EAN/UPC,
Code 128/39/93/11, GS1-128, GS1 DataBar, ITF, Codabar, USPS Intelligent
Mail / POSTNET / PLANET, Royal Mail, KIX, Australia Post, Japan Post,
Deutsche Post, pharma codes, DotCode, Ultracode, and raw bit patterns.
Render preview is live; export to SVG, PNG (1×/2×/4×), JPG, or PDF.

## User guide

### Features

- **Symbology picker** with a filter input. Pills group the formats so
  you don't scroll through everything.
- **Content presets** auto-format payloads per spec — plain text, URL
  (auto-prefixes `https://`), WiFi (`WIFI:T:…;S:…;P:…;;`), vCard 3.0,
  SMS (`SMSTO:…`), email (`mailto:…?subject=…&body=…`), geo
  (`geo:lat,lon?q=…`), and calendar `BEGIN:VEVENT…`.
- **ECC controls** per symbology — QR (L/M/Q/H chips), PDF417 (0-8
  slider), Aztec (5-95% slider).
- **Module + quiet-zone sliders** for fine layout control.
- **Human-readable text toggle** for 1D barcodes.
- **Design panel (QR only)** via `qr-code-styling`: foreground +
  background colour with synced hex inputs, six module shapes (square,
  dots, rounded, extra-rounded, classy, classy-rounded), three corner
  outer + two corner inner shapes, optional linear gradient with a
  second stop, logo overlay (auto-bumps ECC to Q).
- **Exports** — SVG (vector), PNG at 1×/2×/4×, JPG (flattened),
  PDF (A4 portrait via jsPDF), copy PNG to clipboard, share via Web
  Share API.

### How to use it

1. Filter or scroll to pick a **symbology**.
2. Pick a **content preset** (or leave on *Plain text*).
3. Type or paste into **Payload**. The preview updates live.
4. Tune **ECC**, **module size**, and **quiet zone** if you need to.
5. (QR only) Open the **Design** panel for colours, shapes, gradient,
   or a logo overlay.
6. Pick an export — **SVG / PNG / JPG / PDF / Copy / Share**.

### Privacy

Pure client-side rendering. Payloads, logo uploads, and exports all
stay in your browser. The page lazy-loads `bwip-js`, `qr-code-styling`,
and `jspdf` from a CDN (SHA-384 SRI pinned).

## Developer guide

### File layout

- `index.html` — markup, symbology picker, content-preset selector,
  payload textarea, ECC + size controls, design panel, export row.
- `tool.js` — symbology table (~55 entries), preset formatters, render
  pipeline, export functions. No exports.

### Dependencies

CDN-loaded with SHA-384 SRI:

- `bwip-js@4.5.1` — every non-QR symbology.
- `qr-code-styling@1.6.0-rc.1` — QR rendering + design panel.
- `jspdf@2.5.2` — PDF export.

### Extending

- **Add a symbology:** append to the table in `tool.js`. The picker
  and ECC controls pick up the new entry automatically.
- **Add a content preset:** add a formatter to the preset map and a
  matching `<option>` in `index.html`.
- **Add an export format:** add a button in the export row and a
  handler that reads the rendered SVG/canvas.
- **Logo overlay note:** adding a logo auto-bumps QR error correction
  to level Q so the code still scans with the centre occluded — keep
  that coupling if you touch the logo or ECC handling.

### Limitations

- QR design panel features (gradients, custom shapes, logo) only apply
  to QR codes — every other symbology uses `bwip-js` defaults.
- PDF export uses A4 portrait only.
