// Repair B2/B3: the opt-in "怎麼讀" dialog and the one-time drag hint. The
// home page keeps no permanent explanatory text; both pieces appear only when
// asked for (guide) or on first use (hint).
const GUIDE_BUTTON = document.querySelector("#atlas-guide-button");
const GUIDE = document.querySelector("#atlas-guide");
const HINT = document.querySelector("#atlas-drag-hint");
const INSTRUMENT = document.querySelector("#kinetic-instrument");
const WHEEL = document.querySelector("#kinetic-wheel");
export const DRAG_HINT_STORAGE_KEY = "bta:drag-hint-seen";

function readFlag(key) {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}
function writeFlag(key) {
  try { localStorage.setItem(key, "1"); } catch { /* storage unavailable */ }
}

if (GUIDE_BUTTON && GUIDE) {
  GUIDE_BUTTON.setAttribute("aria-expanded", "false");
  GUIDE_BUTTON.addEventListener("click", () => {
    if (typeof GUIDE.showModal === "function") GUIDE.showModal();
    else GUIDE.setAttribute("open", "");
    GUIDE_BUTTON.setAttribute("aria-expanded", "true");
  });
  GUIDE.addEventListener("close", () => {
    GUIDE_BUTTON.setAttribute("aria-expanded", "false");
    GUIDE_BUTTON.focus();
  });
  // Clicking the backdrop (the dialog element itself) closes the guide.
  GUIDE.addEventListener("click", event => {
    if (event.target === GUIDE) GUIDE.close();
  });
}

function hideHint(remember) {
  if (!HINT) return;
  if (remember) writeFlag(DRAG_HINT_STORAGE_KEY);
  if (HINT.hidden) return;
  HINT.dataset.visible = "false";
  HINT.hidden = true;
}

function showHint() {
  if (!HINT || readFlag(DRAG_HINT_STORAGE_KEY)) return;
  if (INSTRUMENT?.dataset.analysisOpen === "true") return;
  HINT.hidden = false;
  requestAnimationFrame(() => { HINT.dataset.visible = "true"; });
}

if (HINT && INSTRUMENT) {
  // Only a plain landing gets the hint; deep links are shared, specific views.
  const plainLanding = !location.search;
  const sweepSettled = () => {
    const sweep = INSTRUMENT.dataset.introSweep;
    return sweep === "done" || sweep === "skipped";
  };
  const maybeShow = () => {
    if (!plainLanding || !sweepSettled()) return false;
    showHint();
    return true;
  };
  if (!maybeShow()) {
    const observer = new MutationObserver(() => { if (maybeShow()) observer.disconnect(); });
    observer.observe(INSTRUMENT, { attributes:true, attributeFilter:["data-intro-sweep"] });
  }
  WHEEL?.addEventListener("pointerdown", () => hideHint(true));
  new MutationObserver(() => {
    if (INSTRUMENT.dataset.analysisOpen === "true") hideHint(false);
  }).observe(INSTRUMENT, { attributes:true, attributeFilter:["data-analysis-open"] });
}
