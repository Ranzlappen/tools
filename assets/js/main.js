/* main.js — theme toggle, cursor tracking for grid spotlight, card hover */
(() => {
  "use strict";

  const THEME_KEY = "tools:theme";
  const html = document.documentElement;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const coarsePointer = window.matchMedia(
    "(hover: none), (pointer: coarse)"
  ).matches;

  /* ---------- theme toggle ----------
     Initial theme is set synchronously by the pre-paint script in <head>
     to avoid FOUC. This block only handles user toggling thereafter. */

  function setTheme(theme) {
    if (theme === "light") {
      html.setAttribute("data-theme", "light");
    } else {
      html.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}

    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.setAttribute(
        "aria-label",
        theme === "light" ? "Switch to dark theme" : "Switch to light theme"
      );
      btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    });
  }

  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
      setTheme(next);
    });
    btn.setAttribute(
      "aria-pressed",
      html.getAttribute("data-theme") === "light" ? "true" : "false"
    );
  });

  /* ---------- cursor-tracked CSS vars (grid spotlight) ----------
     One rAF-throttled pointermove listener updates --mouse-x/y on
     <html>; the grid backdrop's spot uses those vars. */

  if (!reduceMotion && !coarsePointer) {
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;
    window.addEventListener(
      "pointermove",
      (e) => {
        pendingX = e.clientX;
        pendingY = e.clientY;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          html.style.setProperty("--mouse-x", pendingX + "px");
          html.style.setProperty("--mouse-y", pendingY + "px");
        });
      },
      { passive: true }
    );
  }

  /* ---------- card hover spotlight ----------
     Single delegated pointermove on the grid; writes --card-x/y on the
     hovered card only. */

  const grid = document.querySelector(".grid");
  if (grid && !reduceMotion && !coarsePointer) {
    grid.addEventListener(
      "pointermove",
      (e) => {
        const card = e.target.closest(".card");
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--card-x", e.clientX - r.left + "px");
        card.style.setProperty("--card-y", e.clientY - r.top + "px");
      },
      { passive: true }
    );
  }

  /* ---------- staggered card-in animation indices ---------- */

  document.querySelectorAll(".grid .card").forEach((card, i) => {
    card.style.setProperty("--card-index", i);
  });
})();

/* ============================================================
   Ported header / footer behavior (from Ranzlappen/website).
   Header transparent->solid, sticky pin/unpin, search modal,
   storage inspector, footer year. Theme handling stays in the
   first IIFE above (CSS-driven icon swap). Overlays are injected
   by partials.js, which loads before this module.
   ============================================================ */
