import "./time-context-control.js";
import { installKineticFanGuard } from "./kinetic-fan-guard.js";
import { installStaticWheelLayers } from "./wheel/static-wheel-layers.js";
import { solarTerms, zodiacSigns } from "./data.js";
import {
  CURSOR_ANGLE,
  RINGS,
  RADII,
  WHEEL_CENTER,
  SEXAGENARY_RING_IDS,
  assertWheelModel
} from "./wheel/ring-model.js";
import { temporalCycleRotation } from "./wheel/temporal-track.js";
import { shortestAngleDelta } from "./wheel/polar-geometry.js";
import { createKineticRenderer } from "./wheel/kinetic-renderer.js";
import { setAttributeIfChanged, setDatasetIfChanged, setTextIfChanged } from "./wheel/svg-renderer.js";
import {
  createRingState,
  effectiveRotation,
  setModelRotation
} from "./wheel/ring-state.js";
import { createRingDragController } from "./wheel/ring-drag-controller.js";
import {
  createOrbitalBackground,
  createOrbitalSourceVelocityTracker
} from "./orbital-background.js";
import {
  ATLAS_SEXAGENARY_NAMES,
  atlasInputValueFromFields,
  formatAtlasCivil,
  instantFromAtlasLocalInput,
  parseAtlasSearch,
  resolveAtlasDisplayState,
  solarLongitudeAtInstant
} from "./wheel/atlas-display-model.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  atlasTimeContextFromSearch,
  formatAtlasUtcOffset,
  writeAtlasTimeContextSearch
} from "./wheel/atlas-time-context.js";
import { createFrameCommitQueue } from "./interaction/frame-commit-queue.js";
import { createFreeCompareController } from "./interaction/free-compare-controller.js";
import { applyLinkedRingDragInto } from "./interaction/linked-ring-scrub.js";
import { createKineticPlaybackController } from "./interaction/kinetic-playback-controller.js";
import {
  INTRO_SWEEP_DURATION_MS,
  INTRO_SWEEP_SPAN_MS,
  INTRO_SWEEP_STORAGE_KEY,
  introSweepInstant,
  shouldRunIntroSweep
} from "./interaction/intro-sweep.js";
import {
  SELECTED_INSTANT_COMMAND,
  selectedInstantFromCommandDetail
} from "./interaction/selected-instant-command.js";
import {
  TIME_CONTEXT_COMMAND,
  timeContextFromCommandDetail
} from "./interaction/time-context-command.js";
import {
  clearLegacyProjectionUrl,
  selectedInstantUrl
} from "./interaction/selected-instant-url.js";
import {
  DAY_MS,
  sliderStateForScale
} from "./interaction/kinetic-playback.js";

const svg = document.querySelector("#kinetic-wheel");

// Native 4K manual-fling mitigation: suspend SVG transitions only while the
// drag controller exposes an active pointer gesture or inertia. Resting visual
// presentation and normal playback are unchanged. This opt-out is intentionally
// reversible without a deployment if a browser shows a regression.
const motionTransitionAudit = new URLSearchParams(globalThis.location.search)
  .get("motionTransitionAudit");
if (motionTransitionAudit !== "off") {
  svg.dataset.motionTransitionAudit =
    motionTransitionAudit === "surfaces" ? "surfaces" : "all";
}
const instrument = document.querySelector("#kinetic-instrument");
const slider = document.querySelector("#time-slider");
const instantInput = document.querySelector("#instant-input");
const playButton = document.querySelector("#play-button");
const nowButton = document.querySelector("#now-button");
const scaleButtons = [...document.querySelectorAll("[data-scale]")];
const timeBasisReadout = document.querySelector(".readout-meta span:last-child strong");
const trackNodes = new Map([
  ...RINGS.map(ring => [ring.id, document.getElementById(`${ring.id}-track`)]),
  ["zodiac", document.getElementById("zodiac-track")]
]);
const textNodes = new Map([
  "instant-readout",
  "solar-readout",
  "term-readout",
  "hour-active",
  "year-active",
  "month-active",
  "day-active",
  "solar-active",
  "zodiac-active",
  "state-year",
  "state-month",
  "state-day",
  "state-hour",
  "state-zodiac",
  "state-term",
  "slider-left",
  "slider-right",
  "scale-readout"
].map(id => [id, document.getElementById(id)]));

