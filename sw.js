/* sw.js — hand-written service worker for tools.ranzlappen.com.
   No build step, no Workbox. Bump CACHE_VERSION to invalidate. */
"use strict";

const CACHE_VERSION = "tools-v6";
const PRECACHE = CACHE_VERSION + "-precache";
const RUNTIME = CACHE_VERSION + "-runtime";

// Core app shell — kept small and generic so it serves every page.
// Individual tool pages are intentionally left out; the runtime cache
// captures each one the first time it is visited.
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/assets/css/style.css",
  "/assets/css/tool.css",
  "/assets/css/backdrops.css",
  "/assets/css/cookie-consent.css",
  "/assets/js/main.js",
  "/assets/icon.png",
  "/icons/favicon.ico",
  "/icons/favicon-16x16.png",
  "/icons/favicon-32x32.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/site.webmanifest",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== PRECACHE && k !== RUNTIME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GET. Let everything else (CDN libs, /api,
  // POST/PUT, cross-origin) go straight to the network untouched.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Navigations: network-first, fall back to cache, then the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("/offline.html"))
        )
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
