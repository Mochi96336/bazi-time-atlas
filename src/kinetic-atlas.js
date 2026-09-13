import { baziMonths, solarTerms, zodiacSigns } from "./data.js";
import { apparentSolarLongitude } from "./astronomy/solar-longitude.js";
import { DAY_BOUNDARY, resolveBirthPillars } from "./calendar/tyme-adapter.js";
import { monthPillarForYearStem } from "./calendar/five-tigers.js";
import {
  CURSOR_ANGLE,
  SEXAGENARY_RING_IDS,
  assertWheelModel
} from "./wheel/ring-model.js";
import {
  normalizeDegrees,
  shortestAngleDelta
} from "./wheel/polar-geometry.js";
import { createKineticRenderer } from "./wheel/kinetic-renderer.js";

const DAY_MS = 86_400_000;
const UTC_OFFSET_HOURS = 8;

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const SEXAGENARY = Array.from({ length: 60 }, (_, index) => `${STEMS[index % 10]}${BRANCHES[index % 12]}`);

const SCALE_CONFIG = Object.freeze({
  day: {
    label: "日內 / 48 小時",
    spanDays: 1,
    sliderStep: 1 / 144,
    playDaysPerSecond: .25,
    edgeLabel: "1 日"
  },
  year: {
    label: "一年",
    spanDays: 183,
    sliderStep: .25,
    playDaysPerSecond: 6,
    edgeLabel: "約半年"
  },
  cycle: {
    label: "六十年",
    spanDays: 365.2422 * 30,
    sliderStep: 1,
    playDaysPerSecond: 365.2422,
    edgeLabel: "約 30 年"
  }
});

const svg = document.querySelector("#kinetic-wheel");
const instrument = document.querySelector("#kinetic-instrument");
const slider = document.querySelector("#time-slider");
const instantInput = document.querySelector("#instant-input");
const playButton = document.querySelector("#play-button");
const nowButton = document.querySelector("#now-button");
const scaleButtons = [...document.querySelectorAll("[data-scale]")];

const renderer = createKineticRenderer({
  svg,
  sexagenary: SEXAGENARY,
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

const ringRuntime = Object.fromEntries(SEXAGENARY_RING_IDS.map(id => [id, {
  lastIndex: null,
  modelRotation: null
}]));
let solarModelRotation = null;
let lastSolarLongitude = null;

function ganzhiIndex(name) {
  return SEXAGENARY.indexOf(name);
}

function shortestCycleDelta(nextIndex, previousIndex, size = 60) {
  let delta = (nextIndex - previousIndex) % size;
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

function alignCycleRing(id, index) {
  const runtime = ringRuntime[id];
  if (index < 0) return;
  if (runtime.modelRotation === null || runtime.lastIndex === null) {
    runtime.modelRotation = CURSOR_ANGLE - (index * 6 + 3);
  } else {
    runtime.modelRotation -= shortestCycleDelta(index, runtime.lastIndex) * 6;
  }
  runtime.lastIndex = index;
  renderer.setCyclePose(id, runtime.modelRotation, index);
}

function alignLongitudeTracks(longitude) {
  if (solarModelRotation === null || lastSolarLongitude === null) {
    solarModelRotation = CURSOR_ANGLE - longitude;
  } else {
    solarModelRotation -= shortestAngleDelta(longitude, lastSolarLongitude);
  }
  lastSolarLongitude = longitude;
  renderer.setSolarPose(solarModelRotation, longitude);
}

function fieldsFromInstant(ms) {
  const shifted = new Date(ms + UTC_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

function instantFromLocalInput(value) {
  const match = /^(\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), 0) - UTC_OFFSET_HOURS * 3_600_000;
}

function inputValueFromFields(fields) {
  const pad = value => String(value).padStart(2, "0");
  const year = String(fields.year).padStart(4, "0");
  return `${year}-${pad(fields.month)}-${pad(fields.day)}T${pad(fields.hour)}:${pad(fields.minute)}`;
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
  const span = normalizeDegrees(end - start);
  return normalizeDegrees(start + span / 2);
}

function nearestCycleIndexForBranch(branch, preferredIndex) {
  const candidates = SEXAGENARY
    .map((name, index) => ({ name, index }))
    .filter(item => item.name.endsWith(branch));
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
  if (yearStem && STEMS.includes(yearStem) && monthBranch) {
    monthPillar = monthPillarForYearStem(yearStem, monthBranch);
  }
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
  const result = resolveBirthPillars(fields, {
    utcOffsetHours: UTC_OFFSET_HOURS,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  });
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
  setText("year-active", yearName);
  setText("month-active", monthName);
  setText("day-active", pillars.day.name);
  setText("solar-active", `${activeTerm.name} ${longitude.toFixed(1)}°`);
  setText("zodiac-active", activeZodiac.name);

  setText("state-year", yearName);
  setText("state-month", monthName);
  setText("state-day", pillars.day.name);
  setText("state-hour", pillars.hour.name);
  setText("state-zodiac", activeZodiac.name);
  setText("state-term", activeTerm.name);

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
  const display = resolveDisplayState();
  alignCycleRing("year", display.yearIndex);
  alignCycleRing("month", display.monthIndex);
  alignCycleRing("day", display.dayIndex);
  alignLongitudeTracks(display.longitude);
  updateReadout(display);
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

  playButton.addEventListener("click", () => {
    if (state.playing) stopPlayback();
    else startPlayback();
  });

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
}

initialize();
