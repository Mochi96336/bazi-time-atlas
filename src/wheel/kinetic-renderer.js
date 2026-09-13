import {
  CURSOR_ANGLE,
  FAN,
  GUIDE_RADII,
  RADII,
  RINGS,
  SEXAGENARY_RING_IDS,
  WHEEL_CENTER,
  ringModel
} from "./ring-model.js";
import {
  annularSectorPath,
  arcPath,
  pointAt,
  rotationTransform
} from "./polar-geometry.js";
import {
  MOTION_TRACE_MIN_DEGREES,
  signedMotionArcPath
} from "./motion-trace.js";
import {
  referenceFrameOffset,
  rotationInReferenceFrame,
  validReferenceRing
} from "./reference-frame.js";
import { phaseAngleWithinTooth } from "./discrete-phase.js";
import { addTitle, setActiveSector, svgElement } from "./svg-renderer.js";

const MOTION_TRACE_TTL_MS = 420;
const REFERENCE_FRAME_EVENT = "atlas-reference-frame-change";
const PHASE_INSET_DEGREES = 0.45;

export function createKineticRenderer({ svg, sexagenary, solarTerms, zodiacSigns }) {
  const cycleSectors = new Map();
  const cyclePhaseNodes = new Map();
  const termSectorNodes = [];
  const zodiacSectorNodes = [];
  const motionTraceNodes = new Map();
  const worldRotations = new Map();
  const lastRenderedRotation = new Map();
  const motionTimers = new Map();
  let frameFlushQueued = false;
  let resetTraceBaselineBeforeFlush = false;

  const groupFor = id => svg.querySelector(`#${ringModel(id).groupId}`);
  const guides = svg.querySelector("#guide-layer");
  const cursorLayer = svg.querySelector("#cursor-layer");
  const solarTrack = groupFor("solar");
  const zodiacTrack = groupFor("zodiac");

  const el = (tag, attrs = {}, parent = svg) => svgElement(tag, attrs, parent);
  const polar = (radius, angle) => pointAt(WHEEL_CENTER, radius, angle);

  let motionLayer = svg.querySelector("#motion-layer");
  if (!motionLayer) {
    motionLayer = el("g", { id:"motion-layer", "aria-hidden":"true" }, svg);
    if (cursorLayer) svg.insertBefore(motionLayer, cursorLayer);
  }

  function renderGuides() {
    GUIDE_RADII.forEach(radius => {
      el("path", {
        d: arcPath(WHEEL_CENTER, radius, FAN.start, FAN.end),
        class: "guide-arc"
      }, guides);
    });
  }

  function renderCycleRing(id) {
    const model = ringModel(id);
    const group = groupFor(id);
    const sectors = [];
    group.classList.add("ring-track", `${id}-track`);

    sexagenary.forEach((label, index) => {
      const start = index * 6 + .18;
      const end = (index + 1) * 6 - .18;
      const path = el("path", {
        d: annularSectorPath(WHEEL_CENTER, model.innerRadius, model.outerRadius, start, end),
        class: `cycle-sector ${model.className}`,
        "data-cycle-index": index,
        "data-cycle-label": label
      }, group);
      addTitle(path, `${index + 1} · ${label}`);
      sectors.push(path);

      const tickAngle = index * 6;
      const inner = polar(model.outerRadius - 8, tickAngle);
      const outer = polar(model.outerRadius, tickAngle);
      el("line", {
        x1: inner.x,
        y1: inner.y,
        x2: outer.x,
        y2: outer.y,
        class: `ring-tick${index % 5 === 0 ? " major" : ""}`
      }, group);

      if (index % 5 === 0) {
        const radius = (model.innerRadius + model.outerRadius) / 2;
        const point = polar(radius, index * 6 + 3);
        const text = el("text", {
          x: point.x,
          y: point.y,
          class: "cycle-label",
          transform: `rotate(${index * 6 + 93} ${point.x} ${point.y})`
        }, group);
        text.textContent = label;
      }
    });

    const phasePath = el("path", {
      class: `state-phase-progress phase-${id}`,
      "data-phase-ring": id,
      "aria-hidden": "true"
    }, group);
    const phaseBead = el("circle", {
      class: `state-phase-bead phase-${id}`,
      "data-phase-ring": id,
      r: 2.8,
      "aria-hidden": "true"
    }, group);
    cyclePhaseNodes.set(id, { path:phasePath, bead:phaseBead });
    cycleSectors.set(id, sectors);
  }

  function renderSolarRing() {
    solarTerms.forEach((term, index) => {
      const path = el("path", {
        d: annularSectorPath(
          WHEEL_CENTER,
          RADII.dayOuter,
          RADII.solarOuter,
          term.longitude + .15,
          term.longitude + 15 - .15
        ),
        class: `term-sector ${term.kind}`,
        "data-term-index": index
      }, solarTrack);
      addTitle(path, `${term.name} · ${term.longitude}°`);
      termSectorNodes.push(path);

      const markInner = polar(RADII.dayOuter, term.longitude);
      const markOuter = polar(term.kind === "jie" ? RADII.solarOuter : RADII.solarOuter - 12, term.longitude);
      el("line", {
        x1: markInner.x,
        y1: markInner.y,
        x2: markOuter.x,
        y2: markOuter.y,
        class: `term-mark ${term.kind}`
      }, solarTrack);

      const labelPoint = polar(term.kind === "jie" ? RADII.solarOuter - 32 : RADII.solarOuter - 44, term.longitude + 7.5);
      const label = el("text", {
        x: labelPoint.x,
        y: labelPoint.y,
        class: `term-label ${term.kind}`,
        transform: `rotate(${term.longitude + 97.5} ${labelPoint.x} ${labelPoint.y})`
      }, solarTrack);
      label.textContent = term.name;
    });
  }

  function renderZodiacRing() {
    zodiacSigns.forEach((sign, index) => {
      const path = el("path", {
        d: annularSectorPath(
          WHEEL_CENTER,
          RADII.solarOuter,
          RADII.zodiacOuter,
          sign.start + .15,
          sign.end - .15
        ),
        class: "zodiac-sector",
        "data-zodiac-index": index
      }, zodiacTrack);
      addTitle(path, `${sign.name} · ${sign.element} · ${sign.modality}`);
      zodiacSectorNodes.push(path);

      const angle = sign.start + 15;
      const point = polar((RADII.solarOuter + RADII.zodiacOuter) / 2, angle);
      const label = el("text", {
        x: point.x,
        y: point.y,
        class: "zodiac-label",
        transform: `rotate(${angle + 90} ${point.x} ${point.y})`
      }, zodiacTrack);
      label.textContent = sign.name;
    });
  }

  function renderMotionTraces() {
    RINGS.forEach(ring => {
      const kind = ring.phaseKind === "sexagenary" ? "discrete" : "continuous";
      const path = el("path", {
        class: `motion-trace motion-${ring.id} ${kind}`,
        "data-motion-ring": ring.id,
        "data-motion-kind": kind
      }, motionLayer);
      motionTraceNodes.set(ring.id, path);
    });
  }

  function clearMotionTrace(id) {
    const node = motionTraceNodes.get(id);
    if (node) node.classList.remove("is-visible");
    const timer = motionTimers.get(id);
    if (timer) clearTimeout(timer);
    motionTimers.delete(id);
  }

  function clearAllMotionTraces() {
    RINGS.forEach(ring => clearMotionTrace(ring.id));
  }

  function updateMotionTrace(id, rotationDegrees, cursorAngle) {
    const node = motionTraceNodes.get(id);
    if (!node) return;
    const previous = lastRenderedRotation.get(id);
    lastRenderedRotation.set(id, rotationDegrees);
    if (!Number.isFinite(previous)) return;

    const delta = rotationDegrees - previous;
    node.dataset.lastDelta = delta.toFixed(4);
    if (node.dataset.layerHidden === "true") {
      clearMotionTrace(id);
      return;
    }
    if (Math.abs(delta) < MOTION_TRACE_MIN_DEGREES) return;

    const model = ringModel(id);
    const radius = (model.innerRadius + model.outerRadius) / 2;
    const d = signedMotionArcPath(WHEEL_CENTER, radius, cursorAngle, delta);
    if (!d) return;
    node.setAttribute("d", d);
    node.classList.add("is-visible");

    const priorTimer = motionTimers.get(id);
    if (priorTimer) clearTimeout(priorTimer);
    motionTimers.set(id, setTimeout(() => {
      node.classList.remove("is-visible");
      motionTimers.delete(id);
    }, MOTION_TRACE_TTL_MS));
  }

  function updateCyclePhase(id, activeIndex, phase) {
    const nodes = cyclePhaseNodes.get(id);
    const group = groupFor(id);
    if (!nodes || !group) return;
    const progress = phase?.progress;
    const angle = phaseAngleWithinTooth(activeIndex, progress, PHASE_INSET_DEGREES);
    if (!Number.isFinite(angle)) {
      nodes.path.removeAttribute("d");
      nodes.path.dataset.phaseVisible = "false";
      nodes.bead.dataset.phaseVisible = "false";
      nodes.bead.setAttribute("visibility", "hidden");
      delete group.dataset.phaseProgress;
      delete group.dataset.phaseStartMs;
      delete group.dataset.phaseEndMs;
      delete group.dataset.phaseSource;
      delete group.dataset.phaseBoundaryKind;
      return;
    }

    const model = ringModel(id);
    const radius = model.innerRadius + 6;
    const startAngle = activeIndex * 6 + PHASE_INSET_DEGREES;
    const bead = polar(radius, angle);
    nodes.bead.setAttribute("cx", bead.x);
    nodes.bead.setAttribute("cy", bead.y);
    nodes.bead.removeAttribute("visibility");
    nodes.bead.dataset.phaseVisible = "true";

    if (progress > 0.002) {
      nodes.path.setAttribute("d", arcPath(WHEEL_CENTER, radius, startAngle, angle));
      nodes.path.dataset.phaseVisible = "true";
    } else {
      nodes.path.removeAttribute("d");
      nodes.path.dataset.phaseVisible = "false";
    }

    group.dataset.phaseProgress = progress.toFixed(6);
    group.dataset.phaseStartMs = String(Math.round(phase.startMs));
    group.dataset.phaseEndMs = String(Math.round(phase.endMs));
    group.dataset.phaseSource = phase.source;
    group.dataset.phaseBoundaryKind = phase.boundaryKind;
  }

  function frameSettings() {
    const referenceId = validReferenceRing(svg.dataset.referenceRing)
      ? svg.dataset.referenceRing
      : null;
    const anchorRotation = Number(svg.dataset.referenceAnchorRotation);
    const frameOffset = referenceFrameOffset({
      referenceId,
      anchorRotation,
      worldRotations
    });
    return { referenceId, frameOffset };
  }

  function flushReferenceFrame() {
    frameFlushQueued = false;
    if (resetTraceBaselineBeforeFlush) {
      resetTraceBaselineBeforeFlush = false;
      clearAllMotionTraces();
      lastRenderedRotation.clear();
    }

    const { referenceId, frameOffset } = frameSettings();
    const cursorAngle = CURSOR_ANGLE - frameOffset;
    svg.dataset.referenceFrame = referenceId ?? "world";
    svg.dataset.referenceFrameOffsetDegrees = frameOffset.toFixed(4);
    svg.dataset.referenceCursorAngle = cursorAngle.toFixed(4);

    if (cursorLayer) {
      cursorLayer.setAttribute("transform", rotationTransform(-frameOffset, WHEEL_CENTER));
    }

    const renderedRotations = new Map();
    RINGS.forEach(ring => {
      const worldRotation = worldRotations.get(ring.id);
      if (!Number.isFinite(worldRotation)) return;
      const renderedRotation = rotationInReferenceFrame(worldRotation, frameOffset);
      if (!Number.isFinite(renderedRotation)) return;
      const group = groupFor(ring.id);
      group.setAttribute("transform", rotationTransform(renderedRotation, WHEEL_CENTER));
      group.dataset.worldRotation = worldRotation.toFixed(4);
      group.dataset.renderedRotation = renderedRotation.toFixed(4);
      renderedRotations.set(ring.id, renderedRotation);
    });

    RINGS.forEach(ring => {
      const renderedRotation = renderedRotations.get(ring.id);
      if (Number.isFinite(renderedRotation)) updateMotionTrace(ring.id, renderedRotation, cursorAngle);
    });
  }

  function scheduleReferenceFrameFlush({ resetTraceBaseline = false } = {}) {
    if (resetTraceBaseline) resetTraceBaselineBeforeFlush = true;
    if (frameFlushQueued) return;
    frameFlushQueued = true;
    queueMicrotask(flushReferenceFrame);
  }

  function renderCursor() {
    const inner = polar(RADII.inner - 12, CURSOR_ANGLE);
    const outer = polar(RADII.zodiacOuter + 12, CURSOR_ANGLE);
    el("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-halo" }, cursorLayer);
    el("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-line" }, cursorLayer);
    const cap = polar(RADII.zodiacOuter + 21, CURSOR_ANGLE);
    el("path", {
      d: `M ${cap.x - 6} ${cap.y - 1} L ${cap.x + 6} ${cap.y - 1} L ${cap.x} ${cap.y + 10} Z`,
      class: "cursor-cap"
    }, cursorLayer);
    const label = polar(RADII.zodiacOuter + 40, CURSOR_ANGLE);
    const text = el("text", { x: label.x, y: label.y, class: "cursor-note" }, cursorLayer);
    text.textContent = "SELECTED INSTANT";
  }

  function renderStatic() {
    renderGuides();
    SEXAGENARY_RING_IDS.forEach(renderCycleRing);
    renderSolarRing();
    renderZodiacRing();
    renderMotionTraces();
    renderCursor();
  }

  function setCyclePose(id, rotationDegrees, activeIndex, phase = null) {
    worldRotations.set(id, rotationDegrees);
    setActiveSector(cycleSectors.get(id) ?? [], activeIndex);
    updateCyclePhase(id, activeIndex, phase);
    scheduleReferenceFrameFlush();
  }

  function setSolarRingPose(rotationDegrees, solarLongitude) {
    worldRotations.set("solar", rotationDegrees);
    setActiveSector(termSectorNodes, Math.floor(((solarLongitude % 360) + 360) % 360 / 15) % 24);
    scheduleReferenceFrameFlush();
  }

  function setZodiacRingPose(rotationDegrees, solarLongitude) {
    worldRotations.set("zodiac", rotationDegrees);
    setActiveSector(zodiacSectorNodes, Math.floor(((solarLongitude % 360) + 360) % 360 / 30) % 12);
    scheduleReferenceFrameFlush();
  }

  svg.addEventListener(REFERENCE_FRAME_EVENT, () => {
    scheduleReferenceFrameFlush({ resetTraceBaseline:true });
  });

  return Object.freeze({
    renderStatic,
    setCyclePose,
    setSolarRingPose,
    setZodiacRingPose
  });
}
