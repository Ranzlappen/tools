/* main.js — backdrop selection, theme toggle, cursor tracking, card spotlight */
(() => {
  "use strict";

  const STORAGE_KEY = "tools:backdrop";
  const THEME_KEY = "tools:theme";
  const VALID = ["aurora", "shader", "particles", "grid"];
  const DEFAULT = "aurora";

  const html = document.documentElement;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------- theme toggle ---------- */
  // (Initial theme is set synchronously by the pre-paint script in <head>
  // to avoid FOUC. This block only handles user toggling thereafter.)

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

    // Re-tint the WebGL shader if it's currently active.
    import("./backdrop-shader.js")
      .then((m) => m.setTheme && m.setTheme(theme))
      .catch(() => {});
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

  /* ---------- backdrop selection ---------- */

  const initial = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID.includes(stored)) return stored;
    } catch {}
    return DEFAULT;
  })();

  let current = null;

  function setBackdrop(name) {
    if (!VALID.includes(name) || name === current) return;
    current = name;
    html.setAttribute("data-backdrop", name);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {}

    document
      .querySelectorAll(".backdrop-pill__btn")
      .forEach((btn) => {
        const active = btn.dataset.backdrop === name;
        btn.setAttribute("aria-checked", active ? "true" : "false");
        btn.tabIndex = active ? 0 : -1;
      });

    const labelEl = document.querySelector(".backdrop-pill__label");
    if (labelEl) labelEl.textContent = name;

    // lazy-load heavy backdrops on demand
    if (name === "shader") {
      import("./backdrop-shader.js")
        .then((m) => m.start && m.start())
        .catch(() => {});
    } else {
      import("./backdrop-shader.js")
        .then((m) => m.stop && m.stop())
        .catch(() => {});
    }
    if (name === "particles") {
      import("./backdrop-particles.js")
        .then((m) => m.start && m.start())
        .catch(() => {});
    } else {
      import("./backdrop-particles.js")
        .then((m) => m.stop && m.stop())
        .catch(() => {});
    }
  }

  document.querySelectorAll(".backdrop-pill__btn").forEach((btn) => {
    btn.addEventListener("click", () => setBackdrop(btn.dataset.backdrop));
  });

  // arrow-key navigation inside the radiogroup
  const pill = document.querySelector(".backdrop-pill");
  if (pill) {
    pill.addEventListener("keydown", (e) => {
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const idx = VALID.indexOf(current);
      const dir = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const next = VALID[(idx + dir + VALID.length) % VALID.length];
      setBackdrop(next);
      const btn = pill.querySelector(`[data-backdrop="${next}"]`);
      if (btn) btn.focus();
    });
  }

  setBackdrop(initial);

  /* ---------- cursor-tracked CSS vars (grid spotlight) ----------
     Only attached when the grid backdrop is active. Other backdrops
     don't use --mouse-x/y, and updating them on every pointermove
     was a wasted style recalc. The listener is added when grid is
     selected and removed when leaving it. */

  let mouseRaf = 0;
  let pendingX = 0;
  let pendingY = 0;
  const onPointerMoveForGrid = (e) => {
    pendingX = e.clientX;
    pendingY = e.clientY;
    if (mouseRaf) return;
    mouseRaf = requestAnimationFrame(() => {
      mouseRaf = 0;
      html.style.setProperty("--mouse-x", pendingX + "px");
      html.style.setProperty("--mouse-y", pendingY + "px");
    });
  };

  function syncMouseTracking() {
    const isGrid = html.dataset.backdrop === "grid";
    window.removeEventListener("pointermove", onPointerMoveForGrid);
    if (isGrid && !reduceMotion) {
      window.addEventListener("pointermove", onPointerMoveForGrid, {
        passive: true,
      });
    }
  }
  // Run on initial load + every time the backdrop changes.
  syncMouseTracking();
  document.querySelectorAll(".backdrop-pill__btn").forEach((btn) =>
    btn.addEventListener("click", () => queueMicrotask(syncMouseTracking))
  );

  /* ---------- card hover spotlight ----------
     Single delegated pointermove on the grid; writes --card-x/y on the
     hovered card only. Cheaper than per-card listeners. */

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
