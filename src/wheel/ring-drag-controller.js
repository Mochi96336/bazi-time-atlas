import { RINGS, WHEEL_CENTER } from "./ring-model.js";
import { angleAt, shortestAngleDelta } from "./polar-geometry.js";
import { resolveDragActivation } from "./drag-activation.js";
import {
  ANGULAR_INERTIA_DEFAULTS,
  createAngularVelocityEstimator,
  shouldLaunchAngularInertia,
  stepAngularInertia
} from "./angular-inertia.js";
import {
  resetManualOffset,
  setManualOffset,
  snappedOffset
} from "./ring-state.js";
import { RING_VISIBILITY_EVENT, ringIsVisible } from "./ring-visibility.js";

const DETENT_EPSILON = 1e-9;

function screenInverse(svg) {
  const matrix = svg.getScreenCTM();
  return matrix ? matrix.inverse() : null;
}

function screenToWorld(svg, clientX, clientY, inverse = screenInverse(svg)) {
  if (!inverse) return null;
  return {
    x: inverse.a * clientX + inverse.c * clientY + inverse.e,
    y: inverse.b * clientX + inverse.d * clientY + inverse.f
  };
}

export function ringAtWorldPoint(point) {
  const radius = Math.hypot(point.x - WHEEL_CENTER.x, point.y - WHEEL_CENTER.y);
  return RINGS.find(ring => radius >= ring.innerRadius && radius <= ring.outerRadius) ?? null;
}

function eventTimeMs(event) {
  return Number.isFinite(event?.timeStamp) ? event.timeStamp : null;
}

