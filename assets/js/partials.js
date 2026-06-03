(function () {
  'use strict';

  // Guard against double-injection (e.g. if this script is included twice).
  if (window.__toolsPartialsInjected) return;
  window.__toolsPartialsInjected = true;

  // ---------------------------------------------------------------
  // Canonical site header. Single source of truth for every page —
  // injected at the top of `.page` so the brand, the ranzlappen.com
  // button, and the search/theme/pin controls stay byte-identical
  // across the dashboard and all tool subpages. main.js wires the
  // control IDs after this runs (partials.js is a `defer` classic
  // script listed before the main.js module, so it executes first).
  // ---------------------------------------------------------------
  var HEADER_HTML = `
    <header class="site-header site-header--transparent" id="site-header" role="banner">
      <div class="shell site-header__inner">
        <a href="/" class="brand" aria-label="ranzlappen tools home">
          <span class="brand__mark" aria-hidden="true"><img src="/assets/icon.png" alt="" width="32" height="32" /></span>
          <span class="brand__name">
            <span class="brand__sub">tools</span>.ranzlappen
          </span>
        </a>
        <div class="header-actions">
          <a class="site-header__home" href="https://ranzlappen.com" target="_blank" rel="noopener noreferrer">ranzlappen.com<span class="external-icon" aria-hidden="true">↗</span></a>
          <button class="search-toggle" id="search-toggle" type="button" aria-label="Search">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
          <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Switch to light theme" aria-pressed="false" title="Toggle theme">
            <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg class="icon-sun"  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          </button>
          <button class="header-sticky-toggle" id="header-sticky-toggle" type="button" aria-label="Toggle sticky header" aria-pressed="true" title="Pin/unpin the header">
            <svg class="icon-pin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
            </svg>
            <svg class="icon-pin-off" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none" aria-hidden="true">
              <path d="M12 17v5"/><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/>
            </svg>
          </button>
        </div>
      </div>
    </header>`;

  // ---------------------------------------------------------------
  // Canonical site footer. Mirrors the parent ranzlappen.com footer
  // (links, project favicon strip, support button, social icons,
  // cookie/storage controls, copyright) so the subdomain reads as
  // part of the same family.
  // ---------------------------------------------------------------
  var FOOTER_HTML = `
    <footer class="site-footer" role="contentinfo">
      <div class="shell footer-inner">
        <nav class="footer-links" aria-label="Footer navigation">
          <a href="https://ranzlappen.com/about/" target="_blank" rel="noopener noreferrer">About<span class="external-icon" aria-hidden="true">↗</span></a>
          <a href="https://ranzlappen.com/contact/" target="_blank" rel="noopener noreferrer">Contact<span class="external-icon" aria-hidden="true">↗</span></a>
          <a href="https://ranzlappen.com/disclaimer/" target="_blank" rel="noopener noreferrer">Disclaimer<span class="external-icon" aria-hidden="true">↗</span></a>
          <a href="https://ranzlappen.com/privacy/" target="_blank" rel="noopener noreferrer">Privacy<span class="external-icon" aria-hidden="true">↗</span></a>
          <a href="https://github.com/Ranzlappen/tools" target="_blank" rel="noopener noreferrer">Source<span class="external-icon" aria-hidden="true">↗</span></a>
        </nav>

        <nav class="footer-projects" aria-label="My projects">
          <a href="https://ticked.ranzlappen.com" target="_blank" rel="noopener noreferrer" aria-label="Ticked" title="Ticked"><img src="/assets/favicons/ticked.png" alt="" width="24" height="24" loading="lazy"></a>
          <a href="https://twitch-mood-radar.ranzlappen.com" target="_blank" rel="noopener noreferrer" aria-label="Twitch Mood Radar" title="Twitch Mood Radar"><img src="/assets/favicons/twitch-mood-radar.png" alt="" width="24" height="24" loading="lazy"></a>
          <a href="https://tools.ranzlappen.com" target="_blank" rel="noopener noreferrer" aria-label="tools" title="tools"><img src="/assets/favicons/tools.png" alt="" width="24" height="24" loading="lazy"></a>
          <a href="https://ranzlappen.com/polyvote/" target="_blank" rel="noopener noreferrer" aria-label="PolyVote" title="PolyVote"><img src="/assets/favicons/polyvote.png" alt="" width="24" height="24" loading="lazy"></a>
          <a href="https://ranzlappen.com/references/spectrum/" target="_blank" rel="noopener noreferrer" aria-label="Spectrum" title="Spectrum"><img src="/assets/favicons/spectrum.png" alt="" width="24" height="24" loading="lazy"></a>
          <a href="https://ranzlappen.com/references/electronics-fundamentals/" target="_blank" rel="noopener noreferrer" aria-label="Electronics Fundamentals" title="Electronics Fundamentals"><img src="/assets/favicons/electronics-fundamentals.png" alt="" width="24" height="24" loading="lazy"></a>
          <a href="https://ranzlappen.com/references/cmd-cheat-sheet/" target="_blank" rel="noopener noreferrer" aria-label="CMD Cheat Sheet" title="CMD Cheat Sheet"><img src="/assets/favicons/cmd-cheat-sheet.png" alt="" width="24" height="24" loading="lazy"></a>
        </nav>

        <div class="footer-support">
          <a href="https://ko-fi.com/F1F1140LWT" target="_blank" rel="noopener noreferrer" class="footer-support__link">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M7.5 3C4.46 3 2 5.46 2 8.5c0 5.72 6.5 10 10 12.5 3.5-2.5 10-6.78 10-12.5C22 5.46 19.54 3 16.5 3 14.64 3 13 3.95 12 5.34 11 3.95 9.36 3 7.5 3z"/></svg>
            Support My Work
          </a>
        </div>

        <div class="footer-social">
          <a href="https://github.com/Ranzlappen" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>
          <a href="https://x.com/MatthiasBro" target="_blank" rel="noopener noreferrer" aria-label="Twitter / X">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a href="mailto:info@ranzlappen.com" aria-label="Email">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M2 4h20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm10.06 9.683L3.27 6.205 1.97 7.795l10.094 8.512L22.03 7.795l-1.299-1.59z"/>
            </svg>
          </a>
          <a href="https://ranzlappen.com/feed.xml" target="_blank" rel="noopener noreferrer" aria-label="RSS Feed">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="6.18" cy="17.82" r="2.18"/>
              <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z"/>
            </svg>
          </a>
        </div>

        <div class="footer-cookie-group">
          <button class="footer-consent-link" id="cc-footer-settings" type="button" onclick="CookieConsent.show()" aria-label="Open cookie settings">🛡️ Cookie Settings</button>
          <span class="footer-cookie-group__sep" aria-hidden="true">·</span>
          <button class="footer-consent-link" id="cookie-toggle" type="button" aria-label="View browser storage">🍪 Storage Inspector</button>
        </div>

        <p class="footer-copy">&copy; <span id="footer-year">2026</span> ranzlappen tools. All rights reserved.</p>
      </div>
    </footer>`;

  // Search modal markup (lifted from website _includes/search-modal.html).
  var SEARCH_HTML =
    '<div class="search-overlay" id="search-overlay" role="dialog" aria-modal="true" aria-label="Search">' +
    '<div class="search-box">' +
    '<div class="search-input-wrapper">' +
    '<svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
    '<input type="text" class="search-input" id="search-input" placeholder="Search..." autocomplete="off" spellcheck="false" />' +
    '<kbd class="search-kbd">ESC</kbd>' +
    '</div>' +
    '<div class="search-results" id="search-results"></div>' +
    '<div class="search-hint">' +
    '<span><kbd>&uarr;</kbd><kbd>&darr;</kbd> to navigate</span>' +
    '<span><kbd>&crarr;</kbd> to select</span>' +
    '<span><kbd>ESC</kbd> to close</span>' +
    '</div>' +
    '</div>' +
    '</div>';

  // Storage inspector modal markup (lifted from website _includes/cookie-modal.html).
  var COOKIE_HTML =
    '<div class="cookie-overlay" id="cookie-overlay" role="dialog" aria-modal="true" aria-label="Storage Inspector">' +
    '<div class="cookie-box">' +
    '<div class="cookie-header">' +
    '<h2 class="cookie-title">Storage Inspector</h2>' +
    '<button class="cookie-close" id="cookie-close" aria-label="Close">&times;</button>' +
    '</div>' +
    '<div class="cookie-body" id="cookie-body"></div>' +
    '</div>' +
    '</div>';

  function inject() {
    // Header + footer live inside `.page` (header first, footer last) so the
    // existing layout — fixed-header offset, flex-column page — is preserved.
    var page = document.querySelector('.page');
    if (page) {
      page.insertAdjacentHTML('afterbegin', HEADER_HTML);
      page.insertAdjacentHTML('beforeend', FOOTER_HTML);
    }
    // Modals are hidden overlays; append them at the end of <body>.
    document.body.insertAdjacentHTML('beforeend', SEARCH_HTML + COOKIE_HTML);
  }

  if (document.body) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }
})();