const renderer = createKineticRenderer({
  svg,
  sexagenary: ATLAS_SEXAGENARY_NAMES,
  solarTerms,
  zodiacSigns
});

const state = {
  anchorMs: Date.now(),
  selectedMs: Date.now(),
  timeContext: DEFAULT_ATLAS_TIME_CONTEXT,
  scale: "year",
  playing: false,
  animationFrame: null,
  lastAnimationTs: null,
  legacyProjection: null
};

const ringStates = Object.fromEntries(RINGS.map(ring => [ring.id, createRingState(ring.id)]));
// Zodiac remains a rendered layer for independent Free Compare pose only; it is
// no longer a primary radial hit target or independent time coordinate.
ringStates.zodiac = createRingState("zodiac");
const cycleRuntime = Object.fromEntries(SEXAGENARY_RING_IDS.map(id => [id, { initialized: false }]));
let lastSolarLongitude = null;
let longitudeModelRotation = null;
let currentDisplay = null;
let dragController = null;
let compareController = null;
let playbackController = null;
let orbitalBackground = null;
const yearOrbitalVelocity = createOrbitalSourceVelocityTracker();
let linkedWheelRenderPending = false;
let pendingLinkedDiagnostics = null;
const linkedDragResult = {
  instantMs:0,
  remainderDegrees:0,
  appliedSteps:0,
  crossedBoundaries:0
};
const linkedLongitudeAtMs = instantMs => solarLongitudeAtInstant(instantMs, state.timeContext);

const pendingFreePoseRings = new Set();
const freePoseCommitQueue = createFrameCommitQueue({
  commit() {
    if (!pendingFreePoseRings.size) return;
    const ringIds = [...pendingFreePoseRings];
    pendingFreePoseRings.clear();
    ringIds.forEach(renderRingPose);
    instrument.dataset.lastDraggedRing = ringIds[ringIds.length - 1];
    compareController?.update();
  }
});
const linkedWheelCommitQueue = createFrameCommitQueue({
  commit: commitLinkedWheelFrame
});

function queueLinkedDiagnostics(next) {
  pendingLinkedDiagnostics = {
    ...(pendingLinkedDiagnostics ?? {}),
    ...next
  };
}

function commitLinkedDiagnostics() {
  const diagnostics = pendingLinkedDiagnostics;
  pendingLinkedDiagnostics = null;
  if (!diagnostics) return;
  if (Object.hasOwn(diagnostics, "boundaries")) {
    instrument.dataset.linkedScrubBoundaries = String(diagnostics.boundaries);
  }
  if (Object.hasOwn(diagnostics, "lastRing")) {
    instrument.dataset.lastLinkedScrubRing = diagnostics.lastRing;
  }
  if (Object.hasOwn(diagnostics, "deltaMs")) {
    instrument.dataset.lastLinkedScrubDeltaMs = String(diagnostics.deltaMs);
  }
}

// While a linked drag (or its inertia) runs, frames resolve pillars with the
// O(1) estimate; the settled instant is re-resolved through Tyme on release.
let linkedScrubActive = false;

function commitLinkedWheelFrame() {
  commitLinkedDiagnostics();
  if (!linkedWheelRenderPending) return;
  linkedWheelRenderPending = false;
  setSliderForScale();
  updateWheel({ fast:linkedScrubActive });
}

function resetLinkedWheelFrame() {
  linkedWheelCommitQueue.cancel();
  linkedWheelRenderPending = false;
  pendingLinkedDiagnostics = null;
}

function cycleIndexForRing(id, display) {
  if (id === "hour") return display.hourIndex;
  if (id === "year") return display.yearIndex;
  if (id === "month") return display.monthIndex;
  if (id === "day") return display.dayIndex;
  return -1;
}

function setTrackDiagnostics(id) {
  const track = trackNodes.get(id) ?? null;
  const pose = ringStates[id];
  if (!track || !pose) return;
  setDatasetIfChanged(track, "modelRotation", pose.modelRotation.toFixed(4));
  setDatasetIfChanged(track, "manualOffset", pose.manualOffset.toFixed(4));
  setDatasetIfChanged(track, "linked", String(pose.linked));
}

