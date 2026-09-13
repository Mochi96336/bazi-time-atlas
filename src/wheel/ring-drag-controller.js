import { RINGS, WHEEL_CENTER } from "./ring-model.js";
import { angleAt, shortestAngleDelta } from "./polar-geometry.js";
import { setManualOffset } from "./ring-state.js";

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

  function updatePointerStyle() {
    svg.style.touchAction = "none";
    svg.style.cursor = active ? "grabbing" : "grab";
  }

  function setCompareMode(enabled) {
    compareMode = Boolean(enabled);
    active = null;
    updatePointerStyle();
    onModeChange?.(compareMode);
  }

  function begin(event) {
    if (event.button > 0) return;
    const world = screenToWorld(svg, event.clientX, event.clientY);
    if (!world) return;
    const ring = ringAtWorldPoint(world);
    if (!ring?.draggable) return;
    const state = ringStates[ring.id];
    if (!state) return;

    event.preventDefault();
    try { svg.setPointerCapture(event.pointerId); } catch {}
    active = {
      pointerId: event.pointerId,
      ringId: ring.id,
      mode: compareMode ? "free" : "linked",
      lastAngle: angleAt(WHEEL_CENTER, world)
    };
    updatePointerStyle();
    if (active.mode === "free") onDragStart?.(ring.id, state);
    else onLinkedDragStart?.(ring.id, state);
  }

  function move(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    const world = screenToWorld(svg, event.clientX, event.clientY);
    if (!world) return;
    event.preventDefault();
    const nextAngle = angleAt(WHEEL_CENTER, world);
    const delta = shortestAngleDelta(nextAngle, active.lastAngle);
    active.lastAngle = nextAngle;
    if (Math.abs(delta) < 1e-9) return;

    const state = ringStates[active.ringId];
    if (active.mode === "free") {
      setManualOffset(state, state.manualOffset + delta);
      onPoseChange?.(active.ringId, state, delta);
    } else {
      onLinkedDragDelta?.(active.ringId, delta, state);
    }
  }

  function finish(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    const { ringId, mode } = active;
    const state = ringStates[ringId];
    active = null;
    try { svg.releasePointerCapture(event.pointerId); } catch {}
    updatePointerStyle();
    if (mode === "free") onDragEnd?.(ringId, state);
    else onLinkedDragEnd?.(ringId, state);
  }

  svg.addEventListener("pointerdown", begin);
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", finish);
  updatePointerStyle();

  return Object.freeze({
    setCompareMode,
    get compareMode() { return compareMode; },
    get activeMode() { return active?.mode ?? null; },
    destroy() {
      svg.removeEventListener("pointerdown", begin);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", finish);
      svg.removeEventListener("pointercancel", finish);
      svg.style.touchAction = "";
      svg.style.cursor = "";
    }
  });
}
