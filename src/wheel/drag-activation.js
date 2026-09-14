export const DRAG_ACTIVATION_DEGREES = 0.2;

export function resolveDragActivation(
  { dragActivated = false, pendingDelta = 0 },
  delta,
  threshold = DRAG_ACTIVATION_DEGREES
) {
  if (!Number.isFinite(delta)) throw new RangeError("delta must be finite");
  if (!Number.isFinite(pendingDelta)) throw new RangeError("pendingDelta must be finite");
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new RangeError("threshold must be a positive finite number");
  }

  if (dragActivated) {
    return Object.freeze({
      dragActivated: true,
      pendingDelta: 0,
      deltaToApply: delta
    });
  }

  const accumulated = pendingDelta + delta;
  if (Math.abs(accumulated) < threshold) {
    return Object.freeze({
      dragActivated: false,
      pendingDelta: accumulated,
      deltaToApply: 0
    });
  }

  return Object.freeze({
    dragActivated: true,
    pendingDelta: 0,
    deltaToApply: accumulated
  });
}