(function () {
  'use strict';

  // -------------------------------------------------------
  // Header: transparent -> solid on scroll
  // -------------------------------------------------------
  var header = document.getElementById('site-header');
  var heroEl = document.querySelector('.hero');
  var scrollThreshold = heroEl ? heroEl.offsetHeight * 0.3 : 60;
  var headerRAF = null;

  function updateHeader() {
    if (!header) return;
    if (window.scrollY > scrollThreshold) {
      header.classList.remove('site-header--transparent');
      header.classList.add('site-header--solid');
    } else {
      header.classList.remove('site-header--solid');
      header.classList.add('site-header--transparent');
    }
  }

  if (header) {
    if (!heroEl) {
      // No hero on this page -> render solid immediately.
      header.classList.remove('site-header--transparent');
      header.classList.add('site-header--solid');
    } else {
      window.addEventListener('scroll', function () {
        if (headerRAF) return;
        headerRAF = requestAnimationFrame(function () {
          headerRAF = null;
          updateHeader();
        });
      }, { passive: true });
      updateHeader();
    }
  }

  // -------------------------------------------------------
  // Header sticky pin / unpin (global)
  // -------------------------------------------------------
  var STICKY_KEY = 'tools:headerSticky';
  var stickyBtn = document.getElementById('header-sticky-toggle');
  var iconPin = stickyBtn ? stickyBtn.querySelector('.icon-pin') : null;
  var iconPinOff = stickyBtn ? stickyBtn.querySelector('.icon-pin-off') : null;

  function setStickyIcons() {
    var off = document.documentElement.getAttribute('data-header-sticky') === 'off';
    if (iconPin && iconPinOff) {
      iconPin.style.display = off ? 'none' : '';
      iconPinOff.style.display = off ? '' : 'none';
    }
    if (stickyBtn) stickyBtn.setAttribute('aria-pressed', off ? 'false' : 'true');
  }
  setStickyIcons();

  if (stickyBtn) {
    stickyBtn.addEventListener('click', function () {
      var off = document.documentElement.getAttribute('data-header-sticky') === 'off';
      if (off) {
        document.documentElement.removeAttribute('data-header-sticky');
        try { localStorage.setItem(STICKY_KEY, 'on'); } catch (e) {}
      } else {
        document.documentElement.setAttribute('data-header-sticky', 'off');
        try { localStorage.setItem(STICKY_KEY, 'off'); } catch (e) {}
      }
      setStickyIcons();
      document.documentElement.dispatchEvent(new CustomEvent('headersticky:change'));
    });
  }

  // Track page scroll so the unpinned-header pin chip can fade in.
  function updateScrolledState() {
    document.documentElement.classList.toggle('is-scrolled', window.scrollY > 10);
  }
  updateScrolledState();
  window.addEventListener('scroll', updateScrolledState, { passive: true });

  // -------------------------------------------------------
  // Search Modal
  // -------------------------------------------------------
  var searchToggle = document.getElementById('search-toggle');
  var searchOverlay = document.getElementById('search-overlay');
  var searchInput = document.getElementById('search-input');

  function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { if (searchInput) searchInput.focus(); }, 100);
  }

  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (searchInput) searchInput.value = '';
    var results = document.getElementById('search-results');
    if (results) results.innerHTML = '';
  }

  if (searchToggle) searchToggle.addEventListener('click', openSearch);

  if (searchOverlay) {
    searchOverlay.addEventListener('click', function (e) {
      if (e.target === searchOverlay) closeSearch();
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (searchOverlay && searchOverlay.classList.contains('is-open')) {
        closeSearch();
      } else {
        openSearch();
      }
    }
    if (e.key === 'Escape' && searchOverlay && searchOverlay.classList.contains('is-open')) {
      closeSearch();
    }
  });

  // -------------------------------------------------------
  // Browser Storage Inspector Modal (ported verbatim)
  // -------------------------------------------------------
  var cookieToggle = document.getElementById('cookie-toggle');
  var cookieOverlay = document.getElementById('cookie-overlay');
  var cookieClose = document.getElementById('cookie-close');
  var cookieBody = document.getElementById('cookie-body');

  function truncate(str, max) {
    if (!str) return '—';
    return str.length > max ? str.substring(0, max) + '…' : str;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function flagHtml(val) {
    if (val) return '<span class="cookie-card__value cookie-card__value--flag cookie-card__value--yes">Yes</span>';
    return '<span class="cookie-card__value cookie-card__value--flag cookie-card__value--no">No</span>';
  }

  function detectType(value) {
    if (value === 'true' || value === 'false') return 'boolean';
    if (value !== '' && !isNaN(Number(value))) return 'number';
    try {
      var parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return 'array';
      if (typeof parsed === 'object' && parsed !== null) return 'object';
    } catch (e) { /* not JSON */ }
    return 'string';
  }

  function byteSize(str) {
    var bytes = new Blob([str]).size;
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  function parseCookies() {
    var raw = document.cookie;
    if (!raw || !raw.trim()) return [];
    return raw.split(';').map(function (entry) {
      var parts = entry.trim().split('=');
      var name = decodeURIComponent(parts[0]);
      var value = parts.slice(1).join('=');
      try { value = decodeURIComponent(value); } catch (e) { /* keep raw */ }
      return { name: name, value: value };
    });
  }

  function parseCookiesAsync(callback) {
    if ('cookieStore' in window) {
      window.cookieStore.getAll().then(function (cookies) {
        callback(cookies.map(function (c) {
          return {
            name: c.name,
            value: c.value,
            domain: c.domain || location.hostname,
            path: c.path || '/',
            secure: c.secure,
            sameSite: c.sameSite || 'N/A',
            expires: c.expires ? new Date(c.expires).toISOString() : 'Session',
            source: 'CookieStore API'
          };
        }));
      })['catch'](function () { callback(null); });
    } else {
      callback(null);
    }
  }

  function parseStorage(storage) {
    var items = [];
    try {
      for (var i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        var val = storage.getItem(key);
        items.push({ name: key, value: val || '' });
      }
    } catch (e) {
      return null; // access denied
    }
    return items;
  }

  function parseCacheStorage(callback) {
    if (!('caches' in window)) { callback(null); return; }
    var result = [];
    caches.keys().then(function (names) {
      if (!names.length) { callback(result); return; }
      var remaining = names.length;
      names.forEach(function (name) {
        caches.open(name).then(function (cache) {
          return cache.keys();
        }).then(function (requests) {
          var urls = requests.map(function (r) { return r.url; });
          result.push({ cacheName: name, urls: urls });
          remaining--;
          if (remaining === 0) callback(result);
        })['catch'](function () {
          remaining--;
          if (remaining === 0) callback(result);
        });
      });
    })['catch'](function () {
      callback(null);
    });
  }

  function buildSection(id, emoji, title, count, isCollapsed, contentHtml) {
    var expanded = isCollapsed ? 'false' : 'true';
    var collapsedClass = isCollapsed ? ' is-collapsed' : '';
    var countLabel = (typeof count === 'string') ? count : (count === 0 ? 'empty' : count);
    var html = '';
    html += '<div class="storage-section" id="storage-' + id + '">';
    html += '  <button class="storage-section__toggle" aria-expanded="' + expanded + '" aria-controls="storage-' + id + '-content">';
    html += '    <span class="storage-section__icon">' + emoji + '</span>';
    html += '    <span class="storage-section__title">' + title + '</span>';
    html += '    <span class="storage-section__count">' + countLabel + '</span>';
    html += '    <span class="storage-section__chevron">&#9658;</span>';
    html += '  </button>';
    html += '  <div class="storage-section__content' + collapsedClass + '" id="storage-' + id + '-content">';
    html += contentHtml;
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function buildCookieCardHtml(cookies) {
    if (!cookies.length) return '<p class="storage-section__empty">No cookies found for this domain.</p>';
    var defaultDomain = location.hostname;
    var defaultPath = '/';
    var defaultSecure = location.protocol === 'https:';
    var html = '';
    cookies.forEach(function (c) {
      var domain = c.domain || defaultDomain;
      var path = c.path || defaultPath;
      var secure = (typeof c.secure === 'boolean') ? c.secure : defaultSecure;
      var sameSite = c.sameSite || 'N/A';
      var expires = c.expires || 'Session';

      html += '<div class="cookie-card">';
      html += '  <div class="cookie-card__name">' + escapeHtml(truncate(c.name, 40)) + '</div>';
      html += '  <div class="cookie-card__grid">';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Value</span><span class="cookie-card__value">' + escapeHtml(truncate(c.value, 60)) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Domain</span><span class="cookie-card__value">' + escapeHtml(domain) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Path</span><span class="cookie-card__value">' + escapeHtml(path) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Secure</span>' + flagHtml(secure) + '</div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">SameSite</span><span class="cookie-card__value">' + escapeHtml(sameSite) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Expires</span><span class="cookie-card__value">' + escapeHtml(truncate(expires, 30)) + '</span></div>';
      html += '  </div>';
      html += '</div>';
    });
    return html;
  }

  function buildStorageCards(items) {
    if (items === null) return '<p class="storage-section__empty">Access denied (private browsing or storage blocked).</p>';
    if (!items.length) return '<p class="storage-section__empty">No items found.</p>';
    var html = '';
    items.forEach(function (item) {
      var type = detectType(item.value);
      var size = byteSize(item.name + item.value);
      html += '<div class="cookie-card">';
      html += '  <div class="cookie-card__name">' + escapeHtml(truncate(item.name, 40)) + '</div>';
      html += '  <div class="cookie-card__grid">';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Value</span><span class="cookie-card__value">' + escapeHtml(truncate(item.value, 120)) + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Type</span><span class="cookie-card__value">' + type + '</span></div>';
      html += '    <div class="cookie-card__field"><span class="cookie-card__label">Size</span><span class="cookie-card__value">' + size + '</span></div>';
      html += '  </div>';
      html += '</div>';
    });
    return html;
  }

  function buildCacheCards(cacheData) {
    if (cacheData === null) return '<p class="storage-section__empty">Cache Storage API not available.</p>';
    if (!cacheData.length) return '<p class="storage-section__empty">No caches found.</p>';
    var html = '';
    cacheData.forEach(function (cache) {
      var urlCount = cache.urls.length;
      var maxUrls = 20;
      html += '<div class="cookie-card">';
      html += '  <div class="cookie-card__name">' + escapeHtml(truncate(cache.cacheName, 60)) + ' <span class="cookie-card__value" style="font-weight:400">(' + urlCount + ' entries)</span></div>';
      html += '  <ul class="cache-url-list">';
      var limit = Math.min(urlCount, maxUrls);
      for (var i = 0; i < limit; i++) {
        html += '    <li>' + escapeHtml(cache.urls[i]) + '</li>';
      }
      if (urlCount > maxUrls) {
        html += '    <li class="cache-url-list__more">and ' + (urlCount - maxUrls) + ' more…</li>';
      }
      html += '  </ul>';
      html += '</div>';
    });
    return html;
  }

  function buildModalContent() {
    if (!cookieBody) return;
    var cookies = parseCookies();
    var localItems = parseStorage(localStorage);
    var sessionItems = parseStorage(sessionStorage);
    var hasCacheApi = 'caches' in window;

    var totalSync = cookies.length + (localItems ? localItems.length : 0) + (sessionItems ? sessionItems.length : 0);

    var html = '';
    html += buildSection('cookies', '🍪', 'Cookies', cookies.length, false, buildCookieCardHtml(cookies));
    html += buildSection('local', '💾', 'localStorage', localItems ? localItems.length : 0, false, buildStorageCards(localItems));
    html += buildSection('session', '📋', 'sessionStorage', sessionItems ? sessionItems.length : 0, true, buildStorageCards(sessionItems));

    if (hasCacheApi) {
      html += buildSection('cache', '📦', 'Cache Storage', '…', true, '<p class="storage-section__loading">Loading cache data…</p>');
    }

    if (totalSync === 0 && !hasCacheApi) {
      cookieBody.innerHTML = '<p class="cookie-empty">No browser storage data found for this domain.</p>';
      return;
    }

    cookieBody.innerHTML = html;

    var toggles = cookieBody.querySelectorAll('.storage-section__toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', function () {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', String(!expanded));
        var contentId = this.getAttribute('aria-controls');
        var content = document.getElementById(contentId);
        if (content) content.classList.toggle('is-collapsed');
      });
    }

    if (hasCacheApi) {
      parseCacheStorage(function (cacheData) {
        var cacheContent = document.getElementById('storage-cache-content');
        var cacheSection = document.getElementById('storage-cache');
        if (!cacheContent || !cacheSection) return;

        var count = 0;
        if (cacheData) {
          cacheData.forEach(function (c) { count += c.urls.length; });
        }
        var badge = cacheSection.querySelector('.storage-section__count');
        if (badge) badge.textContent = cacheData ? count : 0;

        cacheContent.innerHTML = buildCacheCards(cacheData);
      });
    }

    parseCookiesAsync(function (richCookies) {
      if (!richCookies || !richCookies.length) return;
      var cookieSection = document.getElementById('storage-cookies');
      if (!cookieSection) return;

      var badge = cookieSection.querySelector('.storage-section__count');
      if (badge) badge.textContent = richCookies.length;

      var content = document.getElementById('storage-cookies-content');
      if (content) {
        content.innerHTML = buildCookieCardHtml(richCookies.map(function (c) {
          return { name: c.name, value: c.value, domain: c.domain, path: c.path, secure: c.secure, sameSite: c.sameSite, expires: c.expires };
        }));
      }
    });
  }

  function openCookieModal() {
    if (!cookieOverlay) return;
    buildModalContent();
    cookieOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { if (cookieClose) cookieClose.focus(); }, 100);
  }

  function closeCookieModal() {
    if (!cookieOverlay) return;
    cookieOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (cookieToggle) cookieToggle.addEventListener('click', openCookieModal);
  if (cookieClose) cookieClose.addEventListener('click', closeCookieModal);
  if (cookieOverlay) {
    cookieOverlay.addEventListener('click', function (e) {
      if (e.target === cookieOverlay) closeCookieModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && cookieOverlay && cookieOverlay.classList.contains('is-open')) {
      closeCookieModal();
    }
  });

  // -------------------------------------------------------
  // Footer year
  // -------------------------------------------------------
  var y = document.getElementById('footer-year');
  if (y) y.textContent = new Date().getFullYear();

  // -------------------------------------------------------
  // Service worker (offline + installability). Progressive
  // enhancement — absence changes nothing. Registers on load
  // so it never contends with first-paint resources.
  // -------------------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
