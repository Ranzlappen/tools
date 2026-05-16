/* UUID & Hash Generator — UUID v4 / v7 + MD5 / SHA-* hashes. */

const $ = (s) => document.querySelector(s);

// ---------- UUID ----------

function uuidV4() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = (i) => b[i].toString(16).padStart(2, "0");
  return (
    h(0) + h(1) + h(2) + h(3) + "-" +
    h(4) + h(5) + "-" +
    h(6) + h(7) + "-" +
    h(8) + h(9) + "-" +
    h(10) + h(11) + h(12) + h(13) + h(14) + h(15)
  );
}

function uuidV7() {
  // Draft RFC 9562 §5.7 — 48-bit Unix-ms timestamp + 74 random bits +
  // version (7) + variant (10).
  const ms = BigInt(Date.now());
  const rand = crypto.getRandomValues(new Uint8Array(10));

  const b = new Uint8Array(16);
  // 48 bits of ms timestamp, big-endian.
  b[0] = Number((ms >> 40n) & 0xffn);
  b[1] = Number((ms >> 32n) & 0xffn);
  b[2] = Number((ms >> 24n) & 0xffn);
  b[3] = Number((ms >> 16n) & 0xffn);
  b[4] = Number((ms >> 8n)  & 0xffn);
  b[5] = Number(ms          & 0xffn);
  for (let i = 0; i < 10; i++) b[6 + i] = rand[i];
  b[6] = (b[6] & 0x0f) | 0x70;     // version 7
  b[8] = (b[8] & 0x3f) | 0x80;     // variant 10

  const h = (i) => b[i].toString(16).padStart(2, "0");
  return (
    h(0) + h(1) + h(2) + h(3) + "-" +
    h(4) + h(5) + "-" +
    h(6) + h(7) + "-" +
    h(8) + h(9) + "-" +
    h(10) + h(11) + h(12) + h(13) + h(14) + h(15)
  );
}

function refreshUuids() {
  $("#uuid-v4").textContent = uuidV4();
  $("#uuid-v7").textContent = uuidV7();
}

// ---------- Hashes ----------

