/* download.js — trigger a client-side file download from a Blob or string.
   Isolated in its own minimal module on purpose: CodeQL's js/xss-through-dom
   query ("DOM text reinterpreted as HTML") flags the blob: download anchor
   (`a.href = createObjectURL(...)`) as a false positive. A blob: URL carrying
   a `download` attribute is saved, never navigated/reinterpreted, and
   createObjectURL only mints `blob:<origin>/<uuid>` URLs that cannot hold a
   `javascript:` scheme. The query's barrier-guard set does not recognise the
   `new URL(url).protocol === "blob:"` sanitiser below (same finding the repo
   documented for video/tool.js), so this file is path-excluded from CodeQL in
   .github/codeql/codeql-config.yml — kept tiny so that exclusion's blast
   radius is a single utility with no other logic. */

export function safeBlobUrl(url) {
  try { return new URL(url).protocol === "blob:" ? url : ""; }
  catch (_) { return ""; }
}

export function downloadFile(data, name, type = "text/html") {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = safeBlobUrl(url);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
