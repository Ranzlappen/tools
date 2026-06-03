// yt-oauth.js — optional Google sign-in + YouTube Data API (read-only).
//
// Everything here runs in the browser. We use Google Identity Services' OAuth
// *token* flow (no client secret, no backend). The access token lives in
// memory only — it is never written to storage and never sent anywhere but
// Google's own APIs. Sign-in is entirely optional; the rest of the tool works
// without it.
//
// ── Owner setup (one-time) ────────────────────────────────────────────────
// 1. Google Cloud Console → new project → enable "YouTube Data API v3".
// 2. OAuth consent screen (External) → add scope
//    .../auth/youtube.readonly → add yourself as a Test user.
// 3. Credentials → Create OAuth client ID → "Web application" → add this
//    site to "Authorized JavaScript origins"
//    (https://tools.ranzlappen.com and, for local testing,
//    http://localhost:8000).
// 4. Paste the client ID below. It is a *public* identifier — safe to commit;
//    the authorized-origins list is what locks it to this domain.
// See the tool README's "Sign in with Google" section for the full walk-through.

export const CLIENT_ID = "1071710322088-rmvkbcathl8a9jnv21fhs3bvha4lsmgl.apps.googleusercontent.com";

const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/youtube/v3";

// True once a real-looking client ID has been pasted in.
export const isConfigured = () =>
  /\.apps\.googleusercontent\.com$/.test(CLIENT_ID.trim());

let gisPromise = null;
function ensureGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Google sign-in."));
    document.head.appendChild(s);
  });
  return gisPromise;
}

let accessToken = null;
let tokenClient = null;

export const signedIn = () => !!accessToken;

// Opens the Google popup and resolves once we hold an access token.
export async function signIn() {
  if (!isConfigured()) throw new Error("not-configured");
  await ensureGis();
  return new Promise((resolve, reject) => {
    const cb = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      accessToken = resp.access_token;
      resolve();
    };
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID.trim(),
        scope: SCOPE,
        callback: cb,
        error_callback: (err) => reject(new Error(err?.type || "popup-failed")),
      });
    } else {
      tokenClient.callback = cb;
    }
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  });
}

export function signOut() {
  const t = accessToken;
  accessToken = null;
  if (t && window.google?.accounts?.oauth2) {
    try { google.accounts.oauth2.revoke(t); } catch { /* best-effort */ }
  }
}

async function api(path) {
  if (!accessToken) throw new Error("not-signed-in");
  const res = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) { accessToken = null; throw new Error("expired"); }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* keep msg */ }
    throw new Error(msg);
  }
  return res.json();
}

// The signed-in user's auto-playlists, e.g. { likes: "LL…", uploads: "UU…" }.
export async function getRelatedPlaylists() {
  const data = await api("channels?part=contentDetails&mine=true");
  return data.items?.[0]?.contentDetails?.relatedPlaylists || {};
}

// The user's own playlists (handles pagination).
export async function listMyPlaylists() {
  const out = [];
  let pageToken = "";
  do {
    const data = await api(
      `playlists?part=snippet,contentDetails&mine=true&maxResults=50` +
      (pageToken ? `&pageToken=${pageToken}` : "")
    );
    for (const it of data.items || []) {
      out.push({
        id: it.id,
        title: it.snippet?.title || it.id,
        count: it.contentDetails?.itemCount ?? null,
      });
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken && out.length < 1000);
  return out;
}

// Every downloadable video in a playlist. Private/deleted entries can't be
// fetched cookie-free, so we skip them and report the count.
// Returns { videos: [{ id, title }], skipped }.
export async function listItems(playlistId, onProgress) {
  const videos = [];
  let skipped = 0;
  let pageToken = "";
  do {
    const data = await api(
      `playlistItems?part=snippet,contentDetails,status` +
      `&playlistId=${encodeURIComponent(playlistId)}&maxResults=50` +
      (pageToken ? `&pageToken=${pageToken}` : "")
    );
    for (const it of data.items || []) {
      const id = it.contentDetails?.videoId;
      const priv = it.status?.privacyStatus;
      const title = it.snippet?.title || "";
      if (!id || priv === "private" || title === "Deleted video" || title === "Private video") {
        skipped++;
        continue;
      }
      videos.push({ id, title });
    }
    pageToken = data.nextPageToken || "";
    onProgress?.(videos.length, skipped);
  } while (pageToken && videos.length < 5000);
  return { videos, skipped };
}
