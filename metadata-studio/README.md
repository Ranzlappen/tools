# Metadata Studio

> Inspect, edit, strip, and extend metadata in any file — EXIF, XMP,
> IPTC, ID3, PDF info, Office core properties, ZIP entries — entirely
> in your browser.

## What it does

Drop any file. Metadata Studio detects the format from its magic bytes,
lazy-loads the right reader, and surfaces every metadata field it can
find — grouped by namespace (EXIF, XMP, IPTC, PDF Info, Core
Properties, App Properties, ID3, SVG, RIFF, …).

You can then:

- **View** every field with its source group and value.
- **Edit** individual values for formats that have a write-back library
  in the browser.
- **Strip all** metadata in one click (or strip individual rows via the
  per-row checkbox).
- **Add custom fields** for formats that accept arbitrary key/value
  pairs (PNG tEXt/iTXt, MP3 TXXX, SVG `<metadata>`).
- **Download** the modified file. Nothing leaves your machine.

## User guide

### Features

- Magic-byte format detection — file extension is hints-only.
- Per-format **recommended fields** marked with **★** at the top of each
  group; rare or vendor-specific tags follow underneath.
- **Capability chip** in the header shows whether the format supports
  `Read + Edit + Strip`, `Read + Strip`, or `Read only`.
- Edits and strips are staged until you click **Apply changes &
  download** — nothing is written to your original file.
- The **Strip all** button writes a one-shot stripped copy without
  affecting your pending edits.
- Custom-field input is hidden for formats that don't support it.
- Every byte stays on your machine.

### Supported formats

| Format | Detect | Read | Edit | Strip | Custom keys |
| --- | --- | --- | --- | --- | --- |
| JPEG (`.jpg/.jpeg`) | FFD8 magic | EXIF (all IFDs) · XMP · IPTC · COM | EXIF | yes (drops EXIF, XMP, IPTC, comments) | no |
| PNG (`.png`) | 8-byte sig | tEXt · iTXt · zTXt · tIME · eXIf | tEXt / iTXt | yes | **yes** |
| GIF (`.gif`) | GIF87a/89a | XMP packet | — | — | — |
| WebP (`.webp`) | RIFF/WEBP | EXIF · XMP · RIFF chunks | — | yes | — |
| TIFF (`.tif/.tiff`) | byte order + 42 | EXIF / IFD0 / GPS | — | — | — |
| HEIC (`.heic/.heif`) | ftyp `heic`/`mif1` | EXIF · XMP | — | — | — |
| SVG (`.svg`) | XML / `<svg` | `<title>` · `<desc>` · `<metadata>` · editor attrs | yes | yes | **yes** |
| PDF (`.pdf`) | `%PDF-` | Info dict (Title, Author, Subject, Keywords, Creator, Producer, dates) | yes | yes | — |
| DOCX/XLSX/PPTX | ZIP + `docProps/` | core.xml + app.xml | yes | yes | — |
| ZIP (`.zip`) | PK header | archive comment + per-entry timestamps & comments | yes | yes | — |
| MP3 (`.mp3`) | `ID3` or sync | ID3v2 (common + native frames) | yes (TIT2, TPE1, TALB, …) | yes (drops ID3v2) | **yes** (TXXX) |
| WAV (`.wav`) | RIFF/WAVE | LIST/INFO · ID3 | — | yes | — |
| FLAC (`.flac`) | `fLaC` | Vorbis comments | — | — | — |
| OGG (`.ogg`) | `OggS` | Vorbis comments | — | — | — |
| MP4/MOV/M4A | ftyp | iTunes / udta / meta | — | — | — |
| Anything else | fallback | file size + first-bytes hex/ASCII | — | — | — |

### Recommended (common) fields per format

The "★" marker appears next to keys most people actually care about.
This is what shows up first inside each group.

