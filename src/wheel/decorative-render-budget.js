// Only bitmap material and decorative motion use this budget. SVG labels,
// hit targets, ring poses and the selected-time clock keep their own cadence.
export function decorativeRenderBudget({
  viewportWidth = globalThis.innerWidth,
  coarsePointer = globalThis.matchMedia?.("(pointer: coarse)")?.matches ?? false,
  devicePixelRatio = globalThis.devicePixelRatio || 1,
  fullQuality = false
} = {}) {
  const mobile = !fullQuality && (coarsePointer
    || (Number.isFinite(viewportWidth) && viewportWidth <= 480));
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio : 1;
  return Object.freeze({
    mobile,
    pixelRatio:Math.min(ratio, mobile ? 1 : 2),
    frameIntervalMs:mobile ? 1000 / 30 : 0
  });
}

// A trailing draw always consumes the newest pose, including the final pose
// when input stops between ticks. No permanent animation loop is installed.
export function createDecorativeDrawQueue({
  draw,
  frameIntervalMs = () => 0,
  nowMs = () => globalThis.performance.now(),
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = id => globalThis.clearTimeout(id),
  isHidden = () => globalThis.document?.hidden ?? false
}) {
  let timerId = null;
  let pending = false;
  let lastDrawAt = -Infinity;

  function cancelTimer() {
    if (timerId !== null) clearTimer(timerId);
    timerId = null;
  }

  function request({ immediate = false } = {}) {
    pending = true;
    if (isHidden()) {
      cancelTimer();
      return;
    }
    const now = nowMs();
    const delay = immediate ? 0 : Math.max(0, frameIntervalMs() - (now - lastDrawAt));
    if (delay <= 0.5) {
      cancelTimer();
      pending = false;
      if (draw() !== false) lastDrawAt = now;
    } else if (timerId === null) {
      timerId = setTimer(() => {
        timerId = null;
        request();
      }, delay);
    }
  }

  return Object.freeze({
    request,
    visibilityChanged() {
      if (isHidden()) cancelTimer();
      else if (pending) request({ immediate:true });
    },
    cancel() {
      cancelTimer();
      pending = false;
    }
  });
}
