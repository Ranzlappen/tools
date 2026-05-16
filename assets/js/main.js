/* main.js — theme toggle, cursor tracking for grid spotlight, card hover */
(() => {
  "use strict";

  const THEME_KEY = "tools:theme";
  const html = document.documentElement;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
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

  if (!reduceMotion) {
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
  if (grid && !reduceMotion) {
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