function renderRingPose(id) {
  const pose = ringStates[id];
  if (!pose || !currentDisplay) return;
  const rotation = effectiveRotation(pose);
  if (SEXAGENARY_RING_IDS.includes(id)) {
    renderer.setCyclePose(id, rotation, cycleIndexForRing(id, currentDisplay));
  } else if (id === "solar") {
    renderer.setSolarRingPose(rotation, currentDisplay.longitude);
  } else if (id === "zodiac") {
    renderer.setZodiacRingPose(rotation, currentDisplay.longitude);
  }
  setTrackDiagnostics(id);

  if (id === "year") {
    yearOrbitalVelocity.observe(rotation);
    orbitalBackground?.sourceMotionChanged();
  }
}

function renderAllRingPoses() {
  RINGS.forEach(ring => renderRingPose(ring.id));
  renderRingPose("zodiac");
}

function alignCycleRing(id, index, phase) {
  const runtime = cycleRuntime[id];
  const pose = ringStates[id];
  if (index < 0) return;
  // A legacy annual deep link can name a projected month without representing a
  // physical Selected Instant for that month. Keep that explicitly nonphysical
  // identity centred as before; every real-time phase uses its true progress.
  const progress = phase?.progress ?? 0.5;
  const nextRotation = temporalCycleRotation({
    index,
    progress,
    cursorAngle: CURSOR_ANGLE,
    previousRotation: runtime.initialized ? pose.modelRotation : null
  });
  runtime.initialized = true;
  setModelRotation(pose, nextRotation);
}

function alignLongitudeTracks(longitude) {
  if (longitudeModelRotation === null || lastSolarLongitude === null) {
    longitudeModelRotation = CURSOR_ANGLE - longitude;
  } else {
    longitudeModelRotation -= shortestAngleDelta(longitude, lastSolarLongitude);
  }
  lastSolarLongitude = longitude;
  setModelRotation(ringStates.solar, longitudeModelRotation);
  setModelRotation(ringStates.zodiac, longitudeModelRotation);
}

function applyInitialSearchState() {
  state.timeContext = atlasTimeContextFromSearch(location.search);
  const parsed = parseAtlasSearch(location.search);
  if (Number.isFinite(parsed.instantMs)) {
    state.anchorMs = parsed.instantMs;
    state.selectedMs = parsed.instantMs;
    return;
  }
  if (!parsed.legacyProjection) return;
  state.legacyProjection = parsed.legacyProjection;
  document.body.classList.add("legacy-projection");
}

function clearLegacyProjection() {
  if (!state.legacyProjection) return;
  state.legacyProjection = null;
  document.body.classList.remove("legacy-projection");
  const href = clearLegacyProjectionUrl(location.href);
  if (href) history.replaceState(history.state, "", href);
}

function temporalContextUrl(currentHref, timeContext) {
  try {
    const url = new URL(currentHref);
    writeAtlasTimeContextSearch(url.searchParams, timeContext);
    return url.href;
  } catch {
    return null;
  }
}

function setText(id, value) {
  const node = textNodes.get(id) ?? null;
  setTextIfChanged(node, value);
}

function updateReadout(display) {
  const {
    fields,
    longitude,
    pillars,
    yearName,
    monthName,
    activeTerm,
    activeZodiac,
    timeContext
  } = display;
  const offsetLabel = formatAtlasUtcOffset(timeContext.utcOffsetHours);
  const basisLabel = timeContext.dayBoundary === DEFAULT_ATLAS_TIME_CONTEXT.dayBoundary
    ? offsetLabel
    : `${offsetLabel} · 00:00`;
  setText("instant-readout", `${formatAtlasCivil(fields)} · ${offsetLabel}`);
  setText("solar-readout", `${longitude.toFixed(3)}°`);
  setText("term-readout", activeTerm.name);
  setText("hour-active", pillars.hour.name);
  setText("year-active", yearName);
  setText("month-active", monthName);
  setText("day-active", pillars.day.name);
  setText("solar-active", `${activeTerm.name} · ${activeZodiac.name} · ${longitude.toFixed(1)}°`);
  setText("zodiac-active", activeZodiac.name);
  setText("state-year", yearName);
  setText("state-month", monthName);
  setText("state-day", pillars.day.name);
  setText("state-hour", pillars.hour.name);
  setText("state-zodiac", activeZodiac.name);
  setText("state-term", activeTerm.name);
  setTextIfChanged(timeBasisReadout, basisLabel);
  if (instantInput) setAttributeIfChanged(instantInput, "aria-label", `選定時間，${offsetLabel}，秒級`);
  setDatasetIfChanged(instrument, "selectedInstantMs", String(Math.round(state.selectedMs)));
  setDatasetIfChanged(instrument, "utcOffsetHours", String(timeContext.utcOffsetHours));
  setDatasetIfChanged(instrument, "dayBoundary", timeContext.dayBoundary);
  setDatasetIfChanged(instrument, "yearPillar", yearName);
  setDatasetIfChanged(instrument, "monthPillar", monthName);
  setDatasetIfChanged(instrument, "dayPillar", pillars.day.name);
  setDatasetIfChanged(instrument, "hourPillar", pillars.hour.name);
  setDatasetIfChanged(instrument, "solarLongitude", longitude.toFixed(6));
  setDatasetIfChanged(instrument, "term", activeTerm.name);
  setDatasetIfChanged(instrument, "zodiac", activeZodiac.name);
  if (state.legacyProjection) {
    setDatasetIfChanged(instrument, "projectionMode", "legacy-longitude");
    setDatasetIfChanged(instrument, "projectionLongitude", longitude.toFixed(6));
    if (state.legacyProjection.monthBranch) instrument.dataset.focusMonth = state.legacyProjection.monthBranch;
    if (state.legacyProjection.yearStem) instrument.dataset.yearStem = state.legacyProjection.yearStem;
  } else {
    delete instrument.dataset.projectionMode;
    delete instrument.dataset.projectionLongitude;
    delete instrument.dataset.focusMonth;
    delete instrument.dataset.yearStem;
  }
  if (document.activeElement !== instantInput) {
    const value = atlasInputValueFromFields(fields);
    if (instantInput.value !== value) instantInput.value = value;
  }
}