function pointerSamples(event) {
  if (typeof event.getCoalescedEvents !== "function") return [event];
  const samples = event.getCoalescedEvents();
  return samples?.length ? samples : [event];
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
  onModeChange,
  inertiaOptions = {}
}) {
  const {
    requestFrame = typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : null,
    cancelFrame = typeof globalThis.cancelAnimationFrame === "function"
      ? globalThis.cancelAnimationFrame.bind(globalThis)
      : null,
    prefersReducedMotion = () => Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches),
    visibilityTarget = globalThis.document ?? null,
    sampleWindowMs = ANGULAR_INERTIA_DEFAULTS.sampleWindowMs,
    maxSampleAgeMs = ANGULAR_INERTIA_DEFAULTS.maxSampleAgeMs,
    launchSpeedDegPerMs = ANGULAR_INERTIA_DEFAULTS.launchSpeedDegPerMs,
    stopSpeedDegPerMs = ANGULAR_INERTIA_DEFAULTS.stopSpeedDegPerMs,
    timeConstantMs = ANGULAR_INERTIA_DEFAULTS.timeConstantMs,
    maxTravelDegrees = ANGULAR_INERTIA_DEFAULTS.maxTravelDegrees,
    maxFrameGapMs = ANGULAR_INERTIA_DEFAULTS.maxFrameGapMs
  } = inertiaOptions;

  let compareMode = false;
  let active = null;
  let coasting = null;
  let hoverRingId = null;

  function updatePointerStyle() {
    svg.style.touchAction = "none";
    svg.style.cursor = active ? "grabbing" : hoverRingId ? "grab" : "";
  }

  function setHoverRing(ringId) {
    const nextRingId = ringId ?? null;
    if (hoverRingId === nextRingId) return;
    hoverRingId = nextRingId;
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

  function applyGestureDelta(gesture, deltaDegrees, phase) {
    if (Math.abs(deltaDegrees) < DETENT_EPSILON) return;
    const state = ringStates[gesture.ringId];
    if (!state) return;
    if (gesture.mode === "free") {
      setManualOffset(state, state.manualOffset + deltaDegrees);
      onPoseChange?.(gesture.ringId, state, deltaDegrees, { phase });
    } else {
      onLinkedDragDelta?.(gesture.ringId, deltaDegrees, state);
    }
  }

  function endGesture(gesture, { detent = true, reason = "complete" } = {}) {
    const { ringId, mode } = gesture;
    const state = ringStates[ringId];
    if (!state) return;

    if (mode === "free") {
      const unsnappedOffset = state.manualOffset;
      const detentOffset = detent ? snappedOffset(ringId, unsnappedOffset) : unsnappedOffset;
      if (detent) {
        if (Math.abs(detentOffset) < DETENT_EPSILON) resetManualOffset(state);
        else setManualOffset(state, detentOffset);
        if (Math.abs(detentOffset - unsnappedOffset) >= DETENT_EPSILON) {
          onPoseChange?.(ringId, state, detentOffset - unsnappedOffset, {
            phase:"detent",
            unsnappedOffset,
            detentOffset
          });
        }
      }
      onDragEnd?.(ringId, state, { unsnappedOffset, detentOffset, reason });
    } else {
      onLinkedDragEnd?.(ringId, state, { reason });
    }
  }

  function clearCoasting() {
    if (!coasting) return null;
    const finished = coasting;
    if (finished.frameId !== null && typeof cancelFrame === "function") cancelFrame(finished.frameId);
    coasting = null;
    delete svg.dataset.coastingRing;
    delete svg.dataset.coastingMode;
    return finished;
  }

  function cancelInertia({ detent = true, reason = "external" } = {}) {
    const finished = clearCoasting();
    if (!finished) return false;
    endGesture(finished, { detent, reason });
    updatePointerStyle();
    return true;
  }

  function cancelActiveGesture({ detent = true, reason = "interrupted", releaseCapture = true } = {}) {
    if (!active) return false;
    const gesture = active;
    active = null;
    delete svg.dataset.activeRing;
    if (releaseCapture) {
      try { svg.releasePointerCapture(gesture.pointerId); } catch {}
    }
    if (gesture.dragActivated) endGesture(gesture, { detent, reason });
    updatePointerStyle();
    return true;
  }

  function inertiaFrame(timestamp) {
    if (!coasting) return;
    const current = coasting;
    const deltaTimeMs = timestamp - current.lastTimestamp;
    current.frameId = null;
    if (!Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0) {
      current.lastTimestamp = timestamp;
      current.frameId = requestFrame?.(inertiaFrame) ?? null;
      return;
    }
    if (deltaTimeMs > maxFrameGapMs) {
      cancelInertia({ detent:true, reason:"frame-gap" });
      return;
    }

    const step = stepAngularInertia({
      velocityDegPerMs: current.velocityDegPerMs,
      deltaTimeMs,
      timeConstantMs
    });
    const remainingDegrees = Math.max(0, maxTravelDegrees - current.travelDegrees);
    const deltaDegrees = Math.sign(step.deltaDegrees) * Math.min(Math.abs(step.deltaDegrees), remainingDegrees);
    applyGestureDelta(current, deltaDegrees, "inertia");
    current.travelDegrees += Math.abs(deltaDegrees);
    current.velocityDegPerMs = step.velocityDegPerMs;
    current.lastTimestamp = timestamp;

    if (current.travelDegrees + DETENT_EPSILON >= maxTravelDegrees
      || Math.abs(current.velocityDegPerMs) <= stopSpeedDegPerMs) {
      cancelInertia({ detent:true, reason:"inertia-settled" });
      return;
    }
    current.frameId = requestFrame?.(inertiaFrame) ?? null;
    if (current.frameId === null) cancelInertia({ detent:true, reason:"scheduler-unavailable" });
  }

  function startInertia(gesture, velocityDegPerMs, releaseTimeMs) {
    const reducedMotion = (() => {
      try { return Boolean(prefersReducedMotion?.()); } catch { return false; }
    })();
    if (typeof requestFrame !== "function" || !Number.isFinite(releaseTimeMs)) return false;
    if (!shouldLaunchAngularInertia(velocityDegPerMs, { launchSpeedDegPerMs, reducedMotion })) return false;

    coasting = {
      ringId: gesture.ringId,
      mode: gesture.mode,
      velocityDegPerMs,
      travelDegrees: 0,
      lastTimestamp: releaseTimeMs,
      frameId: null
    };
    svg.dataset.coastingRing = gesture.ringId;
    svg.dataset.coastingMode = gesture.mode;
    coasting.frameId = requestFrame(inertiaFrame);
    if (coasting.frameId === null || coasting.frameId === undefined) {
      clearCoasting();
      return false;
    }
    return true;
  }

  function setCompareMode(enabled) {
    cancelInertia({ detent:false, reason:"mode-change" });
    cancelActiveGesture({ detent:true, reason:"mode-change" });
    compareMode = Boolean(enabled);
    onModeChange?.(compareMode);
  }

  function acquirePointerCapture(event) {
    const synthetic = event.isTrusted === false;
    try {
      svg.setPointerCapture(event.pointerId);
      if (typeof svg.hasPointerCapture === "function" && !svg.hasPointerCapture(event.pointerId)) return synthetic;
      return true;
    } catch {
      return synthetic;
    }
  }

  function begin(event) {
    if (event.button > 0 || active) return;
    const world = screenToWorld(svg, event.clientX, event.clientY);
    if (!world) return;
    const ring = ringAtWorldPoint(world);
    if (!ring?.draggable || !ringIsVisible(svg, ring.id)) return;
    const state = ringStates[ring.id];
    if (!state) return;

    cancelInertia({ detent:false, reason:"grab" });
    event.preventDefault();
    if (!acquirePointerCapture(event)) {
      setHoverRing(ring.id);
      return;
    }
    setHoverRing(ring.id);
    const velocityEstimator = createAngularVelocityEstimator({ windowMs:sampleWindowMs });
    velocityEstimator.reset(eventTimeMs(event));
    active = {
      pointerId: event.pointerId,
      ringId: ring.id,
      mode: compareMode ? "free" : "linked",
      lastAngle: angleAt(WHEEL_CENTER, world),
      dragActivated: false,
      pendingDelta: 0,
      velocityEstimator,
      trustedInput: event.isTrusted !== false
    };
    svg.dataset.activeRing = ring.id;
    updatePointerStyle();
  }

  function applyPointerSample(sample, inverse) {
    const world = screenToWorld(svg, sample.clientX, sample.clientY, inverse);
    if (!world || !active) return;
    const nextAngle = angleAt(WHEEL_CENTER, world);
    const delta = shortestAngleDelta(nextAngle, active.lastAngle);
    active.lastAngle = nextAngle;
    if (Math.abs(delta) < DETENT_EPSILON) return;
    active.velocityEstimator.add(delta, eventTimeMs(sample));

    const wasActivated = active.dragActivated;
    const activation = resolveDragActivation(active, delta);
    active.dragActivated = activation.dragActivated;
    active.pendingDelta = activation.pendingDelta;
    const deltaToApply = activation.deltaToApply;
    const state = ringStates[active.ringId];

    if (!wasActivated && activation.dragActivated) {
      if (active.mode === "free") onDragStart?.(active.ringId, state);
      else onLinkedDragStart?.(active.ringId, state);
    }
    applyGestureDelta(active, deltaToApply, "drag");
  }

  function applyPointerEventSamples(event) {
    const inverse = screenInverse(svg);
    if (!inverse) return;
    for (const sample of pointerSamples(event)) applyPointerSample(sample, inverse);
  }

  function move(event) {
    if (!active) {
      updateHover(event);
      return;
    }
    if (event.pointerId !== active.pointerId) return;
    event.preventDefault();
    applyPointerEventSamples(event);
  }

  function finish(event, { allowInertia = true } = {}) {
    if (!active || event.pointerId !== active.pointerId) return;
    if (allowInertia) applyPointerEventSamples(event);
    const gesture = active;
    active = null;
    delete svg.dataset.activeRing;
    try { svg.releasePointerCapture(event.pointerId); } catch {}

    if (!gesture.dragActivated) {
      updatePointerStyle();
      return;
    }

    const releaseTimeMs = eventTimeMs(event);
    const velocityDegPerMs = gesture.velocityEstimator.velocityAt(releaseTimeMs, { maxSampleAgeMs });
    if (allowInertia && gesture.trustedInput && startInertia(gesture, velocityDegPerMs, releaseTimeMs)) {
      updatePointerStyle();
      return;
    }

    endGesture(gesture, { detent:true, reason:allowInertia ? "release" : "pointer-cancel" });
    updatePointerStyle();
  }

  function pointerUp(event) {
    finish(event, { allowInertia:true });
  }

  function pointerCancel(event) {
    finish(event, { allowInertia:false });
  }

  function lostPointerCapture(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    cancelActiveGesture({ detent:true, reason:"lost-pointer-capture", releaseCapture:false });
  }

  function leave() {
    if (!active) setHoverRing(null);
  }

  function visibilityChange() {
    if (!visibilityTarget?.hidden) return;
    cancelActiveGesture({ detent:true, reason:"document-hidden" });
    cancelInertia({ detent:true, reason:"document-hidden" });
    setHoverRing(null);
  }

  function ringVisibilityChange(event) {
    const { ringId, visible } = event?.detail ?? {};
    if (visible !== false || typeof ringId !== "string") return;
    if (active?.ringId === ringId) cancelActiveGesture({ detent:true, reason:"ring-hidden" });
    if (coasting?.ringId === ringId) cancelInertia({ detent:true, reason:"ring-hidden" });
    if (hoverRingId === ringId) setHoverRing(null);
  }

  svg.addEventListener("pointerdown", begin);
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", pointerUp);
  svg.addEventListener("pointercancel", pointerCancel);
  svg.addEventListener("lostpointercapture", lostPointerCapture);
  svg.addEventListener("pointerleave", leave);
  svg.addEventListener(RING_VISIBILITY_EVENT, ringVisibilityChange);
  visibilityTarget?.addEventListener?.("visibilitychange", visibilityChange);
  updatePointerStyle();

  return Object.freeze({
    setCompareMode,
    cancelActiveGesture,
    cancelInertia,
    get compareMode() { return compareMode; },
    get activeMode() { return active?.mode ?? null; },
    get isCoasting() { return coasting !== null; },
    get hoverRingId() { return hoverRingId; },
    destroy() {
      cancelActiveGesture({ detent:false, reason:"destroy" });
      cancelInertia({ detent:false, reason:"destroy" });
      setHoverRing(null);
      svg.removeEventListener("pointerdown", begin);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", pointerUp);
      svg.removeEventListener("pointercancel", pointerCancel);
      svg.removeEventListener("lostpointercapture", lostPointerCapture);
      svg.removeEventListener("pointerleave", leave);
      svg.removeEventListener(RING_VISIBILITY_EVENT, ringVisibilityChange);
      visibilityTarget?.removeEventListener?.("visibilitychange", visibilityChange);
      delete svg.dataset.activeRing;
      delete svg.dataset.coastingRing;
      delete svg.dataset.coastingMode;
      svg.style.touchAction = "";
      svg.style.cursor = "";
    }
  });
}
