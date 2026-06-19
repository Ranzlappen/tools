/* Regex Tester & Builder — predefined snippet library.

   Grouped, click-to-insert patterns. Each entry is a plain RegExp *source*
   string (no delimiters). An optional `flags` field carries the recommended
   flag set for that pattern (e.g. "m" for line anchors, "u" for codepoint
   escapes); when present it replaces the active flags on insert, otherwise
   the current flags are left untouched.

   Patterns are written with String.raw so backslashes stay single — what you
   read here is exactly what the engine compiles. They aim for "good enough to
   reach for", not RFC-perfect; tighten in the field as needed. */

export const SNIPPET_GROUPS = [
  {
    group: "Web & network",
    items: [
      { name: "Email", pattern: String.raw`\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b` },
      { name: "URL (http/https)", pattern: String.raw`https?:\/\/[\w.-]+(?:\.[A-Za-z]{2,})+(?:[/?#][^\s]*)?` },
      { name: "URL (any scheme)", pattern: String.raw`\b[a-z][a-z0-9+.-]*:\/\/[^\s/$.?#][^\s]*`, flags: "gi" },
      { name: "Domain name", pattern: String.raw`\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b`, flags: "gi" },
      { name: "IPv4", pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b` },
      { name: "IPv4 CIDR", pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\/(?:3[0-2]|[12]?\d)\b` },
      { name: "IPv6 (loose)", pattern: String.raw`\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b` },
      { name: "Port (1–65535)", pattern: String.raw`\b(?:6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3})\b` },
      { name: "MAC address", pattern: String.raw`\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b` },
      { name: "URL slug", pattern: String.raw`\b[a-z0-9]+(?:-[a-z0-9]+)*\b` },
      { name: "data: URI", pattern: String.raw`data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+` },
      { name: "Hashtag", pattern: String.raw`(?:^|\s)(#[A-Za-z0-9_]+)`, flags: "gm" },
      { name: "@mention", pattern: String.raw`(?:^|\s)(@[A-Za-z0-9_]+)`, flags: "gm" },
    ],
  },
  {
    group: "Dates & times",
    items: [
      { name: "ISO 8601 datetime", pattern: String.raw`\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b` },
      { name: "ISO date", pattern: String.raw`\b\d{4}-\d{2}-\d{2}\b` },
      { name: "Time (24h)", pattern: String.raw`\b(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b` },
      { name: "Time (12h am/pm)", pattern: String.raw`\b(?:0?[1-9]|1[0-2]):[0-5]\d\s?[AaPp][Mm]\b` },
      { name: "US date (M/D/Y)", pattern: String.raw`\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/\d{4}\b` },
      { name: "EU date (D/M/Y)", pattern: String.raw`\b(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/\d{4}\b` },
      { name: "Year (19xx–20xx)", pattern: String.raw`\b(?:19|20)\d{2}\b` },
      { name: "Unix timestamp (10-digit)", pattern: String.raw`\b\d{10}\b` },
      { name: "ISO 8601 duration", pattern: String.raw`\bP(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?\b` },
      { name: "Month name", pattern: String.raw`\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b`, flags: "gi" },
      { name: "Day name", pattern: String.raw`\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b`, flags: "gi" },
    ],
  },
  {
    group: "Numbers",
    items: [
      { name: "Integer", pattern: String.raw`\b\d+\b` },
      { name: "Signed integer", pattern: String.raw`[-+]?\d+` },
      { name: "Decimal", pattern: String.raw`[-+]?\d*\.\d+` },
      { name: "Number (int or float)", pattern: String.raw`[-+]?\d+(?:\.\d+)?` },
      { name: "Scientific notation", pattern: String.raw`[-+]?\d+(?:\.\d+)?[eE][-+]?\d+` },
      { name: "Currency (USD)", pattern: String.raw`\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?` },
      { name: "Percentage", pattern: String.raw`\b\d+(?:\.\d+)?%` },
      { name: "Thousands-separated", pattern: String.raw`\b\d{1,3}(?:,\d{3})+\b` },
      { name: "Hex number", pattern: String.raw`\b0[xX][0-9a-fA-F]+\b` },
      { name: "Binary number", pattern: String.raw`\b0[bB][01]+\b` },
      { name: "Octal number", pattern: String.raw`\b0[oO][0-7]+\b` },
      { name: "Roman numerals", pattern: String.raw`\b(?=[MDCLXVI])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})\b` },
      { name: "Byte (0–255)", pattern: String.raw`\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b` },
    ],
  },
  {
    group: "IDs & codes",
    items: [
      { name: "UUID v4", pattern: String.raw`\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b` },
      { name: "UUID (any)", pattern: String.raw`\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b` },
      { name: "Semver", pattern: String.raw`\bv?\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?\b` },
      { name: "Git SHA (full)", pattern: String.raw`\b[0-9a-f]{40}\b` },
      { name: "Git SHA (short)", pattern: String.raw`\b[0-9a-f]{7,40}\b` },
      { name: "Mongo ObjectId", pattern: String.raw`\b[0-9a-fA-F]{24}\b` },
      { name: "JWT", pattern: String.raw`\beyJ[\w-]+\.[\w-]+\.[\w-]+\b` },
      { name: "Base64", pattern: String.raw`(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})` },
      { name: "Base64URL token", pattern: String.raw`[A-Za-z0-9_-]{16,}` },
      { name: "Hex color", pattern: String.raw`#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b` },
      { name: "rgb()/rgba()", pattern: String.raw`rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)`, flags: "gi" },
      { name: "hsl()/hsla()", pattern: String.raw`hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)`, flags: "gi" },
      { name: "ISBN-10", pattern: String.raw`\b(?:\d[ -]?){9}[\dXx]\b` },
      { name: "ISBN-13", pattern: String.raw`\b97[89][ -]?(?:\d[ -]?){9}\d\b` },
      { name: "Credit card (loose)", pattern: String.raw`\b(?:\d[ -]?){13,16}\b` },
      { name: "Visa", pattern: String.raw`\b4\d{12}(?:\d{3})?\b` },
      { name: "Mastercard", pattern: String.raw`\b5[1-5]\d{14}\b` },
      { name: "Amex", pattern: String.raw`\b3[47]\d{13}\b` },
    ],
  },
  {
    group: "Text & markup",
    items: [
      { name: "Word", pattern: String.raw`\b\w+\b` },
      { name: "Whitespace run", pattern: String.raw`\s+` },
      { name: "Trailing whitespace", pattern: String.raw`[ \t]+$`, flags: "gm" },
      { name: "Blank lines", pattern: String.raw`^\s*$`, flags: "gm" },
      { name: "Multiple spaces", pattern: String.raw` {2,}` },
      { name: "Duplicate word", pattern: String.raw`\b(\w+)\s+\1\b`, flags: "gi" },
      { name: "Repeated char (3+)", pattern: String.raw`(.)\1{2,}` },
      { name: "Non-ASCII", pattern: String.raw`[^\x00-\x7F]+` },
      { name: "Emoji (basic)", pattern: String.raw`[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]`, flags: "gu" },
      { name: "HTML tag", pattern: String.raw`<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?>` },
      { name: "HTML comment", pattern: String.raw`<!--[\s\S]*?-->` },
      { name: "Double-quoted string", pattern: String.raw`"([^"\\]*(?:\\.[^"\\]*)*)"` },
      { name: "Single-quoted string", pattern: String.raw`'([^'\\]*(?:\\.[^'\\]*)*)'` },
      { name: "Markdown link", pattern: String.raw`\[([^\]]+)\]\(([^)]+)\)` },
      { name: "Markdown heading", pattern: String.raw`^#{1,6}\s+.+$`, flags: "gm" },
      { name: "Markdown bold", pattern: String.raw`\*\*([^*]+)\*\*` },
      { name: "camelCase", pattern: String.raw`\b[a-z]+(?:[A-Z][a-z0-9]*)+\b` },
      { name: "PascalCase", pattern: String.raw`\b[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]*)+\b` },
      { name: "snake_case", pattern: String.raw`\b[a-z]+(?:_[a-z0-9]+)+\b` },
      { name: "CONSTANT_CASE", pattern: String.raw`\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b` },
    ],
  },
  {
    group: "Files & paths",
    items: [
      { name: "File extension", pattern: String.raw`\.[A-Za-z0-9]{1,8}\b` },
      { name: "Filename + ext", pattern: String.raw`[^\\/]+\.[A-Za-z0-9]{1,8}$`, flags: "gm" },
      { name: "Image file", pattern: String.raw`\b[\w-]+\.(?:png|jpe?g|gif|webp|svg|bmp|tiff?|avif)\b`, flags: "gi" },
      { name: "Windows path", pattern: String.raw`[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\?)*` },
      { name: "Unix path", pattern: String.raw`(?:\/[^\/\0]+)+\/?` },
      { name: "Dotfile", pattern: String.raw`(?:^|\/)\.[\w.-]+`, flags: "gm" },
    ],
  },
  {
    group: "Programming",
    items: [
      { name: "TODO / FIXME", pattern: String.raw`\b(?:TODO|FIXME|HACK|XXX|NOTE)\b`, flags: "gi" },
      { name: "Line comment (//)", pattern: String.raw`\/\/.*$`, flags: "gm" },
      { name: "Block comment (/* */)", pattern: String.raw`\/\*[\s\S]*?\*\/` },
      { name: "console.* call", pattern: String.raw`console\.(?:log|warn|error|info|debug)\s*\(` },
      { name: "JS function decl", pattern: String.raw`\bfunction\s+([A-Za-z_$][\w$]*)\s*\(` },
      { name: "ES import", pattern: String.raw`\bimport\s+.+?\s+from\s+['"][^'"]+['"]` },
      { name: "Env var ($VAR / ${VAR})", pattern: String.raw`\$\{?[A-Za-z_][A-Za-z0-9_]*\}?` },
      { name: "Hex escape (\\xNN)", pattern: String.raw`\\x[0-9A-Fa-f]{2}` },
    ],
  },
  {
    group: "Validation & locale",
    items: [
      { name: "US ZIP", pattern: String.raw`\b\d{5}(?:-\d{4})?\b` },
      { name: "US phone", pattern: String.raw`\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b` },
      { name: "Intl phone (loose)", pattern: String.raw`\+?\d[\d\s().-]{7,}\d` },
      { name: "US SSN", pattern: String.raw`\b\d{3}-\d{2}-\d{4}\b` },
      { name: "UK postcode", pattern: String.raw`\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b`, flags: "gi" },
      { name: "Lat,Long", pattern: String.raw`[-+]?\d{1,2}(?:\.\d+)?\s*,\s*[-+]?\d{1,3}(?:\.\d+)?` },
      { name: "Username (3–16)", pattern: String.raw`^[A-Za-z0-9_]{3,16}$`, flags: "m" },
      { name: "Strong password", pattern: String.raw`^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$`, flags: "m" },
    ],
  },
];