| Format | Common fields |
| --- | --- |
| JPEG | `Make`, `Model`, `Software`, `DateTimeOriginal`, `DateTime`, `Orientation`, `Artist`, `Copyright`, `ImageDescription`, `UserComment`, `GPSLatitude`, `GPSLongitude`, `GPSAltitude`, `dc:title`, `dc:creator`, `dc:subject`, `dc:rights` |
| PNG | `Title`, `Author`, `Description`, `Copyright`, `Creation Time`, `Software`, `Comment`, `parameters` (Stable Diffusion), `prompt`, `workflow` (ComfyUI) |
| WebP | `Make`, `Model`, `Software`, `DateTime`, `Artist`, `Copyright` |
| TIFF | `Make`, `Model`, `Software`, `DateTime`, `Artist`, `Copyright`, `ImageDescription`, `Orientation` |
| HEIC | EXIF + XMP (same as JPEG) — read-only |
| SVG | `title`, `desc`, `dc:title`, `dc:creator`, `dc:rights`, `dc:date`, `cc:license` |
| PDF | `Title`, `Author`, `Subject`, `Keywords`, `Creator`, `Producer`, `CreationDate`, `ModificationDate` |
| DOCX / XLSX / PPTX | `dc:title`, `dc:creator`, `dc:subject`, `cp:keywords`, `dc:description`, `cp:lastModifiedBy`, `cp:revision`, `dcterms:created`, `dcterms:modified` |
| ZIP | archive `comment`, per-entry comments |
| MP3 | `title`, `artist`, `album`, `year`, `genre`, `track`, `disc`, `comment`, `composer`, `publisher`, `copyright`, `albumArtist`, plus raw `TIT2`/`TPE1`/`TALB`/… |
| WAV | `INAM`, `IART`, `ICRD`, `ICMT`, `ICOP`, `ISFT` |
| FLAC / OGG | `TITLE`, `ARTIST`, `ALBUM`, `DATE`, `GENRE`, `TRACKNUMBER`, `ALBUMARTIST`, `COMMENT` — read-only |
| MP4 / MOV / M4A | `©nam`, `©ART`, `©alb`, `©day`, `©gen`, `©cmt`, `cprt` — read-only |

### How to use it

1. Drop a file onto the drop zone (or click to choose one).
2. The header shows the detected format and a capability chip.
3. Scroll through the **Metadata** table. Recommended fields appear at
   the top of each group, marked with **★**.
4. Edit any value in-place; tick a row's **Strip** box to remove just
   that field on download.
5. (Optional) Add a custom key/value pair under **Add custom field**.
6. Click **Apply changes & download** — a `<name>_clean.<ext>` copy is
   saved.
7. Or just click **Strip all** to remove all metadata in one shot — the
   download is named `<name>_stripped.<ext>`.

### Examples

- **Remove GPS from a photo.** Drop a JPEG; tick the strip box on every
  `GPS*` row; **Apply**. Or click **Strip all** to drop EXIF, XMP, IPTC,
  and comment segments in one shot.
- **Set a PDF title.** Drop a PDF; edit the `Title` row under PDF Info;
  **Apply**.
