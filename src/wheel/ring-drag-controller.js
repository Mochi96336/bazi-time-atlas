import { RINGS, WHEEL_CENTER } from "./ring-model.js";
import { angleAt, shortestAngleDelta } from "./polar-geometry.js";
import { resolveDragActivation } from "./drag-activation.js";
import {
  resetManualOffset,
  setManualOffset,
  snappedOffset
} from "./ring-state.js";

const DETENT_EPSILON = 1e-9;

function screenToWorld(svg, clientX, clientY) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const inverse = matrix.inverse();
  if (typeof DOMPoint === "function") {
    const point = new DOMPoint(clientX, clientY).matrixTransform(inverse);
    return { x: point.x, y: point.y };
  }
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const world = point.matrixTransform(inverse);
  return { x: world.x, y: world.y };
}

export function ringAtWorldPoint(point) {
  const radius = Math.hypot(point.x - WHEEL_CENTER.x, point.y - WHEEL_CENTER.y);
  return RINGS.find(ring => radius >= ring.innerRadius && radius <= ring.outerRadius) ?? null;
}

function ringIsVisible(svg, ringId) {
  const hidden = (svg.dataset.hiddenRings ?? "").split(",").filter(Boolean);
  return !hidden.includes(ringId);
}

export function createRingDragController({
  svg,
  ringStates,
  onPoseChange,
  onDragStart,
  onDragEnd,
  onLinkedDragStart,
  onLinkedDragDelta,
  onLinkedDragEnd,
  onModeChange
}) {
  let compareMode = false;
  let active = null;
  let hoverRingId = null;

  function updatePointerStyle() {
    svg.style.touchAction = "none";
    svg.style.cursor = active ? "grabbing" : hoverRingId ? "grab" : "";
  }

  function setHoverRing(ringId) {
    hoverRingId = ringId ?? null;
    if (hoverRingId) svg.dataset.hoverRing = hoverRingId;
    else delete svg.dataset.hoverRing;
    updatePointerStyle();
  }

  function updateHover(event) {
    if (active) return;
    const world = screenToWorld(svg, event.clientX, event.clientY);
    if (!world) {
      setHoverRing(null);
      return;
    }
    const ring = ringAtWorldPoint(world);
    setHoverRing(ring?.draggable && ringIsVisible(svg, ring.id) ? ring.id : null);
  }

  function setCompareMode(enabled) {
    compareMode = Boolean(enabled);
    active = null;
    delete svg.dataset.activeRing;
    updatePointerStyle();
    onModeChange?.(compareMode);
  }

  function begin(event) {
    if (event.button > 0) return;
    const world = screenToWorld(svg, event.clientX, event.clientY);
    if (!world) return;
    const ring = ringAtWorldPoint(world);
    if (!ring?.draggable || !ringIsVisible(svg, ring.id)) return;
    const state = ringStates[ring.id];
    if (!state) return;

    event.preventDefault();
    try { svg.setPointerCapture(event.pointerId); } catch {}
    setHoverRing(ring.id);
    active = {
      pointerId: event.pointerId,
      ringId: ring.id,
      mode: compareMode ? "free" : "linked",
      lastAngle: angleAt(WHEEL_CENTER, world),
      dragActivated: false,
      pendingDelta: 0
    };
    svg.dataset.activeRing = ring.id;
    updatePointerStyle();
    if (active.mode === "free") onDragStart?.(ring.id, state);
    else onLinkedDragStart?.(ring.id, state);
  }

  function move(event) {
    if (!active) {
      updateHover(event);
      return;
    }
    if (event.pointerId !== active.pointerId) return;
    const world = screenToWorld(svg, event.clientX, event.clientY);
    if (!world) return;
    event.preventDefault();
    const nextAngle = angleAt(WHEEL_CENTER, world);
    const delta = shortestAngleDelta(nextAngle, active.lastAngle);
    active.lastAngle = nextAngle;
    if (Math.abs(delta) < DETENT_EPSILON) return;

    const activation = resolveDragActivation(active, delta);
    active.dragActivated = activation.dragActivated;
    active.pendingDelta = activation.pendingDelta;
    const deltaToApply = activation.deltaToApply;
    if (Math.abs(deltaToApply) < DETENT_EPSILON) return;

    const state = ringStates[active.ringId];
    if (active.mode === "free") {
      setManualOffset(state, state.manualOffset + deltaToApply);
      onPoseChange?.(active.ringId, state, deltaToApply, { phase:"drag" });
    } else {
      onLinkedDragDelta?.(active.ringId, deltaToApply, state);
    }
  }

  function finish(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    const { ringId, mode } = active;
    const state = ringStates[ringId];
    active = null;
    delete svg.dataset.activeRing;
    try { svg.releasePointerCapture(event.pointerId); } catch {}

    if (mode === "free") {
      const unsnappedOffset = state.manualOffset;
      const detentOffset = snappedOffset(ringId, unsnappedOffset);
      if (Math.abs(detentOffset) < DETENT_EPSILON) resetManualOffset(state);
      else setManualOffset(state, detentOffset);
      if (Math.abs(detentOffset - unsnappedOffset) >= DETENT_EPSILON) {
        onPoseChange?.(ringId, state, detentOffset - unsnappedOffset, {
          phase:"detent",
          unsnappedOffset,
          detentOffset
        });
      }
      onDragEnd?.(ringId, state, { unsnappedOffset, detentOffset });
    } else {
      onLinkedDragEnd?.(ringId, state);
    }
    updatePointerStyle();
  }

  function leave() {
    if (!active) setHoverRing(null);
  }

  svg.addEventListener("pointerdown", begin);
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", finish);
  svg.addEventListener("pointerleave", leave);
  updatePointerStyle();

  return Object.freeze({
    setCompareMode,
    get compareMode() { return compareMode; },
    get activeMode() { return active?.mode ?? null; },
    get hoverRingId() { return hoverRingId; },
    destroy() {
      svg.removeEventListener("pointerdown", begin);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", finish);
      svg.removeEventListener("pointercancel", finish);
      svg.removeEventListener("pointerleave", leave);
      delete svg.dataset.hoverRing;
      delete svg.dataset.activeRing;
      svg.style.touchAction = "";
      svg.style.cursor = "";
    }
  });
}