function updateWheel({ fast = false } = {}) {
  currentDisplay = resolveAtlasDisplayState({
    selectedMs: state.selectedMs,
    legacyProjection: state.legacyProjection,
    timeContext: state.timeContext,
    fast
  });
  alignCycleRing("hour", currentDisplay.hourIndex, currentDisplay.phases.hour);
  alignCycleRing("day", currentDisplay.dayIndex, currentDisplay.phases.day);
  alignCycleRing("month", currentDisplay.monthIndex, currentDisplay.phases.month);
  alignCycleRing("year", currentDisplay.yearIndex, currentDisplay.phases.year);
  alignLongitudeTracks(currentDisplay.longitude);
  renderAllRingPoses();
  updateReadout(currentDisplay);
  compareController?.update();
  schedulePillarAnnouncement();
}

function setSliderForScale() {
  const sliderState = sliderStateForScale({
    scale: state.scale,
    selectedMs: state.selectedMs,
    anchorMs: state.anchorMs
  });
  if (slider.min !== String(sliderState.min)) slider.min = String(sliderState.min);
  if (slider.max !== String(sliderState.max)) slider.max = String(sliderState.max);
  if (slider.step !== String(sliderState.step)) slider.step = String(sliderState.step);
  if (slider.value !== String(sliderState.value)) slider.value = String(sliderState.value);
  setText("slider-left", sliderState.leftLabel);
  setText("slider-right", sliderState.rightLabel);
  setText("scale-readout", sliderState.label);
  scaleButtons.forEach(button => button.classList.toggle("active", button.dataset.scale === state.scale));
}

function stopPlayback({ interruptActiveDrag = false, reason = "external-control" } = {}) {
  if (interruptActiveDrag) {
    dragController?.cancelActiveGesture?.({ detent:true, reason });
  }
  dragController?.cancelInertia?.({ detent:true, reason });
  playbackController?.stop();
}

function setSelectedInstant(instantMs, source = "command") {
  if (!Number.isFinite(instantMs)) return false;
  stopPlayback({ interruptActiveDrag:true, reason:"external-control" });
  clearLegacyProjection();
  state.selectedMs = instantMs;
  state.anchorMs = instantMs;
  setSliderForScale();
  updateWheel();
  instrument.dataset.lastSelectedInstantSource = source;
  const href = selectedInstantUrl(location.href, instantMs, state.timeContext);
  if (href) history.replaceState(history.state, "", href);
  setFollowingNow(source === "now" || source === "mobile-now");
  return true;
}

function setTimeContext(timeContext, source = "command") {
  if (!timeContext) return false;
  stopPlayback({ interruptActiveDrag:true, reason:"external-control" });
  state.timeContext = timeContext;
  updateWheel();
  instrument.dataset.lastTimeContextSource = source;
  const href = temporalContextUrl(location.href, timeContext);
  if (href) history.replaceState(history.state, "", href);
  return true;
}

