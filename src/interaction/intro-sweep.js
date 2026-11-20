// Repair B1: opening time-lapse. On a plain first visit the Atlas fast-forwards
// from five days ago to the landing instant: the Hour ring turns once while the
// outer rings barely move, showing "each layer runs at its own rate" without
// adding text to the minimal home page. Pure timing math lives here; the page
// controller owns state, rendering and cancellation.

export const INTRO_SWEEP_SPAN_MS = 5 * 86_400_000; // one full Hour-ring turn
export const INTRO_SWEEP_DURATION_MS = 3600;
export const INTRO_SWEEP_STORAGE_KEY = "bta:intro-sweep-seen";

export function easeInOutCubic(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function introSweepInstant({ endMs, elapsedMs, spanMs = INTRO_SWEEP_SPAN_MS, durationMs = INTRO_SWEEP_DURATION_MS }) {
  if (!Number.isFinite(endMs)) throw new RangeError("endMs must be finite");
  const progress = durationMs > 0 ? elapsedMs / durationMs : 1;
  if (progress >= 1) return { instantMs:endMs, done:true };
  return { instantMs:endMs - spanMs * (1 - easeInOutCubic(progress)), done:false };
}

// Only a plain landing (no deep link, no analysis state) on a viewer who has
// not seen the sweep and has not asked for reduced motion gets the time-lapse.
// Embedded pages (iframes, test harnesses) never animate.
export function shouldRunIntroSweep({ search = "", reducedMotion = false, seen = false, hidden = false, embedded = false }) {
  if (reducedMotion || seen || hidden || embedded) return false;
  const params = new URLSearchParams(search);
  return [...params.keys()].length === 0;
}
