// Repair B3: the one-time drag hint. The home page keeps no permanent
// explanatory text; the hint appears only on first use. (The B2 "怎麼讀"
// dialog was removed after review on 2026-11-21.)
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