function installPlayback() {
  playbackController = createKineticPlaybackController({
    state,
    slider,
    playButton,
    updateWheel,
    prepareStart() {
      dragController?.cancelActiveGesture?.({ detent:true, reason:"playback-start" });
      dragController?.cancelInertia?.({ detent:true, reason:"playback-start" });
      if (dragController?.compareMode) compareController?.setMode(false);
      clearLegacyProjection();
    }
  });
}

function applyLinkedDragToTime(id, deltaDegrees) {
  const beforeMs = state.selectedMs;
  const result = applyLinkedRingDragInto(
    linkedDragResult,
    id,
    beforeMs,
    deltaDegrees,
    state.timeContext,
    linkedLongitudeAtMs
  );
  queueLinkedDiagnostics({ boundaries:result.crossedBoundaries ?? 0 });

  if (result.instantMs !== beforeMs) {
    state.selectedMs = result.instantMs;
    state.anchorMs = result.instantMs;
    linkedWheelRenderPending = true;
    queueLinkedDiagnostics({
      lastRing:id,
      deltaMs:Math.round(result.instantMs - beforeMs)
    });
  }

  // Pointer devices can deliver several coalesced samples inside one display
  // frame. Keep every semantic time step, but collapse slider/readout/SVG and
  // diagnostic DOM writes to one animation-frame commit. Inertia is already
  // requestAnimationFrame-bounded by the drag controller, so commit it
  // immediately without adding a second frame of visual latency.
  if (dragController?.isCoasting) {
    linkedWheelCommitQueue.cancel();
    commitLinkedWheelFrame();
  } else {
    linkedWheelCommitQueue.schedule();
  }
}

function installRingDrag() {
  dragController = createRingDragController({
    svg,
    ringStates,
    onDragStart(id) {
      stopPlayback();
      freePoseCommitQueue.cancel();
      pendingFreePoseRings.clear();
      instrument.dataset.dragRing = id;
      instrument.dataset.dragMode = "free";
    },
    onPoseChange(id, _ringState, _deltaDegrees, detail) {
      if (detail?.phase === "drag") {
        pendingFreePoseRings.add(id);
        freePoseCommitQueue.schedule();
        return;
      }

      // Detents and inertia are already low-frequency/frame-bounded. Replace any
      // stale queued drag frame with the newest authoritative pose immediately.
      freePoseCommitQueue.cancel();
      pendingFreePoseRings.clear();
      instrument.dataset.lastDraggedRing = id;
      renderRingPose(id);
      compareController?.update();
    },
    onDragEnd(id) {
      freePoseCommitQueue.flush();
      instrument.dataset.lastDraggedRing = id;
      delete instrument.dataset.dragRing;
      delete instrument.dataset.dragMode;
      compareController?.update();
    },
    onLinkedDragStart(id) {
      stopPlayback();
      resetLinkedWheelFrame();
      linkedScrubActive = true;
      if (state.legacyProjection) {
        clearLegacyProjection();
        updateWheel();
      }
      instrument.dataset.dragRing = id;
      instrument.dataset.dragMode = "linked";
      instrument.dataset.linkedScrubStartMs = String(Math.round(state.selectedMs));
      instrument.dataset.linkedScrubMode = "continuous";
    },
    onLinkedDragDelta(id, deltaDegrees) {
      applyLinkedDragToTime(id, deltaDegrees);
    },
    onLinkedDragEnd(id) {
      linkedWheelCommitQueue.flush();
      linkedScrubActive = false;
      // Settle: the final instant always comes from Tyme, never the estimate.
      if (currentDisplay?.pillarsEstimated) updateWheel();
      instrument.dataset.lastLinkedScrubRing = id;
      instrument.dataset.linkedScrubEndMs = String(Math.round(state.selectedMs));
      delete instrument.dataset.dragRing;
      delete instrument.dataset.dragMode;
      delete instrument.dataset.linkedScrubBoundaries;
    },
    onModeChange() {
      compareController?.update();
    }
  });
  compareController = createFreeCompareController({
    instrument,
    // The Now shortcut now belongs to the Selected Instant, not the tool rail.
    controlGroup:document.querySelector(".instrument-toolbar > .toolbar-group:last-child"),
    insertBefore:document.querySelector("#classification-overlay-button"),
    rings:RINGS,
    ringStates,
    dragController,
    renderAllRingPoses,
    stopPlayback
  });
  compareController?.update();
}

