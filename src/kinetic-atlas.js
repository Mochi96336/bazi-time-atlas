import { solarTerms, zodiacSigns } from "./data.js";
import {
  CURSOR_ANGLE,
  RINGS,
  SEXAGENARY_RING_IDS,
  assertWheelModel
} from "./wheel/ring-model.js";
import { temporalCycleRotation } from "./wheel/temporal-track.js";
import { shortestAngleDelta } from "./wheel/polar-geometry.js";
import { createKineticRenderer } from "./wheel/kinetic-renderer.js";
import {
  createRingState,
  effectiveRotation,
  setModelRotation
} from "./wheel/ring-state.js";
import { createRingDragController } from "./wheel/ring-drag-controller.js";
import {
  ATLAS_SEXAGENARY_NAMES,
  atlasInputValueFromFields,
  formatAtlasCivil,
  instantFromAtlasLocalInput,
  parseAtlasSearch,
  resolveAtlasDisplayState,
  solarLongitudeAtInstant
} from "./wheel/atlas-display-model.js";
import { createFreeCompareController } from "./interaction/free-compare-controller.js";
import { applyLinkedRingDrag } from "./interaction/linked-ring-scrub.js";
import { createKineticPlaybackController } from "./interaction/kinetic-playback-controller.js";
import { SELECTED_INSTANT_COMMAND } from "./interaction/selected-instant-command.js";
import {
  DAY_MS,
  sliderStateForScale
} from "./interaction/kinetic-playback.js";

const svg = document.querySelector("#kinetic-wheel");
const instrument = document.querySelector("#kinetic-instrument");
const slider = document.querySelector("#time-slider");
const instantInput = document.querySelector("#instant-input");
const playButton = document.querySelector("#play-button");
const nowButton = document.querySelector("#now-button");
const scaleButtons = [...document.querySelectorAll("[data-scale]")];

const renderer = createKineticRenderer({
  svg,
  sexagenary: ATLAS_SEXAGENARY_NAMES,
  solarTerms,
  zodiacSigns
});

