import { baziMonths, solarTerms, zodiacSigns } from "./data.js";
import { apparentSolarLongitude } from "./astronomy/solar-longitude.js";
import { DAY_BOUNDARY, resolveBirthPillars } from "./calendar/tyme-adapter.js";
import { monthPillarForYearStem } from "./calendar/five-tigers.js";
import {
  CURSOR_ANGLE,
  RINGS,
  SEXAGENARY_RING_IDS,
  assertWheelModel
} from "./wheel/ring-model.js";
import { normalizeDegrees, shortestAngleDelta } from "./wheel/polar-geometry.js";
import { createKineticRenderer } from "./wheel/kinetic-renderer.js";
import {
  createRingState,
  effectiveRotation,
  resetManualOffset,
  setModelRotation
} from "./wheel/ring-state.js";
import { createRingDragController } from "./wheel/ring-drag-controller.js";
import { applyLinkedRingDrag } from "./interaction/linked-ring-scrub.js";

const DAY_MS = 86_400_000;
const UTC_OFFSET_HOURS = 8;
const OFFSET_EPSILON = 0.001;

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const SEXAGENARY = Array.from({ length: 60 }, (_, index) => `${STEMS[index % 10]}${BRANCHES[index % 12]}`);
const RING_LABELS = Object.freeze({ hour: "時", year: "年", month: "月", day: "日", solar: "節氣", zodiac: "黃道" });

const SCALE_CONFIG = Object.freeze({
  day: { label: "日內 / 48 小時", spanDays: 1, sliderStep: 1 / 144, playDaysPerSecond: .25, edgeLabel: "1 日" },
  year: { label: "一年", spanDays: 183, sliderStep: .25, playDaysPerSecond: 6, edgeLabel: "約半年" },
  cycle: { label: "六十年", spanDays: 365.2422 * 30, sliderStep: 1, playDaysPerSecond: 365.2422, edgeLabel: "約 30 年" }
});

const svg = document.querySelector("#kinetic-wheel");
const instrument = document.querySelector("#kinetic-instrument");
const slider = document.querySelector("#time-slider");
const instantInput = document.querySelector("#instant-input");
const playButton = document.querySelector("#play-button");
const nowButton = document.querySelector("#now-button");
const scaleButtons = [...document.querySelectorAll("[data-scale]")];

const renderer = createKineticRenderer({ svg, sexagenary: SEXAGENARY, solarTerms, zodiacSigns });

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
const cycleRuntime = Object.fromEntries(SEXAGENARY_RING_IDS.map(id => [id, { lastIndex: null }]));
const linkedDragRemainders = Object.fromEntries(RINGS.map(ring => [ring.id, 0]));
let lastSolarLongitude = null;
let longitudeModelRotation = null;
let currentDisplay = null;
let dragController = null;
let compareButton = null;
let resetRingsButton = null;
let compareStatus = null;

function ganzhiIndex(name) {
  return SEXAGENARY.indexOf(name);
}

