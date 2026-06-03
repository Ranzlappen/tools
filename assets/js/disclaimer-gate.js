/* Disclaimer gate — one-time acknowledgement before a sensitive tool is usable.
   Shared and attribute-driven; the gate's content lives in each tool page so the
   wording stays page-specific. Markup contract:

     <dialog class="disclaimer-modal" data-disclaimer-gate
             data-storage-key="tools:<slug>:disclaimer" data-version="1">
       …
       <input type="checkbox" data-disclaimer-checkbox />
       <button data-disclaimer-accept disabled>…</button>
       <a data-disclaimer-decline href="/">…</a>
     </dialog>

   Acceptance is persisted in localStorage (versioned, wrapped in try/catch like
   the theme/sticky/consent code). A native <dialog> showModal() supplies the
   focus-trap + ::backdrop; Esc and backdrop-click are blocked so the only exits
   are Accept or the decline link. If storage is unavailable (private mode), the
   gate still closes for the session and simply re-prompts next visit. */

function initGate(dialog) {
  const key = dialog.dataset.storageKey;
  const version = dialog.dataset.version || "1";

  let acknowledged = false;
  try {
    acknowledged = !!key && localStorage.getItem(key) === version;
  } catch (e) {
    /* storage blocked — treat as not acknowledged */
  }
  if (acknowledged) return;

  const checkbox = dialog.querySelector("[data-disclaimer-checkbox]");
  const accept = dialog.querySelector("[data-disclaimer-accept]");

  // Block Esc / backdrop dismissal — the user must Accept or Leave.
  dialog.addEventListener("cancel", (e) => e.preventDefault());

  if (checkbox && accept) {
    const sync = () => { accept.disabled = !checkbox.checked; };
    checkbox.addEventListener("change", sync);
    sync();
  }

  if (accept) {
    accept.addEventListener("click", () => {
      if (checkbox && !checkbox.checked) return;
      try {
        if (key) localStorage.setItem(key, version);
      } catch (e) {
        /* storage blocked — close for this session only */
      }
      dialog.close();
    });
  }

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    // Browser without <dialog> support: degrade to a visible blocking block.
    dialog.setAttribute("open", "");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("dialog[data-disclaimer-gate]").forEach(initGate);
});
