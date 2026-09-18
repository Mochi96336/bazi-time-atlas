export const DRAG_ACTIVATION_DEGREES = 0.2;

export function resolveDragActivationInto(
  target,
  { dragActivated = false, pendingDelta = 0 },
  delta,
  threshold = DRAG_ACTIVATION_DEGREES
) {
  if (!target || typeof target !== "object") throw new TypeError("target must be an object");
  if (!Number.isFinite(delta)) throw new RangeError("delta must be finite");
  if (!Number.isFinite(pendingDelta)) throw new RangeError("pendingDelta must be finite");
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new RangeError("threshold must be a positive finite number");
  }

  if (dragActivated) {
    target.dragActivated = true;
    target.pendingDelta = 0;
    target.deltaToApply = delta;
    return target;
  }

  const accumulated = pendingDelta + delta;
  if (Math.abs(accumulated) < threshold) {
    target.dragActivated = false;
    target.pendingDelta = accumulated;
    target.deltaToApply = 0;
    return target;
  }

  target.dragActivated = true;
  target.pendingDelta = 0;
  target.deltaToApply = accumulated;
  return target;
}

export function resolveDragActivation(state, delta, threshold = DRAG_ACTIVATION_DEGREES) {
  const result = resolveDragActivationInto({}, state, delta, threshold);
  return Object.freeze({
    dragActivated:result.dragActivated,
    pendingDelta:result.pendingDelta,
    deltaToApply:result.deltaToApply
  });
}
