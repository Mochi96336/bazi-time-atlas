import { ringModel } from "./ring-model.js";

export function createRingState(ringId) {
  if (!ringModel(ringId)) throw new RangeError(`unknown ring: ${ringId}`);
  return {
    ringId,
    modelRotation: 0,
    manualOffset: 0,
    linked: true
  };
}

export function effectiveRotation(state) {
  return state.modelRotation + state.manualOffset;
}

export function setModelRotation(state, modelRotation) {
  if (!Number.isFinite(modelRotation)) throw new RangeError("modelRotation must be finite");
  state.modelRotation = modelRotation;
  return state;
}

export function detachRing(state) {
  state.linked = false;
  return state;
}

export function setManualOffset(state, manualOffset) {
  if (!Number.isFinite(manualOffset)) throw new RangeError("manualOffset must be finite");
  state.manualOffset = manualOffset;
  if (manualOffset !== 0) state.linked = false;
  return state;
}

export function resetManualOffset(state) {
  state.manualOffset = 0;
  state.linked = true;
  return state;
}

export function snappedOffset(ringId, offsetDegrees) {
  const model = ringModel(ringId);
  if (!model) throw new RangeError(`unknown ring: ${ringId}`);
  const step = model.snapDegrees;
  return Math.round(offsetDegrees / step) * step;
}