- **Tag a Stable Diffusion PNG output.** Drop the PNG; the `parameters`
  field appears (it's the convention SD uses). Edit it or add new
  fields.
- **Clear Office author info.** Drop a DOCX; tick `dc:creator`,
  `cp:lastModifiedBy`, and `cp:revision`; **Apply**.
- **Rewrite MP3 album.** Drop an MP3; edit the `album` row; **Apply**.

### Privacy

Pure client-side. Every byte stays in your browser. Format-specific
libraries (piexifjs, pdf-lib, jszip, browser-id3-writer, exifr,
music-metadata-browser) lazy-load from jsDelivr only after a file is
dropped — and only the libraries needed for that file's format. The
page itself makes zero network calls until then.

## Developer guide

### File layout

- `index.html` — page shell: drop zone, file info, capability chip,
  metadata table, output panel.
- `tool.js` — format detector + handler registry + UI orchestrator. One
  file; sections delimited by `─── … ───` comment dividers.
- `README.md` — this document; rendered by the in-app info modal.

### Architecture

Single ES module. Top-level layout:

1. **CDN** — pinned versions + SRI for every library.
2. **Lazy loaders** — `loadScript` (UMD with SRI) and `loadModule`
   (dynamic ESM `import()`), each idempotent.
3. **Format detection** — `detectFormat(file)` reads the first 64 bytes
   and matches against magic-byte signatures. ZIP-based formats
   (DOCX/XLSX/PPTX) are disambiguated by peeking inside via jszip.
4. **Handler registry** — `HANDLERS` is a map of `format → { label,
   caps, read(file), write(file, ops, raw) }`. `caps` declares whether
   the handler supports `read`, `edit`, `strip`, `custom`.
5. **Recommended fields** — `RECOMMENDED[format]` is a Set of field
   keys to mark with **★** and float to the top of their group.
6. **UI orchestrator** — `onFile()` → detect → handler.read → render.
   `onApply()` → handler.write → download. `onStripAll()` → write with
   `stripAll: true`.

### Handler contract

Every handler exposes:

```js
{
  label: "JPEG image",
  caps: { read, edit, strip, custom },   // booleans
  customHint: "...",                      // shown next to the add form
  async read(file) {
    return {
      groups: [
        { name: "EXIF · 0th", fields: [ field(...), ... ] },
        ...
      ],
      raw: { /* anything the handler wants to remember for write() */ },
    };
  },
  async write(file, ops, raw) {
    // ops = { edits: Map<fieldObj, string>,
    //         stripKeys: Set<fieldObj>,
    //         customFields: [{key, value}],
    //         stripAll: bool }
    return new Blob([...], { type: mime });
  },
}
```

`field(group, key, value, opts)` builds a normalized field record.
`opts.meta` is a free-form object the handler reads later in `write()`
to know which underlying tag/chunk/property the row maps to.

### Key DOM hooks

| Selector | Role |
| --- | --- |
| `#drop` / `#file` | Drop zone + hidden `<input type="file">`. |
| `#file-meta` | File-level summary (name, size, type, detected). |
| `#cap-chip` | Capability chip ("Read + Edit + Strip" etc). |
| `#results-panel` / `#meta-body` | Metadata table. |
| `#action-panel` / `#btn-apply` | Apply changes & download. |
| `#btn-strip-all` | One-shot strip. |
| `#custom-add` / `#btn-add-custom` | Custom field form. |
| `[data-info-button]` | Opens the README in the info modal. |

### Dependencies (all lazy-loaded from jsDelivr)

| Lib | Version | Use | Loader |
| --- | --- | --- | --- |
| piexifjs | 1.0.6 | JPEG EXIF read/write | `<script>` + SRI |
| pdf-lib | 1.17.1 | PDF info dict | `<script>` + SRI |
| jszip | 3.10.1 | ZIP / Office docs | `<script>` + SRI |
| browser-id3-writer | 4.4.0 | MP3 ID3 write | `<script>` + SRI |
| exifr | 7.1.3 | HEIC / TIFF / GIF / WebP read | dynamic ESM `import()` |
| music-metadata-browser | 2.5.10 | FLAC / OGG / MP4 / WAV / MP3 read | dynamic ESM `import()` |

The page itself loads with **none** of these. They're fetched on first
use, per-format.

### PNG chunks

Custom reader/writer (~100 LOC). PNG is a signature + length-prefixed
chunks (`length(4) | type(4) | data | CRC32(4)`). Text chunks come in
three flavours: `tEXt` (Latin-1), `iTXt` (UTF-8 + optional zlib
compression), `zTXt` (zlib-compressed Latin-1). We read all three using
the browser-native `DecompressionStream("deflate")` for the compressed
variants; we write `tEXt` for ASCII and `iTXt` (uncompressed) otherwise.

### Extending

To add a new format:

1. Add a magic-byte branch to `detectFormat()`.
2. Add an entry to `FORMAT_LABEL` (UI label) and `RECOMMENDED` (Set of
   star-marked keys).
3. Implement a handler object satisfying the contract above and
   register it in `HANDLERS`.
4. If the handler needs a new library, add it to `CDN` (with real SRI
   for UMD scripts), expose an `ensureFoo()` loader, and call that
   inside `read()`/`write()`.

### Limitations

- **JPEG XMP / IPTC editing is not yet supported** — only stripping
  them entirely (via Strip all). Per-field editing of XMP fields needs
  a packet-level rewriter we haven't built.
- **WebP / WAV editing is strip-only** — RIFF re-encoding for
  field-level edits would require reconstructing VP8X header flags
  (WebP) or LIST chunk re-assembly (WAV).
- **TIFF / GIF / HEIC are read-only.** No reliable browser library
  writes back to these containers.
- **MP4 / MOV / M4A is read-only.** Atom rewriting would need
  mp4box.js's modification API plus a UI to map iTunes-style tags;
  out of scope for v1.
- **FLAC / OGG is read-only.** Vorbis-comment writing has no
  established browser library.
- **MP3 writing rewrites the ID3v2 tag.** Un-edited common fields are
  preserved (re-emitted from the parsed values); rare native frames
  outside the recommended map may be lost.
- **PDF custom info-dict keys** can't be set via pdf-lib's high-level
  API. Only the standard fields (Title, Author, Subject, Keywords,
  Creator, Producer, CreationDate, ModificationDate) are editable.
- **Office docs** beyond `docProps/core.xml` and `docProps/app.xml`
  (custom-properties, comments, revision history) aren't surfaced yet.
- The drop zone reads files entirely into memory. Very large media
  files (multi-GB) may stress the browser; the tool is tuned for files
  up to ~100 MB.
