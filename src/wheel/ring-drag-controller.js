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
  onModeChange
}) {
  let compareMode = false;
  let active = null;

  function setCompareMode(enabled) {
    compareMode = Boolean(enabled);
    svg.style.touchAction = compareMode ? "none" : "";
    svg.style.cursor = compareMode ? "grab" : "";
    if (!compareMode) active = null;
    onModeChange?.(compareMode);
  }

  function begin(event) {
    if (!compareMode || event.button > 0) return;
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
      lastAngle: angleAt(WHEEL_CENTER, world)
    };
    svg.style.cursor = "grabbing";
    onDragStart?.(ring.id, state);
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
    setManualOffset(state, state.manualOffset + delta);
    onPoseChange?.(active.ringId, state);
  }

  function finish(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    const ringId = active.ringId;
    const state = ringStates[ringId];
    active = null;
    try { svg.releasePointerCapture(event.pointerId); } catch {}
    svg.style.cursor = compareMode ? "grab" : "";
    onDragEnd?.(ringId, state);
  }

  svg.addEventListener("pointerdown", begin);
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", finish);

  return Object.freeze({
    setCompareMode,
    get compareMode() { return compareMode; },
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