const state = {
  anchorMs: Date.now(),
  selectedMs: Date.now(),
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

function cycleIndexForRing(id, display) {
  if (id === "hour") return display.hourIndex;
  if (id === "year") return display.yearIndex;
  if (id === "month") return display.monthIndex;
  if (id === "day") return display.dayIndex;
  return -1;
}

function setTrackDiagnostics(id) {
  const track = document.querySelector(`#${id}-track`);
  const pose = ringStates[id];
  if (!track || !pose) return;
  track.dataset.modelRotation = pose.modelRotation.toFixed(4);
  track.dataset.manualOffset = pose.manualOffset.toFixed(4);
  track.dataset.linked = String(pose.linked);
}

function renderRingPose(id) {
  const pose = ringStates[id];
  if (!pose || !currentDisplay) return;
  if (SEXAGENARY_RING_IDS.includes(id)) {
    renderer.setCyclePose(id, effectiveRotation(pose), cycleIndexForRing(id, currentDisplay));
  } else if (id === "solar") {
    renderer.setSolarRingPose(effectiveRotation(pose), currentDisplay.longitude);
  } else if (id === "zodiac") {
    renderer.setZodiacRingPose(effectiveRotation(pose), currentDisplay.longitude);
  }
  setTrackDiagnostics(id);
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
  history.replaceState({}, "", location.pathname);
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function updateReadout(display) {
  const { fields, longitude, pillars, yearName, monthName, activeTerm, activeZodiac } = display;
  setText("instant-readout", `${formatAtlasCivil(fields)} · UTC+08:00`);
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
  instrument.dataset.selectedInstantMs = String(Math.round(state.selectedMs));
  instrument.dataset.yearPillar = yearName;
  instrument.dataset.monthPillar = monthName;
  instrument.dataset.dayPillar = pillars.day.name;
  instrument.dataset.hourPillar = pillars.hour.name;
  instrument.dataset.solarLongitude = longitude.toFixed(6);
  instrument.dataset.term = activeTerm.name;
  instrument.dataset.zodiac = activeZodiac.name;
  if (state.legacyProjection) {
    instrument.dataset.projectionMode = "legacy-longitude";
    instrument.dataset.projectionLongitude = longitude.toFixed(6);
    if (state.legacyProjection.monthBranch) instrument.dataset.focusMonth = state.legacyProjection.monthBranch;
    if (state.legacyProjection.yearStem) instrument.dataset.yearStem = state.legacyProjection.yearStem;
  } else {
    delete instrument.dataset.projectionMode;
    delete instrument.dataset.projectionLongitude;
    delete instrument.dataset.focusMonth;
    delete instrument.dataset.yearStem;
  }
  if (document.activeElement !== instantInput) instantInput.value = atlasInputValueFromFields(fields);
}

function updateWheel() {
  currentDisplay = resolveAtlasDisplayState({
    selectedMs: state.selectedMs,
    legacyProjection: state.legacyProjection
  });
  alignCycleRing("hour", currentDisplay.hourIndex, currentDisplay.phases.hour);
  alignCycleRing("day", currentDisplay.dayIndex, currentDisplay.phases.day);
  alignCycleRing("month", currentDisplay.monthIndex, currentDisplay.phases.month);
  alignCycleRing("year", currentDisplay.yearIndex, currentDisplay.phases.year);
  alignLongitudeTracks(currentDisplay.longitude);
  renderAllRingPoses();
  updateReadout(currentDisplay);
  compareController?.update();
}

function setSliderForScale() {
  const sliderState = sliderStateForScale({
    scale: state.scale,
    selectedMs: state.selectedMs,
    anchorMs: state.anchorMs
  });
  slider.min = String(sliderState.min);
  slider.max = String(sliderState.max);
  slider.step = String(sliderState.step);
  slider.value = String(sliderState.value);
  setText("slider-left", sliderState.leftLabel);
  setText("slider-right", sliderState.rightLabel);
  setText("scale-readout", sliderState.label);
  scaleButtons.forEach(button => button.classList.toggle("active", button.dataset.scale === state.scale));
}

function stopPlayback() {
  playbackController?.stop();
}

function setSelectedInstant(instantMs, source = "command") {
  if (!Number.isFinite(instantMs)) return false;
  stopPlayback();
  clearLegacyProjection();
  state.selectedMs = instantMs;
  state.anchorMs = instantMs;
  setSliderForScale();
  updateWheel();
  instrument.dataset.lastSelectedInstantSource = source;
  return true;
}

function installPlayback() {
  playbackController = createKineticPlaybackController({
    state,
    slider,
    playButton,
    updateWheel,
    prepareStart() {
      if (dragController?.compareMode) compareController?.setMode(false);
      clearLegacyProjection();
    }
  });
}

function applyLinkedDragToTime(id, deltaDegrees) {
  const beforeMs = state.selectedMs;
  const result = applyLinkedRingDrag({
    ringId: id,
    instantMs: beforeMs,
    deltaDegrees,
    longitudeAtMs: solarLongitudeAtInstant
  });
  instrument.dataset.linkedScrubMode = "continuous";
  instrument.dataset.linkedScrubBoundaries = String(result.crossedBoundaries ?? 0);
  if (result.instantMs === beforeMs) return;

  state.selectedMs = result.instantMs;
  state.anchorMs = result.instantMs;
  setSliderForScale();
  updateWheel();
  instrument.dataset.lastLinkedScrubRing = id;
  instrument.dataset.lastLinkedScrubDeltaMs = String(Math.round(result.instantMs - beforeMs));
}

function installRingDrag() {
  dragController = createRingDragController({
    svg,
    ringStates,
    onDragStart(id) {
      stopPlayback();
      instrument.dataset.dragRing = id;
      instrument.dataset.dragMode = "free";
    },
    onPoseChange(id) {
      renderRingPose(id);
      instrument.dataset.lastDraggedRing = id;
      compareController?.update();
    },
    onDragEnd(id) {
      instrument.dataset.lastDraggedRing = id;
      delete instrument.dataset.dragRing;
      delete instrument.dataset.dragMode;
      compareController?.update();
    },
    onLinkedDragStart(id) {
      stopPlayback();
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
    controlGroup:nowButton?.parentElement,
    insertBefore:nowButton,
    rings:RINGS,
    ringStates,
    dragController,
    renderAllRingPoses,
    stopPlayback
  });
  compareController?.update();
}

function bindControls() {
  scaleButtons.forEach(button => {
    button.addEventListener("click", () => {
      stopPlayback();
      clearLegacyProjection();
      state.scale = button.dataset.scale;
      state.anchorMs = state.selectedMs;
      setSliderForScale();
      updateWheel();
    });
  });
  slider.addEventListener("input", () => {
    stopPlayback();
    clearLegacyProjection();
    state.selectedMs = state.anchorMs + Number(slider.value) * DAY_MS;
    updateWheel();
  });
  playButton.addEventListener("click", () => playbackController?.toggle());
  nowButton.addEventListener("click", () => {
    setSelectedInstant(Date.now(), "now");
  });
  instantInput.addEventListener("change", () => {
    const instant = instantFromAtlasLocalInput(instantInput.value);
    if (instant === null || !Number.isFinite(instant)) return;
    setSelectedInstant(instant, "desktop-input");
  });
  instrument.addEventListener(SELECTED_INSTANT_COMMAND, event => {
    const instant = Number(event.detail?.instantMs);
    const source = typeof event.detail?.source === "string" ? event.detail.source : "command";
    setSelectedInstant(instant, source);
  });
}

function initialize() {
  assertWheelModel();
  renderer.renderStatic();
  applyInitialSearchState();
  setSliderForScale();
  installPlayback();
  bindControls();
  updateWheel();
  installRingDrag();
}

initialize();