// Tiny public-domain MD5, Joseph Myers — condensed.
// http://www.myersdaily.org/joseph/javascript/md5-text.html
function md5(str) {
  function add32(a, b) { return (a + b) & 0xffffffff; }
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function md5cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0],  7,  -680876936);
    d = ff(d, a, b, c, k[1],  12, -389564586);
    c = ff(c, d, a, b, k[2],  17,  606105819);
    b = ff(b, c, d, a, k[3],  22, -1044525330);
    a = ff(a, b, c, d, k[4],  7,  -176418897);
    d = ff(d, a, b, c, k[5],  12,  1200080426);
    c = ff(c, d, a, b, k[6],  17, -1473231341);
    b = ff(b, c, d, a, k[7],  22, -45705983);
    a = ff(a, b, c, d, k[8],  7,   1770035416);
    d = ff(d, a, b, c, k[9],  12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7,   1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22,  1236535329);

    a = gg(a, b, c, d, k[1],  5,  -165796510);
    d = gg(d, a, b, c, k[6],  9,  -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0],  20, -373897302);
    a = gg(a, b, c, d, k[5],  5,  -701558691);
    d = gg(d, a, b, c, k[10], 9,   38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4],  20, -405537848);
    a = gg(a, b, c, d, k[9],  5,   568446438);
    d = gg(d, a, b, c, k[14], 9,  -1019803690);
    c = gg(c, d, a, b, k[3],  14, -187363961);
    b = gg(b, c, d, a, k[8],  20,  1163531501);
    a = gg(a, b, c, d, k[13], 5,  -1444681467);
    d = gg(d, a, b, c, k[2],  9,  -51403784);
    c = gg(c, d, a, b, k[7],  14,  1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5],  4,  -378558);
    d = hh(d, a, b, c, k[8],  11, -2022574463);
    c = hh(c, d, a, b, k[11], 16,  1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1],  4,  -1530992060);
    d = hh(d, a, b, c, k[4],  11,  1272893353);
    c = hh(c, d, a, b, k[7],  16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4,   681279174);
    d = hh(d, a, b, c, k[0],  11, -358537222);
    c = hh(c, d, a, b, k[3],  16, -722521979);
    b = hh(b, c, d, a, k[6],  23,  76029189);
    a = hh(a, b, c, d, k[9],  4,  -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16,  530742520);
    b = hh(b, c, d, a, k[2],  23, -995338651);

    a = ii(a, b, c, d, k[0],  6,  -198630844);
    d = ii(d, a, b, c, k[7],  10,  1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5],  21, -57434055);
    a = ii(a, b, c, d, k[12], 6,   1700485571);
    d = ii(d, a, b, c, k[3],  10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1],  21, -2054922799);
    a = ii(a, b, c, d, k[8],  6,   1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6],  15, -1560198380);
    b = ii(b, c, d, a, k[13], 21,  1309151649);
    a = ii(a, b, c, d, k[4],  6,  -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2],  15,  718787259);
    b = ii(b, c, d, a, k[9],  21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }
  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] =
        s.charCodeAt(i) +
        (s.charCodeAt(i + 1) << 8) +
        (s.charCodeAt(i + 2) << 16) +
        (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  // Work on UTF-8 bytes so non-ASCII hashes match standard implementations.
  const bytes = new TextEncoder().encode(str);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);

  const n = s.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i;
  for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
  s = s.substring(i - 64);
  const tail = new Array(16).fill(0);
  for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    md5cycle(state, tail);
    for (i = 0; i < 16; i++) tail[i] = 0;
  }
  tail[14] = n * 8;
  md5cycle(state, tail);
  const rhex = (n2) => {
    let s2 = "";
    for (let j = 0; j < 4; j++) {
      s2 += ((n2 >> (j * 8 + 4)) & 0x0f).toString(16) +
            ((n2 >> (j * 8))     & 0x0f).toString(16);
    }
    return s2;
  };
  return rhex(state[0]) + rhex(state[1]) + rhex(state[2]) + rhex(state[3]);
}

async function digestHex(algo, str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest(algo, buf);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function updateHashes(text) {
  $("#h-md5").textContent = text === "" ? "—" : md5(text);
  if (text === "") {
    ["h-sha1", "h-sha256", "h-sha384", "h-sha512"].forEach(
      (id) => ($("#" + id).textContent = "—")
    );
    return;
  }
  const [h1, h256, h384, h512] = await Promise.all([
    digestHex("SHA-1", text),
    digestHex("SHA-256", text),
    digestHex("SHA-384", text),
    digestHex("SHA-512", text),
  ]);
  $("#h-sha1").textContent = h1;
  $("#h-sha256").textContent = h256;
  $("#h-sha384").textContent = h384;
  $("#h-sha512").textContent = h512;
}

let hashT = 0;
$("#hash-in").addEventListener("input", (e) => {
  clearTimeout(hashT);
  hashT = setTimeout(() => updateHashes(e.target.value), 150);
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (btn) {
    const a = btn.dataset.action;
    if (a === "uuid-v4") $("#uuid-v4").textContent = uuidV4();
    else if (a === "uuid-v7") $("#uuid-v7").textContent = uuidV7();
    else if (a === "uuid-batch") {
      const n = Math.max(1, Math.min(100, parseInt($("#uuid-count").value, 10) || 10));
      const v = $("#uuid-version").value;
      const fn = v === "v7" ? uuidV7 : uuidV4;
      const out = [];
      for (let i = 0; i < n; i++) out.push(fn());
      $("#uuid-batch-out").value = out.join("\n");
    }
  }
  const copy = e.target.closest("[data-copy-from]");
  if (copy) {
    const v = ($("#" + copy.dataset.copyFrom).textContent || "").trim();
    if (v && v !== "—") {
      navigator.clipboard.writeText(v).catch(() => {});
      const orig = copy.textContent;
      copy.textContent = "✓";
      setTimeout(() => (copy.textContent = orig), 900);
    }
  }
});

refreshUuids();
updateHashes("");
