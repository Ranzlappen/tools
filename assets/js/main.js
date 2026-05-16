/* main.js — backdrop selection, persistence, cursor tracking, card spotlight */
(() => {
  "use strict";

  const STORAGE_KEY = "tools:backdrop";
  const VALID = ["aurora", "shader", "particles", "grid"];
  const DEFAULT = "aurora";

  const html = document.documentElement;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

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
     One pointermove listener, rAF-throttled. Updates --mouse-x/y. */

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
