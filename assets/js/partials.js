(function () {
  'use strict';

  // Guard against double-injection (e.g. if this script is included twice).
  if (window.__toolsPartialsInjected) return;
  window.__toolsPartialsInjected = true;

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
    document.body.insertAdjacentHTML('beforeend', SEARCH_HTML + COOKIE_HTML);
  }

  if (document.body) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }
})();
