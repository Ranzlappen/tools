(function () {
  'use strict';

  var docs = [];
  var loaded = false;
  var loading = false;

  function el(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function groupLabel(g) {
    return g || 'Other';
  }

  function hasFunctional() {
    return !!(window.__cookieConsent && window.__cookieConsent.functional);
  }

  function loadIndex() {
    if (loaded || loading) return;
    loading = true;
    fetch('/assets/search.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        docs = Array.isArray(data) ? data : (data.docs || []);
        loaded = true;
        loading = false;
        runSearch();
      })
      .catch(function () {
        loading = false;
      });
  }

  function filter(q) {
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return docs.filter(function (d) {
      var hay = ((d.title || '') + ' ' + (d.description || '')).toLowerCase();
      return tokens.every(function (t) { return hay.indexOf(t) !== -1; });
    });
  }

  function renderResults(items, q) {
    var results = el('search-results');
    if (!results) return;
    if (!q) { results.innerHTML = ''; return; }
    if (!items.length) {
      results.innerHTML = '<div class="search-empty">No results for "' + escapeHtml(q) + '"</div>';
      return;
    }
    var groups = {};
    items.forEach(function (it) {
      var g = groupLabel(it.group);
      (groups[g] = groups[g] || []).push(it);
    });
    var html = '';
    Object.keys(groups).forEach(function (g) {
      html += '<div class="search-group-label">' + escapeHtml(g) + '</div>';
      groups[g].forEach(function (it) {
        html += '<a class="search-result-item" href="' + escapeHtml(it.url) + '">' +
          '<span class="search-result-item__title">' + escapeHtml(it.title) + '</span>' +
          (it.description ? '<span class="search-result-item__desc">' + escapeHtml(it.description) + '</span>' : '') +
          '</a>';
      });
    });
    results.innerHTML = html;
  }

  function runSearch() {
    var input = el('search-input');
    if (!input) return;
    var q = input.value.trim();
    if (!loaded || !q) { renderResults([], q); return; }
    renderResults(filter(q), q);
  }

  // Consent gate
  function gatePrompt() {
    var results = el('search-results');
    if (!results) return;
    results.innerHTML =
      '<div class="search-gate">' +
      '<p class="search-gate__text">On-site search needs functional cookies to load its index.</p>' +
      '<button type="button" class="search-gate__btn" id="search-enable-cc">Cookie Settings</button>' +
      '</div>';
    var btn = el('search-enable-cc');
    if (btn) btn.addEventListener('click', function () {
      if (window.CookieConsent) window.CookieConsent.show();
    });
  }

  function onFocus() {
    if (!hasFunctional()) { gatePrompt(); return; }
    loadIndex();
  }

  function wire() {
    var input = el('search-input');
    if (!input) return;
    input.addEventListener('focus', onFocus);
    input.addEventListener('input', function () {
      if (!hasFunctional()) { gatePrompt(); return; }
      if (!loaded) { loadIndex(); return; }
      runSearch();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  document.addEventListener('consent-updated', function () {
    if (!hasFunctional()) return;
    if (!loaded) loadIndex();
    else runSearch();
  });
})();
