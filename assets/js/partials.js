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
          <a href="https://www.linkedin.com/in/matthias-bröring-739505318" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a href="https://discord.gg/ZR39NW4ax" target="_blank" rel="noopener noreferrer" aria-label="Discord">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </a>
          <a href="https://www.reddit.com/user/Blacksun332" target="_blank" rel="noopener noreferrer" aria-label="Reddit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
            </svg>
          </a>
          <a href="https://www.youtube.com/@RanzLappen" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>
          <a href="https://steamcommunity.com/profiles/76561198050017796" target="_blank" rel="noopener noreferrer" aria-label="Steam">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
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