// Repair E6: keyboard stepping on the focused wheel. ←/→ move one 時辰 (2 h),
// Shift+←/→ one day, Home returns to now. Uses the canonical command path.
const KEY_STEP_MS = Object.freeze({ hour:2 * 3_600_000, day:DAY_MS });

function handleWheelKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "Home") {
    event.preventDefault();
    setSelectedInstant(Date.now(), "now");
    return;
  }
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const direction = event.key === "ArrowRight" ? 1 : -1;
  const step = event.shiftKey ? KEY_STEP_MS.day : KEY_STEP_MS.hour;
  setSelectedInstant(state.selectedMs + direction * step, "keyboard");
}

// Repair E6: announce the four pillars after they settle, not every frame.
let pillarAnnounceTimer = 0;
let lastPillarAnnouncement = "";
function schedulePillarAnnouncement() {
  const live = document.querySelector("#atlas-pillars-live");
  if (!live) return;
  clearTimeout(pillarAnnounceTimer);
  pillarAnnounceTimer = setTimeout(() => {
    const read = id => document.querySelector(`#${id}`)?.textContent?.trim() || "—";
    const text = `年柱${read("state-year")}，月柱${read("state-month")}，日柱${read("state-day")}，時柱${read("state-hour")}`;
    if (text === lastPillarAnnouncement) return;
    lastPillarAnnouncement = text;
    live.textContent = text;
  }, 700);
}

function bindControls() {
  scaleButtons.forEach(button => {
    button.addEventListener("click", () => {
      stopPlayback({ interruptActiveDrag:true, reason:"external-control" });
      clearLegacyProjection();
      state.scale = button.dataset.scale;
      state.anchorMs = state.selectedMs;
      setSliderForScale();
      updateWheel();
    });
  });
  slider.addEventListener("input", () => {
    stopPlayback({ interruptActiveDrag:true, reason:"external-control" });
    clearLegacyProjection();
    state.selectedMs = state.anchorMs + Number(slider.value) * DAY_MS;
    updateWheel();
  });
  playButton.addEventListener("click", () => playbackController?.toggle());
  nowButton.addEventListener("click", () => {
    setSelectedInstant(Date.now(), "now");
  });
  svg.addEventListener("keydown", handleWheelKeydown);
  instantInput.addEventListener("change", () => {
    const instant = instantFromAtlasLocalInput(instantInput.value, state.timeContext);
    if (instant === null || !Number.isFinite(instant)) return;
    setSelectedInstant(instant, "desktop-input");
  });
  instrument.addEventListener(SELECTED_INSTANT_COMMAND, event => {
    const instant = selectedInstantFromCommandDetail(event.detail);
    if (instant === null) return;
    const source = typeof event.detail?.source === "string" ? event.detail.source : "command";
    setSelectedInstant(instant, source);
  });
  instrument.addEventListener(TIME_CONTEXT_COMMAND, event => {
    const timeContext = timeContextFromCommandDetail(event.detail);
    if (timeContext === null) return;
    const source = typeof event.detail?.source === "string" ? event.detail.source : "command";
    setTimeContext(timeContext, source);
  });
}

// Repair B5: while the Atlas shows "now", the selected instant follows the
// wall clock once per second. Any other writer (drag, playback, input, deep
// link, commands) changes selectedMs away from the last followed value, which
// ends following without each path needing to know about the clock. "現在"
// re-enters following. Ticks never write the URL.
const liveClock = { following:false, lastMs:null, timer:0 };

function setFollowingNow(following) {
  liveClock.following = following;
  liveClock.lastMs = following ? state.selectedMs : null;
  instrument.dataset.followingNow = String(following);
}

function tickLiveClock() {
  if (!liveClock.following) return;
  if (instrument.dataset.introSweep === "running") return;
  if (state.selectedMs !== liveClock.lastMs) { setFollowingNow(false); return; }
  if (document.visibilityState === "hidden") return;
  const nowMs = Math.floor(Date.now() / 1000) * 1000;
  if (nowMs <= state.selectedMs) return;
  state.selectedMs = nowMs;
  state.anchorMs = nowMs;
  liveClock.lastMs = nowMs;
  setSliderForScale();
  updateWheel();
}

