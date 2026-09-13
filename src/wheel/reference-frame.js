export const REFERENCE_RING_IDS = Object.freeze(["hour", "year", "month", "day", "solar"]);

export function validReferenceRing(id) {
  return REFERENCE_RING_IDS.includes(id);
}

export function referenceAnchorForOffset(worldRotation, currentOffset = 0) {
  if (!Number.isFinite(worldRotation) || !Number.isFinite(currentOffset)) return null;
  return worldRotation - currentOffset;
}

export function referenceFrameOffset({ referenceId, anchorRotation, worldRotations }) {
  if (!validReferenceRing(referenceId)) return 0;
  if (!Number.isFinite(anchorRotation)) return 0;
  const current = worldRotations instanceof Map
    ? worldRotations.get(referenceId)
    : worldRotations?.[referenceId];
  if (!Number.isFinite(current)) return 0;
  return current - anchorRotation;
}

export function rotationInReferenceFrame(worldRotation, frameOffset = 0) {
  if (!Number.isFinite(worldRotation)) return null;
  if (!Number.isFinite(frameOffset)) return worldRotation;
  return worldRotation - frameOffset;
}
