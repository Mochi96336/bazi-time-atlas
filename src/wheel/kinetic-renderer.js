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
import { addTitle, setActiveSector, svgElement } from "./svg-renderer.js";

const MOTION_TRACE_TTL_MS = 420;
const REFERENCE_FRAME_EVENT = "atlas-reference-frame-change";

export function createKineticRenderer({ svg, sexagenary, solarTerms, zodiacSigns }) {
  const cycleSectors = new Map();
  const cycleStaticLabels = new Map();
  const activeCycleLabels = new Map();
  const activeCycleIndices = new Map();
  const lastActiveCycleIndex = new Map();
  const termSectorNodes = [];
  const zodiacSectorNodes = [];
  const annualStaticLabels = new Map([
    ["term", []],
    ["zodiac", []]
  ]);
  const activeAnnualLabels = new Map();
  const lastActiveAnnualIndex = new Map();
  const motionTraceNodes = new Map();
  const worldRotations = new Map();
  const renderedRotations = new Map();
  const lastRenderedRotation = new Map();
  const motionTimers = new Map();
  let frameFlushQueued = false;
  let resetTraceBaselineBeforeFlush = false;

  const ringGroups = new Map([
    ...RINGS.map(ring => [ring.id, svg.querySelector(`#${ring.groupId}`)]),
    ["zodiac", svg.querySelector(`#${ringModel("zodiac").groupId}`)]
  ]);
  const groupFor = id => ringGroups.get(id) ?? null;
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

  function renderMaterialBeds() {
    SEXAGENARY_RING_IDS.forEach(id => {
      const model = ringModel(id);
      const d = annularSectorPath(WHEEL_CENTER, model.innerRadius, model.outerRadius, FAN.start, FAN.end);
      el("path", {
        d,
        class: `m2-ring-bed m2-${id}-bed`,
        "data-material-ring": id,
        "aria-hidden": "true"
      }, guides);
      el("path", {
        d,
        class: `m2-ring-sheen m2-${id}-sheen`,
        "data-material-sheen-ring": id,
        "aria-hidden": "true"
      }, guides);
    });
  }

  function renderGuides() {
    GUIDE_RADII.forEach(radius => {
      el("path", {
        d: arcPath(WHEEL_CENTER, radius, FAN.start, FAN.end),
        class: `guide-arc${radius === RADII.solarTermOuter ? " annual-subdivide" : ""}`
      }, guides);
    });
  }

  function renderCycleRing(id) {
    const model = ringModel(id);
    const group = groupFor(id);
    const sectors = [];
    const staticLabels = new Map();
    group.classList.add("ring-track", `${id}-track`);

    sexagenary.forEach((label, index) => {
      // Sectors tile the full coordinate continuously. Discrete boundaries are
      // expressed by short ticks and active/boundary evidence, not by cutting a
      // dark angular gutter between every pair of neighboring states.
      const start = index * 6;
      const end = (index + 1) * 6;
      const path = el("path", {
        d: annularSectorPath(WHEEL_CENTER, model.innerRadius, model.outerRadius, start, end),
        class: `cycle-sector ${model.className}`,
        "data-cycle-index": index,
        "data-cycle-label": label
      }, group);
      addTitle(path, `${index + 1} · ${label}`);
      sectors.push(path);

      const tickAngle = index * 6;
      const tickLength = index % 5 === 0 ? 14 : 5;
      const inner = polar(model.outerRadius - tickLength, tickAngle);
      const outer = polar(model.outerRadius, tickAngle);
      el("line", {
        x1: inner.x,
        y1: inner.y,
        x2: outer.x,
        y2: outer.y,
        class: `ring-tick${index % 5 === 0 ? " major" : ""}`
      }, group);

      // The current giant-disk geometry gives even the Hour ring enough arc
      // length for a two-glyph Ganzhi identity in every six-degree sector.
      // Render all 60 identities here; responsive/presentation CSS may still
      // thin the fast inner clocks without throwing the data away at render time.
      const radius = (model.innerRadius + model.outerRadius) / 2;
      const point = polar(radius, index * 6 + 3);
      const text = el("text", {
        x: point.x,
        y: point.y,
        class: `cycle-label${index % 5 === 0 ? " major" : ""}`,
        "data-cycle-index": index,
        "data-cycle-label": label,
        transform: `rotate(${index * 6 + 93} ${point.x} ${point.y})`
      }, group);
      text.textContent = label;
      staticLabels.set(index, text);
    });

    const activeLabel = el("text", {
      class: "active-cycle-label",
      "data-active-cycle-ring": id,
      "aria-hidden": "true",
      visibility: "hidden"
    }, group);

    el("path", {
      class: `state-phase-progress phase-${id}`,
      "data-phase-ring": id,
      "aria-hidden": "true"
    }, group);
    el("circle", {
      class: `state-phase-bead phase-${id}`,
      "data-phase-ring": id,
      r: 2.8,
      "aria-hidden": "true",
      visibility: "hidden"
    }, group);
    el("line", {
      class: `state-boundary-gate phase-${id}`,
      "data-boundary-ring": id,
      "aria-hidden": "true",
      visibility: "hidden"
    }, group);
    el("circle", {
      class: `state-boundary-shared-halo phase-${id}`,
      "data-boundary-ring": id,
      r: 5.2,
      "aria-hidden": "true",
      visibility: "hidden"
    }, group);

    cycleSectors.set(id, sectors);
    cycleStaticLabels.set(id, staticLabels);
    activeCycleLabels.set(id, activeLabel);
  }

  function updateActiveCycleLabel(id, activeIndex, modelRotationDegrees) {
    const node = activeCycleLabels.get(id);
    if (!node) return;

    const previousIndex = lastActiveCycleIndex.get(id);
    const staticLabels = cycleStaticLabels.get(id);
    const indexChanged = previousIndex !== activeIndex;
    if (Number.isInteger(previousIndex) && indexChanged) {
      staticLabels?.get(previousIndex)?.classList.remove("is-active-shadowed");
    }

    if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= sexagenary.length) {
      node.setAttribute("visibility", "hidden");
      node.removeAttribute("data-cycle-index");
      node.removeAttribute("data-cycle-label");
      node.removeAttribute("data-cycle-coordinate");
      node.textContent = "";
      lastActiveCycleIndex.delete(id);
      return;
    }

    // The active label is a read-head, not a sector caption. The controller's
    // model rotation already encodes the exact within-state Selected Instant
    // coordinate. Read that pose after the synchronous diagnostics update so a
    // label keeps moving inside one Ganzhi sector instead of sticking to its
    // midpoint. Free Compare changes only the effective/rendered pose, so this
    // local read-head then travels with a detached ring as intended.
    const coordinate = Number.isFinite(modelRotationDegrees)
      ? ((CURSOR_ANGLE - modelRotationDegrees) % 360 + 360) % 360
      : activeIndex * 6 + 3;
    const model = ringModel(id);
    const point = polar((model.innerRadius + model.outerRadius) / 2, coordinate);
    const label = sexagenary[activeIndex];
    node.setAttribute("x", String(point.x));
    node.setAttribute("y", String(point.y));
    node.setAttribute("transform", `rotate(${coordinate + 90} ${point.x} ${point.y})`);
    if (indexChanged) {
      node.setAttribute("data-cycle-index", String(activeIndex));
      node.setAttribute("data-cycle-label", label);
    }
    node.setAttribute("data-cycle-coordinate", coordinate.toFixed(6));
    if (indexChanged) {
      node.setAttribute("visibility", "visible");
      node.textContent = label;
      staticLabels?.get(activeIndex)?.classList.add("is-active-shadowed");
      lastActiveCycleIndex.set(id, activeIndex);
    }
  }

  function updateActiveAnnualLabel(kind, activeIndex, coordinate) {
    const node = activeAnnualLabels.get(kind);
    const staticLabels = annualStaticLabels.get(kind) ?? [];
    if (!node) return;

    const previousIndex = lastActiveAnnualIndex.get(kind);
    const indexChanged = previousIndex !== activeIndex;
    if (Number.isInteger(previousIndex) && indexChanged) {
      staticLabels[previousIndex]?.removeAttribute("visibility");
    }

    const source = kind === "term" ? solarTerms : zodiacSigns;
    if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= source.length || !Number.isFinite(coordinate)) {
      node.setAttribute("visibility", "hidden");
      node.removeAttribute("data-annual-index");
      node.removeAttribute("data-annual-label");
      node.removeAttribute("data-annual-coordinate");
      node.textContent = "";
      lastActiveAnnualIndex.delete(kind);
      return;
    }

    const model = kind === "term" ? ringModel("solar") : ringModel("zodiac");
    const innerRadius = kind === "term" ? model.innerRadius : model.innerRadius;
    const outerRadius = kind === "term" ? RADII.solarTermOuter : model.outerRadius;
    const point = polar((innerRadius + outerRadius) / 2, coordinate);
    const label = source[activeIndex]?.name ?? "";
    node.setAttribute("x", String(point.x));
    node.setAttribute("y", String(point.y));
    node.setAttribute("transform", `rotate(${coordinate + 90} ${point.x} ${point.y})`);
    if (indexChanged) {
      node.setAttribute("data-annual-index", String(activeIndex));
      node.setAttribute("data-annual-label", label);
    }
    node.setAttribute("data-annual-coordinate", coordinate.toFixed(6));
    if (indexChanged) {
      node.setAttribute("visibility", "visible");
      node.textContent = label;
      staticLabels[activeIndex]?.setAttribute("visibility", "hidden");
      lastActiveAnnualIndex.set(kind, activeIndex);
    }
  }

  function renderSolarRing() {
    const model = ringModel("solar");
    solarTrack.classList.add("ring-track", "solar-track", "annual-coordinate-band");
    solarTerms.forEach((term, index) => {
      const path = el("path", {
        d: annularSectorPath(
          WHEEL_CENTER,
          model.innerRadius,
          RADII.solarTermOuter,
          term.longitude,
          term.longitude + 15
        ),
        class: `term-sector ${term.kind}`,
        "data-term-index": index
      }, solarTrack);
      addTitle(path, `${term.name} · ${term.longitude}°`);
      termSectorNodes.push(path);

      const markInner = polar(model.innerRadius, term.longitude);
      const markOuter = polar(term.kind === "jie" ? RADII.solarTermOuter : RADII.solarTermOuter - 12, term.longitude);
      el("line", {
        x1: markInner.x,
        y1: markInner.y,
        x2: markOuter.x,
        y2: markOuter.y,
        class: `term-mark ${term.kind}`
      }, solarTrack);

      // Keep all 24 Solar-term identities on one instrument radius. Jie/Qi
      // hierarchy is already carried by tick length and typography; staggering
      // the glyph radius makes the annual scale read as a visual zig-zag and
      // also causes Jie labels to jump inward when they become the read-head.
      const labelRadius = (model.innerRadius + RADII.solarTermOuter) / 2;
      const labelPoint = polar(labelRadius, term.longitude + 7.5);
      const label = el("text", {
        x: labelPoint.x,
        y: labelPoint.y,
        class: `term-label ${term.kind}`,
        transform: `rotate(${term.longitude + 97.5} ${labelPoint.x} ${labelPoint.y})`
      }, solarTrack);
      label.textContent = term.name;
      annualStaticLabels.get("term").push(label);
    });

    activeAnnualLabels.set("term", el("text", {
      class: "term-label active-cycle-label active-annual-label",
      "data-active-annual-kind": "term",
      "aria-hidden": "true",
      visibility: "hidden"
    }, solarTrack));
  }

  function renderZodiacRing() {
    const model = ringModel("zodiac");
    zodiacTrack.classList.add("annual-coordinate-overlay", "zodiac-overlay");
    zodiacSigns.forEach((sign, index) => {
      const path = el("path", {
        d: annularSectorPath(
          WHEEL_CENTER,
          model.innerRadius,
          model.outerRadius,
          sign.start,
          sign.end
        ),
        class: "zodiac-sector",
        "data-zodiac-index": index
      }, zodiacTrack);
      addTitle(path, `${sign.name} · ${sign.element} · ${sign.modality}`);
      zodiacSectorNodes.push(path);

      const angle = sign.start + 15;
      const point = polar((model.innerRadius + model.outerRadius) / 2, angle);
      const label = el("text", {
        x: point.x,
        y: point.y,
        class: "zodiac-label",
        transform: `rotate(${angle + 90} ${point.x} ${point.y})`
      }, zodiacTrack);
      label.textContent = sign.name;
      annualStaticLabels.get("zodiac").push(label);
    });

    activeAnnualLabels.set("zodiac", el("text", {
      class: "zodiac-label active-cycle-label active-annual-label",
      "data-active-annual-kind": "zodiac",
      "aria-hidden": "true",
      visibility: "hidden"
    }, zodiacTrack));
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
    if (node.dataset.layerHidden === "true") {
      node.dataset.lastDelta = delta.toFixed(4);
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

    renderedRotations.clear();
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

    // Zodiac is a classification overlay inside the annual solar coordinate band,
    // so it inherits Solar's world/reference transform instead of owning one.
    const solarWorldRotation = worldRotations.get("solar");
    const solarRenderedRotation = renderedRotations.get("solar");
    if (Number.isFinite(solarWorldRotation) && Number.isFinite(solarRenderedRotation)) {
      zodiacTrack.setAttribute("transform", rotationTransform(solarRenderedRotation, WHEEL_CENTER));
      zodiacTrack.dataset.worldRotation = solarWorldRotation.toFixed(4);
      zodiacTrack.dataset.renderedRotation = solarRenderedRotation.toFixed(4);
      zodiacTrack.dataset.derivedFrom = "solar";
    }

    // setTrackDiagnostics() runs synchronously after each renderer pose update,
    // before this microtask flush. Its model rotation is therefore the canonical
    // Selected Instant coordinate even when Free Compare adds a manual offset to
    // the effective world rotation.
    SEXAGENARY_RING_IDS.forEach(id => {
      const group = groupFor(id);
      updateActiveCycleLabel(
        id,
        activeCycleIndices.get(id),
        Number(group?.dataset.modelRotation)
      );
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
    const outer = polar(RADII.outer + 12, CURSOR_ANGLE);
    el("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-halo" }, cursorLayer);
    el("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-line" }, cursorLayer);
    const cap = polar(RADII.outer + 21, CURSOR_ANGLE);
    el("path", {
      d: `M ${cap.x - 6} ${cap.y - 1} L ${cap.x + 6} ${cap.y - 1} L ${cap.x} ${cap.y + 10} Z`,
      class: "cursor-cap"
    }, cursorLayer);
    const label = polar(RADII.outer + 40, CURSOR_ANGLE);
    const text = el("text", { x: label.x, y: label.y, class: "cursor-note" }, cursorLayer);
    text.textContent = "SELECTED INSTANT";
  }

  function renderStatic() {
    renderMaterialBeds();
    renderGuides();
    SEXAGENARY_RING_IDS.forEach(renderCycleRing);
    renderSolarRing();
    renderZodiacRing();
    renderMotionTraces();
    renderCursor();
  }

  function setCyclePose(id, rotationDegrees, activeIndex) {
    worldRotations.set(id, rotationDegrees);
    activeCycleIndices.set(id, activeIndex);
    setActiveSector(cycleSectors.get(id) ?? [], activeIndex);
    scheduleReferenceFrameFlush();
  }

  function setSolarRingPose(rotationDegrees, solarLongitude) {
    worldRotations.set("solar", rotationDegrees);
    const normalized = ((solarLongitude % 360) + 360) % 360;
    const termIndex = Math.floor(normalized / 15) % 24;
    const zodiacIndex = Math.floor(normalized / 30) % 12;
    setActiveSector(termSectorNodes, termIndex);
    setActiveSector(zodiacSectorNodes, zodiacIndex);
    updateActiveAnnualLabel("term", termIndex, normalized);
    updateActiveAnnualLabel("zodiac", zodiacIndex, normalized);
    scheduleReferenceFrameFlush();
  }

  // Compatibility shim for callers during the radial-hierarchy migration. It
  // updates only active Zodiac classification; transform ownership stays Solar.
  function setZodiacRingPose(_rotationDegrees, solarLongitude) {
    const normalized = ((solarLongitude % 360) + 360) % 360;
    setActiveSector(zodiacSectorNodes, Math.floor(normalized / 30) % 12);
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