function installLiveClock() {
  // Embedded pages (iframes, browser harnesses) keep a frozen instant.
  const embedded = window.self !== window.top;
  const plainNow = !embedded && !Number.isFinite(parseAtlasSearch(location.search).instantMs) && !state.legacyProjection;
  setFollowingNow(plainNow);
  clearInterval(liveClock.timer);
  liveClock.timer = setInterval(tickLiveClock, 1000);
}

function readIntroSeen() {
  try { return localStorage.getItem(INTRO_SWEEP_STORAGE_KEY) === "1"; } catch { return false; }
}

function markIntroSeen() {
  try { localStorage.setItem(INTRO_SWEEP_STORAGE_KEY, "1"); } catch { /* storage unavailable */ }
}

// Repair B1: one-time opening time-lapse; never writes the URL and ends on the
// exact landing instant. Any pointer, key or wheel input skips to the end.
// It also yields to any other writer.
function runTimeSweep({ statusKey, spanMs, durationMs, onSettled = () => {} }) {
  const endMs = state.selectedMs;
  let startTime = null;
  let frame = 0;
  let lastWritten = null;
  const detach = () => {
    cancelAnimationFrame(frame);
    removeEventListener("pointerdown", finish, true);
    removeEventListener("keydown", finish, true);
    removeEventListener("wheel", finish, true);
  };
  // Another writer (Play, Now, a command, a drag) took over: stop animating and
  // leave its instant in place.
  const yieldToOtherWriter = () => {
    detach();
    instrument.dataset[statusKey] = "done";
    onSettled();
  };
  function finish() {
    detach();
    if (instrument.dataset[statusKey] !== "running") return;
    state.selectedMs = endMs;
    updateWheel();
    instrument.dataset[statusKey] = "done";
    onSettled();
  }
  addEventListener("pointerdown", finish, true);
  addEventListener("keydown", finish, true);
  addEventListener("wheel", finish, { capture:true, passive:true });
  instrument.dataset[statusKey] = "running";
  // Elapsed time accumulates per painted frame with a 120 ms cap, so a long
  // first-load task (shader compile, font load) pauses the sweep instead of
  // skipping most of it. Slow devices still finish: wall-clock time past
  // 8 s ends the sweep.
  let elapsed = 0;
  let firstFrame = null;
  const step = () => {
    if (instrument.dataset[statusKey] !== "running") return;
    if (state.selectedMs !== lastWritten) { yieldToOtherWriter(); return; }
    const now = performance.now();
    if (firstFrame === null) firstFrame = now;
    if (startTime !== null) elapsed += Math.min(120, Math.max(0, now - startTime));
    startTime = now;
    if (now - firstFrame > 8000) { finish(); return; }
    const { instantMs, done } = introSweepInstant({ endMs, elapsedMs:elapsed, spanMs, durationMs });
    if (done) { finish(); return; }
    state.selectedMs = instantMs;
    lastWritten = instantMs;
    updateWheel();
    frame = requestAnimationFrame(step);
  };
  state.selectedMs = introSweepInstant({ endMs, elapsedMs:0, spanMs, durationMs }).instantMs;
  lastWritten = state.selectedMs;
  updateWheel();
  frame = requestAnimationFrame(step);
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function runIntroSweep() {
  if (!shouldRunIntroSweep({
    search:location.search,
    reducedMotion:prefersReducedMotion(),
    seen:readIntroSeen(),
    hidden:document.visibilityState === "hidden",
    embedded:window.self !== window.top
  })) {
    instrument.dataset.introSweep = "skipped";
    return;
  }
  runTimeSweep({
    statusKey:"introSweep",
    spanMs:INTRO_SWEEP_SPAN_MS,
    durationMs:INTRO_SWEEP_DURATION_MS,
    onSettled:markIntroSeen
  });
}

function initialize() {
  assertWheelModel();
  renderer.renderStatic();
  installKineticFanGuard();
  // After the fan guard has wrapped the rings: fixed-world groups move to
  // their own static layers so drags only re-raster rotating content.
  installStaticWheelLayers(svg);
  applyInitialSearchState();
  setSliderForScale();
  installPlayback();
  bindControls();
  updateWheel();
  installRingDrag();
  orbitalBackground = createOrbitalBackground({
    root:document.querySelector("#orbital-background"),
    instrument,
    svg,
    wheelCenter:WHEEL_CENTER,
    wheelOuterRadius:RADII.outer,
    getSourceAngularVelocityDegPerSec:() => yearOrbitalVelocity.current()
  });
  installLiveClock();
  runIntroSweep();
}

initialize();