function shortestCycleDelta(nextIndex, previousIndex, size = 60) {
  let delta = (nextIndex - previousIndex) % size;
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

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

function alignCycleRing(id, index) {
  const runtime = cycleRuntime[id];
  const pose = ringStates[id];
  if (index < 0) return;
  let nextRotation;
  if (runtime.lastIndex === null) nextRotation = CURSOR_ANGLE - (index * 6 + 3);
  else nextRotation = pose.modelRotation - shortestCycleDelta(index, runtime.lastIndex) * 6;
  runtime.lastIndex = index;
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

function fieldsFromInstant(ms) {
  const shifted = new Date(ms + UTC_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds()
  };
}

function longitudeAtInstant(ms) {
  return apparentSolarLongitude(fieldsFromInstant(ms), UTC_OFFSET_HOURS);
}

function instantFromLocalInput(value) {
  const match = /^(\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), 0) - UTC_OFFSET_HOURS * 3_600_000;
}

function inputValueFromFields(fields) {
  const pad = value => String(value).padStart(2, "0");
  return `${String(fields.year).padStart(4, "0")}-${pad(fields.month)}-${pad(fields.day)}T${pad(fields.hour)}:${pad(fields.minute)}`;
}

function formatCivil(fields) {
  const pad = value => String(value).padStart(2, "0");
  return `${fields.year}-${pad(fields.month)}-${pad(fields.day)} · ${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)}`;
}

function rangeContains(start, end, angle) {
  const normalized = normalizeDegrees(angle);
  if (end > start) return normalized >= start && normalized < end;
  return normalized >= start || normalized < end;
}

function baziMonthAt(longitude) {
  return baziMonths.find(month => rangeContains(month.start, month.end, longitude));
}

function zodiacAt(longitude) {
  return zodiacSigns.find(sign => rangeContains(sign.start, sign.end, longitude));
}

function termAt(longitude) {
  return solarTerms[Math.floor(normalizeDegrees(longitude) / 15) % 24];
}

function midpoint(start, end) {
  return normalizeDegrees(start + normalizeDegrees(end - start) / 2);
}

function nearestCycleIndexForBranch(branch, preferredIndex) {
  const candidates = SEXAGENARY.map((name, index) => ({ name, index })).filter(item => item.name.endsWith(branch));
  return candidates.reduce((best, candidate) => {
    const distance = Math.abs(shortestCycleDelta(candidate.index, preferredIndex));
    return !best || distance < best.distance ? { index: candidate.index, distance } : best;
  }, null)?.index ?? preferredIndex;
}

function parseLegacyProjection() {
  const params = new URLSearchParams(location.search);
  if (params.has("instant")) {
    const instant = Date.parse(params.get("instant"));
    if (Number.isFinite(instant)) {
      state.anchorMs = instant;
      state.selectedMs = instant;
      return;
    }
  }
  const rawLongitude = params.has("lambda") ? Number(params.get("lambda")) : Number.NaN;
  const requestedMonth = params.get("month");
  const yearStem = params.get("yearStem");
  let longitude = Number.isFinite(rawLongitude) ? normalizeDegrees(rawLongitude) : null;
  let monthBranch = baziMonths.some(month => month.branch === requestedMonth) ? requestedMonth : null;
  if (longitude === null && monthBranch) {
    const month = baziMonths.find(item => item.branch === monthBranch);
    longitude = midpoint(month.start, month.end);
  }
  if (longitude !== null && !monthBranch) monthBranch = baziMonthAt(longitude)?.branch ?? null;
  if (longitude === null && !monthBranch) return;
  let monthPillar = null;
  if (yearStem && STEMS.includes(yearStem) && monthBranch) monthPillar = monthPillarForYearStem(yearStem, monthBranch);
  state.legacyProjection = { longitude, monthBranch, yearStem, monthPillar };
  document.body.classList.add("legacy-projection");
}

function clearLegacyProjection() {
  if (!state.legacyProjection) return;
  state.legacyProjection = null;
  document.body.classList.remove("legacy-projection");
  history.replaceState({}, "", location.pathname);
}

function resolveDisplayState() {
  const fields = fieldsFromInstant(state.selectedMs);
  const result = resolveBirthPillars(fields, { utcOffsetHours: UTC_OFFSET_HOURS, dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY });
  const actualLongitude = apparentSolarLongitude(fields, UTC_OFFSET_HOURS);
  const longitude = state.legacyProjection?.longitude ?? actualLongitude;
  const yearName = result.pillars.year.name;
  let monthName = result.pillars.month.name;
  let monthBranch = result.pillars.month.branch;
  if (state.legacyProjection?.monthBranch) monthBranch = state.legacyProjection.monthBranch;
  if (state.legacyProjection?.monthPillar) monthName = state.legacyProjection.monthPillar;
  let monthIndex = ganzhiIndex(monthName);
  if (monthIndex < 0 || !monthName.endsWith(monthBranch)) {
    monthIndex = nearestCycleIndexForBranch(monthBranch, ganzhiIndex(result.pillars.month.name));
    monthName = SEXAGENARY[monthIndex];
  }
  return {
    fields,
    longitude,
    actualLongitude,
    pillars: result.pillars,
    yearName,
    monthName,
    monthBranch,
    monthIndex,
    hourIndex: ganzhiIndex(result.pillars.hour.name),
    yearIndex: ganzhiIndex(yearName),
    dayIndex: ganzhiIndex(result.pillars.day.name),
    activeTerm: termAt(longitude),
    activeZodiac: zodiacAt(longitude)
  };
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function updateReadout(display) {
  const { fields, longitude, pillars, yearName, monthName, activeTerm, activeZodiac } = display;
  setText("instant-readout", `${formatCivil(fields)} · UTC+08:00`);
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
  if (document.activeElement !== instantInput) instantInput.value = inputValueFromFields(fields);
}

function updateWheel() {
  currentDisplay = resolveDisplayState();
  alignCycleRing("hour", currentDisplay.hourIndex);
  alignCycleRing("day", currentDisplay.dayIndex);
  alignCycleRing("month", currentDisplay.monthIndex);
  alignCycleRing("year", currentDisplay.yearIndex);
  alignLongitudeTracks(currentDisplay.longitude);
  renderAllRingPoses();
  updateReadout(currentDisplay);
  updateCompareUi();
}

function setSliderForScale() {
  const config = SCALE_CONFIG[state.scale];
  slider.min = String(-config.spanDays);
  slider.max = String(config.spanDays);
  slider.step = String(config.sliderStep);
  slider.value = String((state.selectedMs - state.anchorMs) / DAY_MS);
  setText("slider-left", `−${config.edgeLabel}`);
  setText("slider-right", `+${config.edgeLabel}`);
  setText("scale-readout", config.label);
  scaleButtons.forEach(button => button.classList.toggle("active", button.dataset.scale === state.scale));
}

function stopPlayback() {
  state.playing = false;
  state.lastAnimationTs = null;
  if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
  state.animationFrame = null;
  playButton.textContent = "播放";
  playButton.setAttribute("aria-pressed", "false");
}

function resetAllRingOffsets() {
  RINGS.forEach(ring => resetManualOffset(ringStates[ring.id]));
  resetManualOffset(ringStates.zodiac);
  renderAllRingPoses();
  updateCompareUi();
}

function detachedRings() {
  return RINGS.filter(ring => Math.abs(ringStates[ring.id].manualOffset) > OFFSET_EPSILON);
}

function offsetLabel(value) {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toFixed(1)}°`;
}

function updateCompareUi() {
  if (!compareButton || !compareStatus) return;
  const compareMode = Boolean(dragController?.compareMode);
  const detached = detachedRings();
  compareButton.setAttribute("aria-pressed", String(compareMode));
  compareButton.textContent = compareMode ? "比較中" : "比較";
  if (resetRingsButton) resetRingsButton.hidden = detached.length === 0;
  instrument.dataset.compareMode = String(compareMode);
  instrument.dataset.scrubMode = compareMode ? "free-compare" : "linked-time";
  instrument.dataset.detachedRings = detached.map(ring => ring.id).join(",");
  if (!compareMode) {
    compareStatus.hidden = true;
    compareStatus.textContent = "";
    return;
  }
  compareStatus.hidden = false;
  compareStatus.textContent = detached.length
    ? `FREE · ${detached.map(ring => `${RING_LABELS[ring.id]} ${offsetLabel(ringStates[ring.id].manualOffset)}`).join(" · ")}`
    : "FREE COMPARE · 拖動任一圓環";
}

function setCompareMode(enabled) {
  if (!dragController) return;
  if (!enabled) resetAllRingOffsets();
  else stopPlayback();
  dragController.setCompareMode(enabled);
  updateCompareUi();
}

function installCompareControls() {
  const controlGroup = nowButton?.parentElement;
  if (!controlGroup) return;
  compareButton = document.createElement("button");
  compareButton.id = "compare-rings-button";
  compareButton.type = "button";
  compareButton.className = "control-button";
  compareButton.textContent = "比較";
  compareButton.setAttribute("aria-pressed", "false");
  compareButton.title = "自由比較：每一層可獨立拖動，不改變真實時間";
  controlGroup.prepend(compareButton);

  resetRingsButton = document.createElement("button");
  resetRingsButton.id = "reset-rings-button";
  resetRingsButton.type = "button";
  resetRingsButton.className = "control-button";
  resetRingsButton.textContent = "歸位";
  resetRingsButton.hidden = true;
  controlGroup.insertBefore(resetRingsButton, nowButton);

  compareStatus = document.createElement("div");
  compareStatus.id = "ring-compare-status";
  compareStatus.hidden = true;
  Object.assign(compareStatus.style, {
    position: "absolute", zIndex: "5", right: "12px", top: "58px", pointerEvents: "none",
    color: "#d4bd8d", fontSize: "9px", fontWeight: "700", letterSpacing: ".05em"
  });
  instrument.appendChild(compareStatus);

  compareButton.addEventListener("click", () => setCompareMode(!dragController.compareMode));
  resetRingsButton.addEventListener("click", resetAllRingOffsets);
}

function applyLinkedDragToTime(id, deltaDegrees) {
  const beforeMs = state.selectedMs;
  const result = applyLinkedRingDrag({
    ringId: id,
    instantMs: beforeMs,
    deltaDegrees,
    remainderDegrees: linkedDragRemainders[id],
    longitudeAtMs: longitudeAtInstant
  });
  linkedDragRemainders[id] = result.remainderDegrees;
  instrument.dataset.linkedScrubRemainder = result.remainderDegrees.toFixed(4);
  instrument.dataset.linkedScrubSteps = String(result.appliedSteps);
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
      updateCompareUi();
    },
    onDragEnd(id) {
      instrument.dataset.lastDraggedRing = id;
      delete instrument.dataset.dragRing;
      delete instrument.dataset.dragMode;
      updateCompareUi();
    },
    onLinkedDragStart(id) {
      stopPlayback();
      if (state.legacyProjection) {
        clearLegacyProjection();
        updateWheel();
      }
      linkedDragRemainders[id] = 0;
      instrument.dataset.dragRing = id;
      instrument.dataset.dragMode = "linked";
      instrument.dataset.linkedScrubStartMs = String(Math.round(state.selectedMs));
    },
    onLinkedDragDelta(id, deltaDegrees) {
      applyLinkedDragToTime(id, deltaDegrees);
    },
    onLinkedDragEnd(id) {
      instrument.dataset.lastLinkedScrubRing = id;
      instrument.dataset.linkedScrubEndMs = String(Math.round(state.selectedMs));
      linkedDragRemainders[id] = 0;
      delete instrument.dataset.dragRing;
      delete instrument.dataset.dragMode;
      delete instrument.dataset.linkedScrubRemainder;
      delete instrument.dataset.linkedScrubSteps;
    },
    onModeChange() {
      updateCompareUi();
    }
  });
  installCompareControls();
  updateCompareUi();
}

function animationTick(timestamp) {
  if (!state.playing) return;
  if (state.lastAnimationTs !== null) {
    const elapsedSeconds = Math.min((timestamp - state.lastAnimationTs) / 1000, .1);
    const config = SCALE_CONFIG[state.scale];
    state.selectedMs += elapsedSeconds * config.playDaysPerSecond * DAY_MS;
    const offsetDays = (state.selectedMs - state.anchorMs) / DAY_MS;
    if (offsetDays >= config.spanDays) {
      state.selectedMs = state.anchorMs + config.spanDays * DAY_MS;
      slider.value = String(config.spanDays);
      updateWheel();
      stopPlayback();
      return;
    }
    slider.value = String(offsetDays);
    updateWheel();
  }
  state.lastAnimationTs = timestamp;
  state.animationFrame = requestAnimationFrame(animationTick);
}

function startPlayback() {
  if (dragController?.compareMode) setCompareMode(false);
  clearLegacyProjection();
  state.playing = true;
  state.lastAnimationTs = null;
  playButton.textContent = "暫停";
  playButton.setAttribute("aria-pressed", "true");
  state.animationFrame = requestAnimationFrame(animationTick);
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
  playButton.addEventListener("click", () => state.playing ? stopPlayback() : startPlayback());
  nowButton.addEventListener("click", () => {
    stopPlayback();
    clearLegacyProjection();
    state.selectedMs = Date.now();
    state.anchorMs = state.selectedMs;
    setSliderForScale();
    updateWheel();
  });
  instantInput.addEventListener("change", () => {
    const instant = instantFromLocalInput(instantInput.value);
    if (instant === null || !Number.isFinite(instant)) return;
    stopPlayback();
    clearLegacyProjection();
    state.selectedMs = instant;
    state.anchorMs = instant;
    setSliderForScale();
    updateWheel();
  });
}

function initialize() {
  assertWheelModel();
  renderer.renderStatic();
  parseLegacyProjection();
  setSliderForScale();
  bindControls();
  updateWheel();
  installRingDrag();
}

initialize();